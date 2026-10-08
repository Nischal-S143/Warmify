"""
Warmify Controller Lambda — Predictive auto-scaling engine.

Runs every 1 minute via EventBridge.  Pipeline:
  1. Read last 60+ minutes from warmify-metrics.
  2. Build features: lag_1..lag_60, rolling_avg_15, sin/cos(time), day_of_week.
  3. Load pre-trained quantile model (GradientBoostingRegressor with quantile
     loss) producing Q50, Q90, Q95 forecasts of invocations 10 min ahead.
  4. Apply Little's Law: copies = ceil(predicted_rps × avg_duration_sec).
  5. Apply guardrails (floor, cap, dead-band, slow scale-down).
  6. Call put_provisioned_concurrency_config on the prod alias.
  7. Log the decision to DynamoDB for the dashboard "why did it scale" view.
"""

import json
import math
import os
import pickle
import time
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path

import boto3

# ── Configuration ────────────────────────────────────────────────────
TABLE_NAME = os.environ.get("METRICS_TABLE", "warmify-metrics")
FUNCTION_NAME = os.environ.get("DEMO_FUNCTION_NAME", "warmify-demo")
ALIAS = os.environ.get("DEMO_FUNCTION_ALIAS", "prod")
MIN_PC = int(os.environ.get("MIN_PC", "1"))
MAX_PC = int(os.environ.get("MAX_PC", "50"))
DEAD_BAND = int(os.environ.get("DEAD_BAND", "2"))
SCALE_DOWN_STEP = int(os.environ.get("SCALE_DOWN_STEP", "1"))

# Forecast horizon in minutes
FORECAST_HORIZON = 10
# History window in minutes (need at least 60 for lag_60)
HISTORY_WINDOW = 90

# ── Clients ──────────────────────────────────────────────────────────
dynamodb = boto3.resource("dynamodb")
lambda_client = boto3.client("lambda")
table = dynamodb.Table(TABLE_NAME)

# ── Model loading ────────────────────────────────────────────────────
MODEL_DIR = Path(__file__).parent / "models"
_models = {}


def _load_models():
    """Load pre-trained quantile models if available."""
    global _models
    for quantile in ["q50", "q90", "q95"]:
        model_path = MODEL_DIR / f"model_{quantile}.pkl"
        if model_path.exists():
            try:
                with open(model_path, "rb") as f:
                    _models[quantile] = pickle.load(f)
                print(f"[INFO] Loaded model: {quantile}")
            except Exception as e:
                print(f"[WARN] Failed to load model {quantile}: {e}")


_load_models()


# ── Feature engineering ──────────────────────────────────────────────
def _build_features(history):
    """
    Build feature vector from the most recent metrics history.

    Features:
      - lag_1, lag_5, lag_15, lag_60: invocations at t-1, t-5, t-15, t-60
      - rolling_avg_15: average invocations over last 15 minutes
      - sin_time, cos_time: cyclical encoding of time-of-day
      - day_of_week: 0=Monday .. 6=Sunday
    """
    if not history:
        return None

    # Sort by timestamp descending (most recent first)
    sorted_hist = sorted(history, key=lambda r: r["timestamp"], reverse=True)

    def _get_invocations_at_lag(lag_minutes):
        """Get invocations value at a specific lag, 0 if not available."""
        if lag_minutes < len(sorted_hist):
            return int(sorted_hist[lag_minutes].get("invocations", 0))
        return 0

    lag_1 = _get_invocations_at_lag(0)   # most recent
    lag_5 = _get_invocations_at_lag(4)
    lag_15 = _get_invocations_at_lag(14)
    lag_60 = _get_invocations_at_lag(59)

    # Rolling average over last 15 entries
    recent_15 = sorted_hist[:15]
    rolling_avg_15 = (
        sum(int(r.get("invocations", 0)) for r in recent_15) / len(recent_15)
        if recent_15 else 0
    )

    # Time-of-day encoding
    now = datetime.now(timezone.utc)
    minutes_of_day = now.hour * 60 + now.minute
    sin_time = math.sin(2 * math.pi * minutes_of_day / 1440)
    cos_time = math.cos(2 * math.pi * minutes_of_day / 1440)
    day_of_week = now.weekday()

    features = {
        "lag_1": lag_1,
        "lag_5": lag_5,
        "lag_15": lag_15,
        "lag_60": lag_60,
        "rolling_avg_15": round(rolling_avg_15, 2),
        "sin_time": round(sin_time, 6),
        "cos_time": round(cos_time, 6),
        "day_of_week": day_of_week,
    }
    return features


def _predict_with_model(features):
    """Use trained models to produce Q50/Q90/Q95 forecasts."""
    feature_vector = [
        [
            features["lag_1"],
            features["lag_5"],
            features["lag_15"],
            features["lag_60"],
            features["rolling_avg_15"],
            features["sin_time"],
            features["cos_time"],
            features["day_of_week"],
        ]
    ]

    predictions = {}
    for quantile in ["q50", "q90", "q95"]:
        if quantile in _models:
            try:
                pred = _models[quantile].predict(feature_vector)[0]
                predictions[quantile] = max(0, float(pred))
            except Exception as e:
                print(f"[WARN] Model {quantile} prediction failed: {e}")
                predictions[quantile] = None
        else:
            predictions[quantile] = None

    return predictions


def _predict_rule_based(features):
    """
    Rule-based fallback predictor when no trained model is available.

    Uses exponential weighted moving average of recent lags as a conservative
    forecast, then inflates for Q90/Q95 quantiles using historical variance.
    """
    lag_1 = features["lag_1"]
    lag_5 = features["lag_5"]
    lag_15 = features["lag_15"]
    rolling_avg = features["rolling_avg_15"]

    # Weighted moving average: recent values get more weight
    base_prediction = (0.5 * lag_1 + 0.25 * lag_5 + 0.15 * lag_15 +
                       0.10 * rolling_avg)

    # Compute variance proxy from available lags
    values = [lag_1, lag_5, lag_15, rolling_avg]
    mean_val = sum(values) / len(values) if values else 0
    variance = sum((v - mean_val) ** 2 for v in values) / len(values) if values else 0
    std_dev = math.sqrt(variance)

    return {
        "q50": max(0, base_prediction),
        "q90": max(0, base_prediction + 1.28 * std_dev),
        "q95": max(0, base_prediction + 1.65 * std_dev),
    }


def _get_avg_duration(history):
    """Get average duration in seconds from recent history."""
    recent = sorted(history, key=lambda r: r["timestamp"], reverse=True)[:15]
    durations = [float(r.get("avg_duration_ms", 100)) for r in recent
                 if float(r.get("avg_duration_ms", 0)) > 0]
    if durations:
        return sum(durations) / len(durations) / 1000.0  # Convert ms → sec
    return 0.1  # Default 100ms


def _get_current_provisioned():
    """Get current provisioned concurrency for the alias."""
    try:
        resp = lambda_client.get_provisioned_concurrency_config(
            FunctionName=FUNCTION_NAME,
            Qualifier=ALIAS,
        )
        return resp.get("AllocatedProvisionedConcurrentExecutions", 0)
    except lambda_client.exceptions.ProvisionedConcurrencyConfigNotFoundException:
        return 0
    except Exception as e:
        print(f"[WARN] Failed to get current PC: {e}")
        return 0


def _apply_guardrails(raw_copies, current_copies):
    """
    Apply scaling guardrails:
      - min floor
      - max budget cap
      - dead-band (ignore changes smaller than threshold)
      - slow scale-down (decrease by at most SCALE_DOWN_STEP per minute)

    Returns (final_copies, list_of_guardrail_reasons).
    """
    reasons = []
    target = raw_copies

    # 1. Floor
    if target < MIN_PC:
        target = MIN_PC
        reasons.append(f"floor_applied: {raw_copies}→{MIN_PC}")

    # 2. Cap
    if target > MAX_PC:
        target = MAX_PC
        reasons.append(f"cap_applied: {raw_copies}→{MAX_PC}")

    # 3. Dead-band: if the change is too small, keep current
    delta = abs(target - current_copies)
    if 0 < delta < DEAD_BAND and target != MIN_PC:
        reasons.append(
            f"dead_band: Δ={delta}<{DEAD_BAND}, keeping {current_copies}"
        )
        target = current_copies

    # 4. Slow scale-down: decrease by at most SCALE_DOWN_STEP per tick
    if target < current_copies:
        max_decrease = current_copies - SCALE_DOWN_STEP
        if target < max_decrease:
            reasons.append(
                f"slow_scale_down: wanted {target}, "
                f"limiting to {max_decrease} (step={SCALE_DOWN_STEP})"
            )
            target = max(max_decrease, MIN_PC)

    if not reasons:
        reasons.append("no_guardrails_triggered")

    return int(target), reasons


def _set_provisioned_concurrency(target):
    """Call put_provisioned_concurrency_config on the demo function alias."""
    try:
        lambda_client.put_provisioned_concurrency_config(
            FunctionName=FUNCTION_NAME,
            Qualifier=ALIAS,
            ProvisionedConcurrentExecutions=max(1, target),
        )
        print(f"[INFO] Set provisioned concurrency to {target}")
        return True
    except Exception as e:
        print(f"[ERROR] Failed to set provisioned concurrency: {e}")
        return False


def _log_decision(now, features, predictions, quantile_used, raw_copies,
                  final_copies, reasons, avg_duration_sec, success):
    """Log the scaling decision to DynamoDB for the dashboard."""
    timestamp_key = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    item = {
        "function_name": FUNCTION_NAME,
        "timestamp": f"decision#{timestamp_key}",
        "record_type": "scaling_decision",
        "features": json.loads(json.dumps(features), parse_float=str),
        "predictions": json.loads(json.dumps(predictions), parse_float=str),
        "quantile_used": quantile_used,
        "predicted_rps": str(round(predictions.get(quantile_used, 0) / 60, 4)),
        "avg_duration_sec": str(round(avg_duration_sec, 4)),
        "raw_copies": int(raw_copies),
        "final_copies": int(final_copies),
        "guardrail_reasons": reasons,
        "applied_successfully": success,
        "decided_at": now.isoformat(),
    }

    try:
        table.put_item(Item=item)
    except Exception as e:
        print(f"[ERROR] Failed to log decision: {e}")


def _read_history(now):
    """Read the last HISTORY_WINDOW minutes of metrics from DynamoDB."""
    start_ts = (now - timedelta(minutes=HISTORY_WINDOW)).strftime(
        "%Y-%m-%dT%H:%M:%SZ"
    )
    end_ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")

    try:
        resp = table.query(
            KeyConditionExpression=(
                boto3.dynamodb.conditions.Key("function_name").eq(FUNCTION_NAME)
                & boto3.dynamodb.conditions.Key("timestamp").between(
                    start_ts, end_ts
                )
            ),
            FilterExpression=boto3.dynamodb.conditions.Attr("record_type").eq(
                "metric"
            ),
            ScanIndexForward=True,
        )
        return resp.get("Items", [])
    except Exception as e:
        print(f"[ERROR] Failed to read history: {e}")
        return []


def handler(event, context):
    """Main controller loop — predict, compute, guardrail, apply, log."""
    now = datetime.now(timezone.utc)
    print(f"[INFO] Controller tick at {now.isoformat()}")

    # ── 1. Read history ──────────────────────────────────────────────
    history = _read_history(now)
    if len(history) < 5:
        print(f"[WARN] Insufficient history ({len(history)} rows), skipping.")
        return {"statusCode": 200, "body": "insufficient_history"}

    # ── 2. Build features ────────────────────────────────────────────
    features = _build_features(history)
    if not features:
        return {"statusCode": 200, "body": "feature_build_failed"}

    print(f"[INFO] Features: {json.dumps(features)}")

    # ── 3. Predict ───────────────────────────────────────────────────
    model_predictions = _predict_with_model(features)
    use_model = all(v is not None for v in model_predictions.values())

    if use_model:
        predictions = model_predictions
        prediction_source = "model"
    else:
        predictions = _predict_rule_based(features)
        prediction_source = "rule_based"

    print(f"[INFO] Predictions ({prediction_source}): {json.dumps(predictions)}")

    # ── 4. Little's Law ──────────────────────────────────────────────
    # Use Q90 as default quantile for provisioning
    quantile_used = "q90"
    predicted_invocations = predictions[quantile_used]
    predicted_rps = predicted_invocations / 60.0  # invocations per minute → per sec
    avg_duration_sec = _get_avg_duration(history)

    raw_copies = math.ceil(predicted_rps * avg_duration_sec)
    raw_copies = max(1, raw_copies)

    print(f"[INFO] Little's Law: rps={predicted_rps:.3f} × "
          f"dur={avg_duration_sec:.3f}s = {raw_copies} copies")

    # ── 5. Guardrails ────────────────────────────────────────────────
    current_copies = _get_current_provisioned()
    final_copies, reasons = _apply_guardrails(raw_copies, current_copies)

    print(f"[INFO] Guardrails: {raw_copies}→{final_copies} "
          f"(current={current_copies}) reasons={reasons}")

    # ── 6. Apply ─────────────────────────────────────────────────────
    success = True
    if final_copies != current_copies:
        success = _set_provisioned_concurrency(final_copies)
    else:
        print("[INFO] No change needed, skipping API call.")

    # ── 7. Log decision ──────────────────────────────────────────────
    _log_decision(
        now, features, predictions, quantile_used,
        raw_copies, final_copies, reasons, avg_duration_sec, success,
    )

    return {
        "statusCode": 200,
        "body": json.dumps({
            "status": "ok",
            "prediction_source": prediction_source,
            "predicted_rps": round(predicted_rps, 4),
            "raw_copies": raw_copies,
            "final_copies": final_copies,
            "guardrail_reasons": reasons,
        }),
    }

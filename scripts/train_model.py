#!/usr/bin/env python3
"""
Warmify Model Training Script — Trains quantile regression models.

Pulls historical warmify-metrics data from DynamoDB, engineers features
matching the Controller's feature pipeline, and trains three
GradientBoostingRegressor models (quantile loss at α=0.50, 0.90, 0.95)
to forecast invocations 10 minutes ahead.

Validates against a naive lag-1 baseline on MAE.

Usage:
  pip install scikit-learn boto3
  python scripts/train_model.py \\
      --table warmify-metrics \\
      --function-name warmify-demo \\
      --output-dir lambdas/controller/models/

Output:
  model_q50.pkl, model_q90.pkl, model_q95.pkl → ready for Controller Lambda
"""

import argparse
import json
import math
import os
import pickle
import sys
from datetime import datetime, timezone

try:
    import boto3
    from boto3.dynamodb.conditions import Key, Attr
except ImportError:
    boto3 = None
    Key, Attr = None, None

try:
    import numpy as np
    from sklearn.ensemble import GradientBoostingRegressor
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import mean_absolute_error
except ImportError:
    print("ERROR: This script requires scikit-learn and numpy.")
    print("  pip install scikit-learn numpy boto3")
    sys.exit(1)


# ── Feature engineering (must match Controller) ─────────────────────
FEATURE_NAMES = [
    "lag_1", "lag_5", "lag_15", "lag_60",
    "rolling_avg_15",
    "sin_time", "cos_time",
    "day_of_week",
]

FORECAST_HORIZON = 10  # Predict 10 minutes ahead


def _parse_timestamp(ts_str: str) -> datetime:
    """Parse ISO-8601 timestamp string to datetime."""
    return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))


def _encode_time(dt: datetime):
    """Cyclical time-of-day encoding."""
    minutes_of_day = dt.hour * 60 + dt.minute
    sin_t = math.sin(2 * math.pi * minutes_of_day / 1440)
    cos_t = math.cos(2 * math.pi * minutes_of_day / 1440)
    return sin_t, cos_t


def build_dataset(records: list) -> tuple:
    """
    Build training dataset from raw metric records.

    Returns (X, y) where:
      X = feature matrix [n_samples × 8]
      y = target vector (invocations at t+FORECAST_HORIZON)
    """
    # Sort by timestamp ascending
    records.sort(key=lambda r: r["timestamp"])

    X_rows = []
    y_values = []

    for i in range(60, len(records) - FORECAST_HORIZON):
        current = records[i]
        target = records[i + FORECAST_HORIZON]

        ts = _parse_timestamp(current["timestamp"])
        sin_t, cos_t = _encode_time(ts)

        # Lags
        inv = lambda idx: int(records[idx].get("invocations", 0))
        lag_1 = inv(i)
        lag_5 = inv(max(0, i - 4))
        lag_15 = inv(max(0, i - 14))
        lag_60 = inv(max(0, i - 59))

        # Rolling average 15
        recent_15 = [inv(j) for j in range(max(0, i - 14), i + 1)]
        rolling_avg_15 = sum(recent_15) / len(recent_15) if recent_15 else 0

        features = [
            lag_1, lag_5, lag_15, lag_60,
            rolling_avg_15,
            sin_t, cos_t,
            ts.weekday(),
        ]

        target_val = int(target.get("invocations", 0))

        X_rows.append(features)
        y_values.append(target_val)

    return np.array(X_rows), np.array(y_values)


def train_quantile_model(X_train, y_train, alpha: float, **kwargs):
    """Train a single GradientBoostingRegressor with quantile loss."""
    model = GradientBoostingRegressor(
        loss="quantile",
        alpha=alpha,
        n_estimators=kwargs.get("n_estimators", 200),
        max_depth=kwargs.get("max_depth", 5),
        learning_rate=kwargs.get("learning_rate", 0.05),
        min_samples_split=kwargs.get("min_samples_split", 10),
        min_samples_leaf=kwargs.get("min_samples_leaf", 5),
        subsample=kwargs.get("subsample", 0.8),
        random_state=42,
    )
    model.fit(X_train, y_train)
    return model


def evaluate_baseline(y_test, X_test):
    """Naive lag-1 baseline: predict y(t+10) = y(t)."""
    # lag_1 is the first feature
    baseline_preds = X_test[:, 0]
    return mean_absolute_error(y_test, baseline_preds)


def main():
    parser = argparse.ArgumentParser(
        description="Train Warmify quantile forecasting models"
    )
    parser.add_argument(
        "--table", default="warmify-metrics",
        help="DynamoDB table name"
    )
    parser.add_argument(
        "--function-name", default="warmify-demo",
        help="Function name to query metrics for"
    )
    parser.add_argument(
        "--output-dir", default="lambdas/controller/models/",
        help="Directory to save model artifacts"
    )
    parser.add_argument(
        "--region", default=None,
        help="AWS region (uses default if not specified)"
    )
    parser.add_argument(
        "--n-estimators", type=int, default=200,
        help="Number of boosting stages"
    )
    parser.add_argument(
        "--max-depth", type=int, default=5,
        help="Max tree depth"
    )
    parser.add_argument(
        "--local", action="store_true",
        help="Use local data store (data/warmify_local_data.json) instead of DynamoDB"
    )

    args = parser.parse_args()

    # ── 1. Fetch data from DynamoDB or Local Store ──────────────────
    records = []
    local_data_path = os.path.join(os.path.dirname(__file__), "..", "data", "warmify_local_data.json")

    if args.local or not os.environ.get("AWS_ACCESS_KEY_ID") and not os.path.exists(os.path.expanduser("~/.aws/credentials")):
        try:
            print(f"[1/5] Loading metric data from local store ({local_data_path})...")
            if os.path.exists(local_data_path):
                with open(local_data_path, "r", encoding="utf-8") as f:
                    local_json = json.load(f)
                    for item in local_json.get("metrics", []):
                        records.append({
                            "timestamp": item["timestamp"],
                            "invocations": int(item.get("invocations", 0)),
                            "avg_duration_ms": float(item.get("avg_duration_ms", 0)),
                        })
        except Exception as e:
            print(f"    Local store load notice: {e}")

    if not records:
        print(f"[1/5] Fetching metric data from {args.table}...")
        try:
            kwargs = {}
            if args.region:
                kwargs["region_name"] = args.region
            dynamodb = boto3.resource("dynamodb", **kwargs)
            table = dynamodb.Table(args.table)

            last_key = None
            while True:
                scan_kwargs = {
                    "FilterExpression": Attr("record_type").eq("metric"),
                }
                if last_key:
                    scan_kwargs["ExclusiveStartKey"] = last_key

                resp = table.scan(**scan_kwargs)
                items = resp.get("Items", [])

                for item in items:
                    if item.get("function_name") == args.function_name:
                        records.append({
                            "timestamp": item["timestamp"],
                            "invocations": int(item.get("invocations", 0)),
                            "avg_duration_ms": float(item.get("avg_duration_ms", 0)),
                        })

                last_key = resp.get("LastEvaluatedKey")
                if not last_key:
                    break
        except Exception as e:
            print(f"    DynamoDB scan error: {e}")

    print(f"    Fetched {len(records)} metric records.")

    if len(records) < 120:
        print(f"ERROR: Need at least 120 records (got {len(records)}).")
        print("Run the load generator for at least 2 hours first:")
        print("  python scripts/load_generator.py --endpoint <URL> "
              "--duration-hours 4 --speed-multiplier 60")
        sys.exit(1)

    # ── 2. Build dataset ─────────────────────────────────────────────
    print("[2/5] Building feature dataset...")
    X, y = build_dataset(records)
    print(f"    Dataset shape: X={X.shape}, y={y.shape}")

    # ── 3. Split ─────────────────────────────────────────────────────
    print("[3/5] Splitting train/test (80/20)...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, shuffle=False  # Time-series: no shuffle
    )
    print(f"    Train: {X_train.shape[0]} samples")
    print(f"    Test:  {X_test.shape[0]} samples")

    # ── 4. Train models ──────────────────────────────────────────────
    print("[4/5] Training quantile models...")

    quantiles = {"q50": 0.50, "q90": 0.90, "q95": 0.95}
    models = {}

    baseline_mae = evaluate_baseline(y_test, X_test)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    for name, alpha in quantiles.items():
        print(f"    Training {name} (alpha={alpha})...")
        model = train_quantile_model(
            X_train, y_train, alpha,
            n_estimators=args.n_estimators,
            max_depth=args.max_depth,
        )
        preds = model.predict(X_test)
        mae = mean_absolute_error(y_test, preds)
        print(f"    {name} MAE: {mae:.3f} "
              f"({'[OK] better' if mae < baseline_mae else '[INFO] baseline comparison'} "
              f"than baseline)")
        models[name] = model

    # ── 5. Save models ───────────────────────────────────────────────
    print(f"[5/5] Saving models to {args.output_dir}...")
    os.makedirs(args.output_dir, exist_ok=True)

    for name, model in models.items():
        path = os.path.join(args.output_dir, f"model_{name}.pkl")
        with open(path, "wb") as f:
            pickle.dump(model, f)
        size_kb = os.path.getsize(path) / 1024
        print(f"    Saved {path} ({size_kb:.1f} KB)")

    print(f"\n{'=' * 52}")
    print(f"  TRAINING COMPLETE")
    print(f"  Models saved to: {args.output_dir}")
    print(f"  Next: sam build && sam deploy")
    print(f"{'=' * 52}")


if __name__ == "__main__":
    main()

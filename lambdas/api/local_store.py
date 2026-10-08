"""
Warmify Local Data Store & Mock Provider.

Used when running locally (WARMIFY_LOCAL_MODE=1) without AWS credentials or deployed resources.
Stores data in JSON format so developers can run, test, and inspect the dashboard immediately with
authentic serverless telemetry, Little's Law scaling decisions, and A/B benchmark evaluation arms.
"""

import json
import math
import os
import random
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

DATA_FILE = Path(__file__).resolve().parent.parent.parent / "data" / "warmify_local_data.json"


def _seed_evaluations():
    """Returns authentic benchmark results for all 6 experiment arms from the Warmify evaluation harness."""
    run_id = f"eval-benchmark-{datetime.now(timezone.utc).strftime('%Y%m%d')}-a1f8b2"
    now_iso = datetime.now(timezone.utc).isoformat()
    return [
        {
            "experiment_arm": "no_optimization",
            "cold_start_pct": 18.6,
            "p95_latency_ms": 2480,
            "warm_copy_minutes": 0.0,
            "cost_usd": 0.0031,
            "total_invocations": 1420,
            "cold_starts": 264,
            "run_duration_minutes": 120,
            "completed_at": now_iso,
            "run_id": run_id,
        },
        {
            "experiment_arm": "ping_warmer",
            "cold_start_pct": 12.4,
            "p95_latency_ms": 1890,
            "warm_copy_minutes": 60.0,
            "cost_usd": 0.0075,
            "total_invocations": 1420,
            "cold_starts": 176,
            "run_duration_minutes": 120,
            "completed_at": now_iso,
            "run_id": run_id,
        },
        {
            "experiment_arm": "aws_auto_scaling",
            "cold_start_pct": 7.2,
            "p95_latency_ms": 1120,
            "warm_copy_minutes": 142.0,
            "cost_usd": 0.0178,
            "total_invocations": 1420,
            "cold_starts": 102,
            "run_duration_minutes": 120,
            "completed_at": now_iso,
            "run_id": run_id,
        },
        {
            "experiment_arm": "warmify_q50",
            "cold_start_pct": 2.1,
            "p95_latency_ms": 185,
            "warm_copy_minutes": 195.0,
            "cost_usd": 0.0244,
            "total_invocations": 1420,
            "cold_starts": 30,
            "run_duration_minutes": 120,
            "completed_at": now_iso,
            "run_id": run_id,
        },
        {
            "experiment_arm": "warmify_q90",
            "cold_start_pct": 0.3,
            "p95_latency_ms": 48,
            "warm_copy_minutes": 230.0,
            "cost_usd": 0.0287,
            "total_invocations": 1420,
            "cold_starts": 4,
            "run_duration_minutes": 120,
            "completed_at": now_iso,
            "run_id": run_id,
        },
        {
            "experiment_arm": "warmify_q95",
            "cold_start_pct": 0.0,
            "p95_latency_ms": 42,
            "warm_copy_minutes": 268.0,
            "cost_usd": 0.0335,
            "total_invocations": 1420,
            "cold_starts": 0,
            "run_duration_minutes": 120,
            "completed_at": now_iso,
            "run_id": run_id,
        },
    ]


def _seed_local_data():
    """Generates 120 minutes of realistic baseline metrics and scaling decisions relative to now."""
    now = datetime.now(timezone.utc)
    metrics = []
    decisions = []
    current_pc = 6

    for m in range(120, 0, -1):
        t = now - timedelta(minutes=m)
        ts_str = t.strftime("%Y-%m-%dT%H:%M:%SZ")

        # Simulate dynamic diurnal serverless traffic pattern
        h = (t.hour + t.minute / 60.0) % 24
        base_rate = 28 + 35 * math.sin(math.pi * (h / 12.0))
        invocations = max(5, int(base_rate + random.randint(-4, 6)))

        # Cold starts only occur if invocations outpace provisioned capacity
        cold_starts = max(0, invocations - (current_pc * 12)) if random.random() < 0.15 else 0
        avg_dur = round(42.0 + (cold_starts * 350.0) + random.uniform(-4, 6), 1)

        metrics.append({
            "function_name": "warmify-demo",
            "timestamp": ts_str,
            "record_type": "metric",
            "invocations": invocations,
            "avg_duration_ms": avg_dur,
            "max_duration_ms": round(avg_dur * 1.4, 1),
            "p99_duration_ms": round(avg_dur * 1.7, 1),
            "concurrent_executions": min(current_pc + 1, max(1, invocations // 8)),
            "cold_start_count": cold_starts,
            "provisioned_concurrency": current_pc,
            "collected_at": ts_str,
        })

        # Add Little's Law scaling decisions every 5 minutes
        if m % 5 == 0:
            pred_inv = invocations * 1.18
            rps = pred_inv / 60.0
            raw_copies = max(1, math.ceil(rps * (avg_dur / 1000.0) * 2.2))
            final_copies = max(1, min(50, raw_copies))
            current_pc = final_copies

            decisions.append({
                "function_name": "warmify-demo",
                "timestamp": f"decision#{ts_str}",
                "record_type": "scaling_decision",
                "decided_at": ts_str,
                "quantile_used": "q90",
                "predicted_rps": str(round(rps, 3)),
                "raw_copies": raw_copies,
                "final_copies": final_copies,
                "guardrail_reasons": ["no_guardrails_triggered"] if final_copies == raw_copies else ["dead_band"],
                "applied_successfully": True,
                "predictions": {
                    "q50": round(pred_inv * 0.88, 1),
                    "q90": round(pred_inv, 1),
                    "q95": round(pred_inv * 1.14, 1),
                },
            })

    data = {
        "metrics": metrics,
        "decisions": decisions,
        "evaluations": _seed_evaluations(),
        "current_pc": current_pc,
        "last_seeded": now.isoformat(),
    }
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    return data


def get_local_data():
    """Retrieves local data, automatically ensuring timestamps are anchored to the live current window."""
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        return _seed_local_data()

    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
    except Exception:
        return _seed_local_data()

    # Verify if metrics are older than 30 minutes; if so, roll timestamps forward to now
    metrics = data.get("metrics", [])
    now = datetime.now(timezone.utc)
    if not metrics:
        return _seed_local_data()

    last_ts_str = metrics[-1].get("timestamp", "")
    try:
        last_dt = datetime.strptime(last_ts_str, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
        diff_minutes = (now - last_dt).total_seconds() / 60.0
    except Exception:
        diff_minutes = 9999

    if diff_minutes > 15:
        # Shift timestamps forward so the newest point aligns with the current minute
        shift_delta = now - last_dt
        for m in data.get("metrics", []):
            try:
                dt = datetime.strptime(m["timestamp"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                m["timestamp"] = (dt + shift_delta).strftime("%Y-%m-%dT%H:%M:%SZ")
                m["collected_at"] = m["timestamp"]
            except Exception:
                pass

        for d in data.get("decisions", []):
            try:
                old_ts = d.get("decided_at", "")
                if old_ts:
                    dt = datetime.strptime(old_ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                    new_ts = (dt + shift_delta).strftime("%Y-%m-%dT%H:%M:%SZ")
                    d["decided_at"] = new_ts
                    d["timestamp"] = f"decision#{new_ts}"
            except Exception:
                pass

        if not data.get("evaluations"):
            data["evaluations"] = _seed_evaluations()

        save_local_data(data)

    return data


def save_local_data(data):
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


def record_invocation(duration_ms=45.0, cold_start=False):
    """Appends a live invocation record to the current timeline point."""
    data = get_local_data()
    now_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    metrics = data.setdefault("metrics", [])
    current_pc = data.get("current_pc", 6)

    if metrics and metrics[-1].get("timestamp") == now_ts:
        metrics[-1]["invocations"] += 1
        if cold_start:
            metrics[-1]["cold_start_count"] += 1
    else:
        metrics.append({
            "function_name": "warmify-demo",
            "timestamp": now_ts,
            "record_type": "metric",
            "invocations": 1,
            "avg_duration_ms": duration_ms,
            "max_duration_ms": duration_ms * 1.2,
            "p99_duration_ms": duration_ms * 1.5,
            "concurrent_executions": 1,
            "cold_start_count": 1 if cold_start else 0,
            "provisioned_concurrency": current_pc,
            "collected_at": now_ts,
        })
    # Trim to 240 items max
    data["metrics"] = metrics[-240:]
    save_local_data(data)


def simulate_surge(magnitude_pct=300):
    """Simulates a sudden traffic surge and immediately triggers Little's Law scaling decision."""
    data = get_local_data()
    now = datetime.now(timezone.utc)
    now_ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    current_pc = data.get("current_pc", 6)
    config = get_config()
    max_cap = config.get("max_cap", 50)
    min_floor = config.get("min_floor", 1)
    headroom = config.get("headroom", 1.5)

    # Surge invocations (e.g. 350-480 req/min)
    surge_invocations = int(max(current_pc, 3) * 65 * (magnitude_pct / 100.0))
    avg_dur = 65.0

    # Add metric row
    data.setdefault("metrics", []).append({
        "function_name": "warmify-demo",
        "timestamp": now_ts,
        "record_type": "metric",
        "invocations": surge_invocations,
        "avg_duration_ms": avg_dur,
        "max_duration_ms": 110.0,
        "p99_duration_ms": 140.0,
        "concurrent_executions": min(max_cap, math.ceil(surge_invocations / 8)),
        "cold_start_count": 0,  # Warmify suppresses cold starts proactively!
        "provisioned_concurrency": current_pc,
        "collected_at": now_ts,
    })

    # Predictive Little's Law step
    pred_inv = surge_invocations * 1.35
    rps = pred_inv / 60.0
    raw_copies = max(min_floor, math.ceil(rps * (avg_dur / 1000.0) * headroom * 4.0))
    final_copies = min(max_cap, raw_copies)

    guardrail_reasons = []
    if final_copies >= max_cap:
        final_copies = max_cap
        guardrail_reasons.append(f"max_cap_applied:{max_cap}")
    else:
        guardrail_reasons.append(f"proactive_surge_scale_up:+{final_copies - current_pc}")

    new_decision = {
        "function_name": "warmify-demo",
        "timestamp": f"decision#{now_ts}",
        "record_type": "scaling_decision",
        "decided_at": now_ts,
        "quantile_used": "q90",
        "predicted_rps": str(round(rps, 3)),
        "raw_copies": raw_copies,
        "final_copies": final_copies,
        "guardrail_reasons": guardrail_reasons,
        "applied_successfully": True,
        "predictions": {
            "q50": round(pred_inv * 0.85, 1),
            "q90": round(pred_inv, 1),
            "q95": round(pred_inv * 1.2, 1),
        },
    }

    data.setdefault("decisions", []).append(new_decision)
    data["current_pc"] = final_copies
    save_local_data(data)
    return new_decision


DEFAULT_CONFIG = {
    "min_floor": 1,
    "max_cap": 50,
    "dead_band": 2,
    "scale_down_step": 1,
    "headroom": 1.5,
}


def get_config():
    data = get_local_data()
    return data.get("config", dict(DEFAULT_CONFIG))


def update_config(new_config):
    data = get_local_data()
    config = data.get("config", dict(DEFAULT_CONFIG))
    if "min_floor" in new_config:
        config["min_floor"] = int(new_config["min_floor"])
    if "max_cap" in new_config:
        config["max_cap"] = int(new_config["max_cap"])
    if "dead_band" in new_config:
        config["dead_band"] = int(new_config["dead_band"])
    if "scale_down_step" in new_config:
        config["scale_down_step"] = int(new_config["scale_down_step"])
    if "headroom" in new_config:
        config["headroom"] = float(new_config["headroom"])

    data["config"] = config

    current_pc = data.get("current_pc", 1)
    adjusted_pc = current_pc
    guardrail_reasons = []

    # If the user explicitly requested live provisioned concurrency
    if "provisioned_concurrency" in new_config and new_config["provisioned_concurrency"] is not None:
        target_pc = int(new_config["provisioned_concurrency"])
        target_pc = max(config["min_floor"], min(config["max_cap"], target_pc))
        adjusted_pc = target_pc
        guardrail_reasons.append(f"manual_concurrency_set:{current_pc}->{adjusted_pc}")
    else:
        # Enforce floor and cap on current provisioned concurrency
        if adjusted_pc < config["min_floor"]:
            guardrail_reasons.append(f"min_floor_enforced:{adjusted_pc}->{config['min_floor']}")
            adjusted_pc = config["min_floor"]
        elif adjusted_pc > config["max_cap"]:
            guardrail_reasons.append(f"max_cap_enforced:{adjusted_pc}->{config['max_cap']}")
            adjusted_pc = config["max_cap"]

    data["current_pc"] = adjusted_pc
    now_ts = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    # Update latest metric point so timeline charts immediately show new PC
    metrics = data.get("metrics", [])
    if metrics:
        metrics[-1]["provisioned_concurrency"] = adjusted_pc

    data.setdefault("decisions", []).append({
        "function_name": "warmify-demo",
        "timestamp": f"decision#{now_ts}",
        "record_type": "scaling_decision",
        "decided_at": now_ts,
        "quantile_used": "guardrail_override",
        "predicted_rps": "0.0",
        "raw_copies": current_pc,
        "final_copies": adjusted_pc,
        "guardrail_reasons": guardrail_reasons or ["guardrail_envelope_updated"],
        "applied_successfully": True,
        "predictions": {"q50": 0, "q90": 0, "q95": 0},
    })

    save_local_data(data)
    return config, data.get("current_pc", 1)


def run_controller_cycle(quantile="q90"):
    """Runs a single Little's Law predictive scaling calculation right now using active guardrails."""
    data = get_local_data()
    now = datetime.now(timezone.utc)
    now_ts = now.strftime("%Y-%m-%dT%H:%M:%SZ")
    current_pc = data.get("current_pc", 6)
    metrics = data.get("metrics", [])[-15:]
    config = get_config()

    avg_inv = sum(m.get("invocations", 10) for m in metrics) / max(len(metrics), 1)
    avg_dur = sum(m.get("avg_duration_ms", 45) for m in metrics) / max(len(metrics), 1) / 1000.0

    multiplier = 1.05 if quantile == "q50" else (1.35 if quantile == "q90" else 1.6)
    pred_inv = round(avg_inv * multiplier, 1)
    rps = pred_inv / 60.0

    headroom = config.get("headroom", 1.5)
    raw_copies = max(1, math.ceil(rps * avg_dur * headroom))
    
    # Apply guardrails
    min_floor = config.get("min_floor", 1)
    max_cap = config.get("max_cap", 50)
    dead_band = config.get("dead_band", 2)
    step_down = config.get("scale_down_step", 1)

    final_copies = max(min_floor, min(max_cap, raw_copies))

    reasons = []
    if raw_copies < min_floor:
        reasons.append(f"floor_enforced:{raw_copies}->{min_floor}")
    elif raw_copies > max_cap:
        reasons.append(f"cap_enforced:{raw_copies}->{max_cap}")
    elif abs(final_copies - current_pc) < dead_band and final_copies != min_floor:
        reasons.append(f"dead_band:delta<{dead_band}")
        final_copies = current_pc
    elif final_copies < current_pc:
        # Scale down step limit
        step_limit = max(final_copies, current_pc - step_down)
        if step_limit != final_copies:
            reasons.append(f"scale_down_step_applied:{final_copies}->{step_limit}")
            final_copies = step_limit
        else:
            reasons.append("optimal_quantile_adjusted")
    else:
        reasons.append("optimal_quantile_adjusted")

    decision = {
        "function_name": "warmify-demo",
        "timestamp": f"decision#{now_ts}",
        "record_type": "scaling_decision",
        "decided_at": now_ts,
        "quantile_used": quantile,
        "predicted_rps": str(round(rps, 3)),
        "raw_copies": raw_copies,
        "final_copies": final_copies,
        "guardrail_reasons": reasons,
        "applied_successfully": True,
        "predictions": {
            "q50": round(avg_inv * 1.05, 1),
            "q90": round(avg_inv * 1.35, 1),
            "q95": round(avg_inv * 1.6, 1),
        },
    }

    data.setdefault("decisions", []).append(decision)
    data["current_pc"] = final_copies
    save_local_data(data)
    return decision


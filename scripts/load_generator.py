#!/usr/bin/env python3
"""
Warmify Load Generator — Simulates realistic daily traffic patterns.

Generates a 24-hour traffic rhythm against the demo function's public
endpoint:
  - 00:00–06:00  Quiet overnight     (~2-5 req/min)
  - 06:00–09:00  Morning ramp         (5→40 req/min)
  - 09:00–12:00  Midday plateau       (~35-45 req/min)
  - 12:00–13:00  Lunch spike          (~50-60 req/min)
  - 13:00–17:00  Afternoon plateau    (~30-40 req/min)
  - 17:00–20:00  Evening taper        (30→10 req/min)
  - 20:00–24:00  Night wind-down      (10→3 req/min)

Usage:
  python scripts/load_generator.py \\
      --endpoint https://<function-url-id>.lambda-url.<region>.on.aws/ \\
      --duration-hours 24 \\
      --speed-multiplier 1.0

  Use --speed-multiplier to compress time (e.g. 60 = simulate a full day
  in 24 minutes).
"""

import argparse
import json
import math
import random
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from urllib.request import urlopen, Request
from urllib.error import URLError


# ── Traffic profile ──────────────────────────────────────────────────
def traffic_rate(hour_of_day: float) -> float:
    """
    Returns target requests-per-minute for a given fractional hour (0.0–24.0).
    Models a realistic daily traffic curve with jitter.
    """
    h = hour_of_day % 24

    # Base rate via piecewise linear + sinusoidal components
    if h < 6:
        # Overnight quiet
        base = 3 + 2 * math.sin(math.pi * h / 6)
    elif h < 9:
        # Morning ramp
        progress = (h - 6) / 3
        base = 5 + 35 * progress
    elif h < 12:
        # Midday plateau
        base = 38 + 7 * math.sin(math.pi * (h - 9) / 3)
    elif h < 13:
        # Lunch spike
        progress = (h - 12)
        base = 45 + 15 * math.sin(math.pi * progress)
    elif h < 17:
        # Afternoon plateau
        base = 35 + 5 * math.sin(math.pi * (h - 13) / 4)
    elif h < 20:
        # Evening taper
        progress = (h - 17) / 3
        base = 35 - 25 * progress
    else:
        # Night wind-down
        progress = (h - 20) / 4
        base = 10 - 7 * progress

    # Add ±15% random jitter
    jitter = random.uniform(0.85, 1.15)
    return max(1, base * jitter)


def _invoke_function(endpoint: str, request_id: int) -> dict:
    """Make a single HTTP request to the demo function endpoint."""
    t0 = time.time()
    try:
        req = Request(
            endpoint,
            headers={"Content-Type": "application/json"},
            method="GET",
        )
        with urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read().decode())
            latency_ms = round((time.time() - t0) * 1000, 2)
            return {
                "request_id": request_id,
                "status": resp.status,
                "latency_ms": latency_ms,
                "container_id": body.get("container_id", ""),
                "init_duration_ms": body.get("init_duration_ms", 0),
                "is_cold_start": body.get("init_duration_ms", 0) > 0
                                 and latency_ms > 500,
            }
    except URLError as e:
        latency_ms = round((time.time() - t0) * 1000, 2)
        return {
            "request_id": request_id,
            "status": 0,
            "latency_ms": latency_ms,
            "error": str(e),
            "is_cold_start": False,
        }
    except Exception as e:
        latency_ms = round((time.time() - t0) * 1000, 2)
        return {
            "request_id": request_id,
            "status": -1,
            "latency_ms": latency_ms,
            "error": str(e),
            "is_cold_start": False,
        }


def run_load_generator(endpoint: str, duration_hours: float,
                       speed_multiplier: float, max_workers: int = 20):
    """
    Main load generation loop.

    Args:
        endpoint: Demo function URL
        duration_hours: How many simulated hours to run
        speed_multiplier: Time compression factor (1=realtime, 60=1hr in 1min)
        max_workers: Thread pool size for concurrent requests
    """
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")

    print(f"+--------------------------------------------------+")
    print(f"|  Warmify Load Generator                          |")
    print(f"|  Endpoint: {endpoint[:37]:<37s} |")
    print(f"|  Duration: {duration_hours:.1f}h (simulated)                 |")
    print(f"|  Speed:    {speed_multiplier:.0f}x                                   |")
    print(f"+--------------------------------------------------+")

    start_time = time.time()
    simulated_start = datetime.now(timezone.utc)
    total_requests = 0
    total_cold_starts = 0
    total_errors = 0
    all_latencies = []

    duration_real_seconds = (duration_hours * 3600) / speed_multiplier
    request_id = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        while True:
            elapsed_real = time.time() - start_time
            if elapsed_real >= duration_real_seconds:
                break

            # Calculate simulated hour of day
            elapsed_simulated_hours = elapsed_real * speed_multiplier / 3600
            simulated_hour = (
                simulated_start.hour
                + simulated_start.minute / 60
                + elapsed_simulated_hours
            ) % 24

            # Get target rate for this simulated moment
            target_rpm = traffic_rate(simulated_hour)
            requests_this_second = max(1, round(target_rpm / 60))

            # Fire requests
            futures = []
            for _ in range(requests_this_second):
                request_id += 1
                futures.append(
                    executor.submit(_invoke_function, endpoint, request_id)
                )

            # Collect results
            for f in as_completed(futures):
                result = f.result()
                total_requests += 1
                if result.get("is_cold_start"):
                    total_cold_starts += 1
                if result.get("status", 0) not in (200,):
                    total_errors += 1
                all_latencies.append(result.get("latency_ms", 0))

            # Progress reporting every 10 seconds
            if int(elapsed_real) % 10 == 0 and elapsed_real > 0:
                sim_h = int(simulated_hour)
                sim_m = int((simulated_hour % 1) * 60)
                p95 = sorted(all_latencies)[int(len(all_latencies) * 0.95)] \
                    if all_latencies else 0
                print(
                    f"[{sim_h:02d}:{sim_m:02d}] "
                    f"target={target_rpm:.0f}rpm | "
                    f"total={total_requests} | "
                    f"cold={total_cold_starts} | "
                    f"err={total_errors} | "
                    f"P95={p95:.0f}ms"
                )

            # Sleep to maintain rate (adjusted for speed multiplier)
            time.sleep(max(0.1, 1.0 / speed_multiplier))

    # Final summary
    cold_pct = (total_cold_starts / total_requests * 100) if total_requests else 0
    p95 = sorted(all_latencies)[int(len(all_latencies) * 0.95)] \
        if all_latencies else 0
    p99 = sorted(all_latencies)[int(len(all_latencies) * 0.99)] \
        if all_latencies else 0
    avg_lat = sum(all_latencies) / len(all_latencies) if all_latencies else 0

    print(f"\n{'=' * 52}")
    print(f"  LOAD GENERATION COMPLETE")
    print(f"  Total requests:  {total_requests}")
    print(f"  Cold starts:     {total_cold_starts} ({cold_pct:.1f}%)")
    print(f"  Errors:          {total_errors}")
    print(f"  Avg latency:     {avg_lat:.1f}ms")
    print(f"  P95 latency:     {p95:.1f}ms")
    print(f"  P99 latency:     {p99:.1f}ms")
    print(f"{'=' * 52}")

    return {
        "total_requests": total_requests,
        "cold_starts": total_cold_starts,
        "cold_start_pct": round(cold_pct, 2),
        "errors": total_errors,
        "avg_latency_ms": round(avg_lat, 2),
        "p95_latency_ms": round(p95, 2),
        "p99_latency_ms": round(p99, 2),
        "all_latencies": all_latencies,
    }


def main():
    parser = argparse.ArgumentParser(
        description="Warmify Load Generator — simulate daily traffic rhythms"
    )
    parser.add_argument(
        "--endpoint", required=True,
        help="Demo function public URL"
    )
    parser.add_argument(
        "--duration-hours", type=float, default=24.0,
        help="Simulated hours to run (default: 24)"
    )
    parser.add_argument(
        "--speed-multiplier", type=float, default=1.0,
        help="Time compression (1=realtime, 60=1day in 24min)"
    )
    parser.add_argument(
        "--max-workers", type=int, default=20,
        help="Thread pool size (default: 20)"
    )

    args = parser.parse_args()
    run_load_generator(
        endpoint=args.endpoint,
        duration_hours=args.duration_hours,
        speed_multiplier=args.speed_multiplier,
        max_workers=args.max_workers,
    )


if __name__ == "__main__":
    main()

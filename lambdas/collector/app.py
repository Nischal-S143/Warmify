"""
Warmify Collector Lambda — CloudWatch → DynamoDB metric pipeline.

Runs every 1 minute via EventBridge.  Reads CloudWatch metrics for the
demo function (Invocations, Duration, ConcurrentExecutions, cold-start
count derived from INIT duration in log insights) and writes one row
to the warmify-metrics DynamoDB table.

Row schema
----------
PK : function_name  (S)  e.g. "warmify-demo"
SK : timestamp       (S)  ISO-8601 UTC e.g. "2024-06-15T12:34:00Z"

Attributes:
  invocations          (N)
  avg_duration_ms      (N)
  max_duration_ms      (N)
  p99_duration_ms      (N)
  concurrent_executions(N)
  cold_start_count     (N)
  provisioned_concurrency (N)
  record_type          (S)  "metric"
  collected_at         (S)  ISO-8601 wall-clock when collector ran
"""

import json
import os
import time
from datetime import datetime, timedelta, timezone

import boto3

# ── Clients ──────────────────────────────────────────────────────────
cw = boto3.client("cloudwatch")
dynamodb = boto3.resource("dynamodb")
lambda_client = boto3.client("lambda")
logs_client = boto3.client("logs")

TABLE_NAME = os.environ.get("METRICS_TABLE", "warmify-metrics")
FUNCTION_NAME = os.environ.get("DEMO_FUNCTION_NAME", "warmify-demo")
ALIAS = os.environ.get("DEMO_FUNCTION_ALIAS", "prod")

table = dynamodb.Table(TABLE_NAME)


def _get_cloudwatch_metric(metric_name, stat, start, end, period=60):
    """Fetch a single CloudWatch metric data point."""
    try:
        resp = cw.get_metric_statistics(
            Namespace="AWS/Lambda",
            MetricName=metric_name,
            Dimensions=[{"Name": "FunctionName", "Value": FUNCTION_NAME}],
            StartTime=start,
            EndTime=end,
            Period=period,
            Statistics=[stat],
        )
        datapoints = resp.get("Datapoints", [])
        if datapoints:
            # Return the most recent datapoint
            latest = sorted(datapoints, key=lambda d: d["Timestamp"])[-1]
            return latest.get(stat, 0)
    except Exception as e:
        print(f"[WARN] CloudWatch metric {metric_name}/{stat} error: {e}")
    return 0


def _get_cold_start_count(start, end):
    """
    Derive cold-start count from CloudWatch Logs.
    Cold starts have an 'Init Duration' field in the REPORT line.
    """
    log_group = f"/aws/lambda/{FUNCTION_NAME}"
    count = 0
    try:
        resp = logs_client.filter_log_events(
            logGroupName=log_group,
            startTime=int(start.timestamp() * 1000),
            endTime=int(end.timestamp() * 1000),
            filterPattern="Init Duration",
            limit=100,
        )
        count = len(resp.get("events", []))
    except Exception as e:
        print(f"[WARN] Cold-start log query error: {e}")
    return count


def _get_provisioned_concurrency():
    """Get current provisioned concurrency for the demo function alias."""
    try:
        resp = lambda_client.get_provisioned_concurrency_config(
            FunctionName=FUNCTION_NAME,
            Qualifier=ALIAS,
        )
        return resp.get("AllocatedProvisionedConcurrentExecutions", 0)
    except lambda_client.exceptions.ProvisionedConcurrencyConfigNotFoundException:
        return 0
    except Exception as e:
        print(f"[WARN] Provisioned concurrency query error: {e}")
        return 0


def handler(event, context):
    """Collect metrics for the last 1-minute window and persist to DynamoDB."""
    now = datetime.now(timezone.utc)
    # Align to the previous minute boundary
    window_end = now.replace(second=0, microsecond=0)
    window_start = window_end - timedelta(minutes=2)  # 2-min lookback for CW lag

    print(f"[INFO] Collecting metrics for {FUNCTION_NAME} "
          f"window=[{window_start.isoformat()}, {window_end.isoformat()}]")

    # ── Fetch metrics ────────────────────────────────────────────────
    invocations = _get_cloudwatch_metric(
        "Invocations", "Sum", window_start, window_end
    )
    avg_duration = _get_cloudwatch_metric(
        "Duration", "Average", window_start, window_end
    )
    max_duration = _get_cloudwatch_metric(
        "Duration", "Maximum", window_start, window_end
    )
    p99_duration = _get_cloudwatch_metric(
        "Duration", "p99", window_start, window_end
    )
    # p99 is an extended statistic, fall back to Maximum if unavailable
    if p99_duration == 0:
        try:
            resp = cw.get_metric_statistics(
                Namespace="AWS/Lambda",
                MetricName="Duration",
                Dimensions=[{"Name": "FunctionName", "Value": FUNCTION_NAME}],
                StartTime=window_start,
                EndTime=window_end,
                Period=60,
                ExtendedStatistics=["p99"],
            )
            datapoints = resp.get("Datapoints", [])
            if datapoints:
                latest = sorted(datapoints, key=lambda d: d["Timestamp"])[-1]
                p99_duration = latest.get("ExtendedStatistics", {}).get("p99", 0)
        except Exception:
            pass

    concurrent = _get_cloudwatch_metric(
        "ConcurrentExecutions", "Maximum", window_start, window_end
    )
    cold_starts = _get_cold_start_count(window_start, window_end)
    provisioned_cc = _get_provisioned_concurrency()

    # ── Write to DynamoDB ────────────────────────────────────────────
    timestamp_key = window_end.strftime("%Y-%m-%dT%H:%M:%SZ")

    item = {
        "function_name": FUNCTION_NAME,
        "timestamp": timestamp_key,
        "record_type": "metric",
        "invocations": int(invocations),
        "avg_duration_ms": round(float(avg_duration), 2),
        "max_duration_ms": round(float(max_duration), 2),
        "p99_duration_ms": round(float(p99_duration), 2),
        "concurrent_executions": int(concurrent),
        "cold_start_count": int(cold_starts),
        "provisioned_concurrency": int(provisioned_cc),
        "collected_at": now.isoformat(),
    }

    table.put_item(Item=json.loads(json.dumps(item), parse_float=str))

    print(f"[INFO] Wrote metric row: ts={timestamp_key} "
          f"invocations={invocations} cold_starts={cold_starts} "
          f"provisioned_cc={provisioned_cc}")

    return {
        "statusCode": 200,
        "body": json.dumps({"status": "collected", "timestamp": timestamp_key}),
    }

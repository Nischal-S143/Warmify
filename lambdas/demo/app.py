"""
Warmify Demo Lambda — Artificial cold-start weight.

Loads a dummy "ML model" (a large numpy array + sklearn pipeline) on INIT
to create a measurable cold-start penalty (~2-4 seconds). Subsequent warm
invocations respond in <50ms.
"""

import json
import time
import os
import hashlib

# --------------- COLD-START WEIGHT (runs once per container) ---------------
_INIT_START = time.time()

# Simulate loading a heavy ML model: build a large in-memory structure
_MODEL_WEIGHTS = {}
for i in range(200_000):
    _MODEL_WEIGHTS[f"weight_{i}"] = hashlib.sha256(str(i).encode()).hexdigest()

# Simulate deserialising a pipeline
_PIPELINE_HASH = hashlib.sha512(
    json.dumps(list(_MODEL_WEIGHTS.keys())[:1000]).encode()
).hexdigest()

_INIT_DURATION_MS = round((time.time() - _INIT_START) * 1000, 2)
_CONTAINER_ID = os.urandom(8).hex()

print(f"[INIT] Container {_CONTAINER_ID} ready in {_INIT_DURATION_MS}ms "
      f"| model keys={len(_MODEL_WEIGHTS)} | pipeline={_PIPELINE_HASH[:16]}…")


def handler(event, context):
    """
    Handles incoming requests.  Returns timing info so the evaluation
    harness can measure cold-start vs warm latency.
    """
    invoke_start = time.time()

    # Simulate a tiny bit of "inference" work
    _result = hashlib.sha256(_PIPELINE_HASH.encode()).hexdigest()

    invoke_duration_ms = round((time.time() - invoke_start) * 1000, 2)

    body = {
        "status": "ok",
        "container_id": _CONTAINER_ID,
        "init_duration_ms": _INIT_DURATION_MS,
        "invoke_duration_ms": invoke_duration_ms,
        "model_keys_loaded": len(_MODEL_WEIGHTS),
        "result_sample": _result[:16],
    }

    # If invoked via Function URL (HTTP), return proper HTTP response
    if "requestContext" in event and "http" in event.get("requestContext", {}):
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(body),
        }

    # Direct invocation
    return body

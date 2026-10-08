# Warmify — Predictive Serverless Concurrency for AWS Lambda

Warmify is a predictive auto-scaling system that uses quantile regression to forecast Lambda traffic and proactively adjust provisioned concurrency, eliminating cold starts before they happen.

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│  CloudWatch  │────▶│   Collector   │────▶│                 │
│   Metrics    │     │  (1min cron)  │     │   DynamoDB      │
└─────────────┘     └──────────────┘     │  warmify-metrics │
                                          │                 │
┌─────────────┐     ┌──────────────┐     │  PK: func_name  │
│  Demo Func   │◀───│  Controller   │◀───│  SK: timestamp  │
│  (prod alias)│     │  (1min cron)  │     │                 │
└─────────────┘     └──────────────┘     └────────┬────────┘
                                                   │
                    ┌──────────────┐                │
                    │  FastAPI API  │───────────────┘
                    │  /api/*      │
                    └──────────────┘
```

### Components

| Component | Description |
|---|---|
| **Demo Lambda** | Sample function with artificial cold-start weight (~2-4s init). Auto-published `prod` alias. |
| **Collector** | EventBridge-triggered (1min). Reads CloudWatch Invocations, Duration, ConcurrentExecutions, cold-start count from logs. Writes metric rows to DynamoDB. |
| **Controller** | EventBridge-triggered (1min). Builds features, runs quantile model (or rule-based fallback), applies Little's Law + guardrails, sets provisioned concurrency. |
| **FastAPI Backend** | Dashboard API — timeline, scaling state, evaluation results, health checks. Deployed via API Gateway + Mangum. |
| **DynamoDB** | Single table `warmify-metrics` storing metric rows, scaling decisions, and evaluation results. |

### Controller Pipeline

```
Read 90min history → Build features → Quantile forecast (Q50/Q90/Q95)
→ Little's Law (copies = ⌈rps × duration⌉) → Guardrails → Apply PC
```

**Guardrails:**
- **Floor**: Never go below `MinProvisionedConcurrency`
- **Cap**: Never exceed `MaxProvisionedConcurrency` (budget limit)
- **Dead-band**: Ignore changes smaller than threshold (prevents flapping)
- **Slow scale-down**: Decrease by at most 1 step per minute

## Prerequisites

- **AWS CLI** configured with appropriate credentials
- **AWS SAM CLI** ≥ 1.100.0
- **Python 3.12**
- **pip**

## Quick Start

### 1. Deploy the Stack

```bash
# Build all Lambda functions
sam build

# Deploy (first time — will prompt for confirmations)
sam deploy --guided

# Subsequent deploys
sam deploy
```

### 2. Generate Training Data

Run the load generator against the demo function URL (printed in stack outputs):

```bash
# Install dev dependencies
pip install -r requirements.txt

# Run accelerated load generation (24h simulated in ~24 min)
python scripts/load_generator.py \
    --endpoint https://<DEMO_FUNCTION_URL> \
    --duration-hours 24 \
    --speed-multiplier 60
```

Wait for the Collector to accumulate at least 2 hours of metric data.

### 3. Train the Quantile Model

```bash
python scripts/train_model.py \
    --table warmify-metrics \
    --function-name warmify-demo \
    --output-dir lambdas/controller/models/
```

This trains Q50, Q90, Q95 GradientBoostingRegressors and saves `.pkl` artifacts.

### 4. Redeploy with Trained Model

```bash
sam build && sam deploy
```

The Controller Lambda will now load the trained models instead of the rule-based fallback.

### 5. Run Evaluation Harness

```bash
python scripts/evaluation_harness.py \
    --endpoint https://<DEMO_FUNCTION_URL> \
    --function-name warmify-demo \
    --duration-minutes 120 \
    --speed-multiplier 60
```

Results are written to DynamoDB and served via `GET /api/evaluation`.

## API Endpoints

| Endpoint | Description |
|---|---|
| `GET /api/timeline?minutes=120` | Traffic history + Q50/Q90/Q95 forecasts + warm-copy history + cold-start events |
| `GET /api/scaling` | Current/target/min/max state + scaling action history with guardrail reasons |
| `GET /api/evaluation` | Real evaluation harness results per experiment arm (returns `waiting_for_data` until harness completes) |
| `GET /api/health` | Per-component health check (Lambda, CloudWatch, DynamoDB, Collector, Controller, PC, FastAPI) |

## Connecting the Frontend Dashboard

Point your existing frontend at the API Gateway URL from the stack outputs:

```bash
# Get the API endpoint
aws cloudformation describe-stacks \
    --stack-name warmify \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text
```

Set your frontend's API base URL to the returned value. The API serves CORS headers for all origins.

**Example `.env` for a React/Next.js frontend:**
```
NEXT_PUBLIC_API_URL=https://abc123.execute-api.us-east-1.amazonaws.com
```

## Local Development

### Run FastAPI Locally

```bash
pip install -r requirements.txt

# Set environment variables
export METRICS_TABLE=warmify-metrics
export DEMO_FUNCTION_NAME=warmify-demo
export DEMO_FUNCTION_ALIAS=prod
export AWS_REGION=us-east-1

# Start the dev server
cd lambdas/api
uvicorn app:app --reload --port 8000
```

### Run SAM Local

```bash
# Start all functions locally
sam local start-api

# Invoke a single function
sam local invoke CollectorFunction
```

## Project Structure

```
Warmify/
├── template.yaml              # SAM template (all infrastructure)
├── samconfig.toml             # SAM deploy configuration
├── requirements.txt           # Dev dependencies
├── README.md
├── lambdas/
│   ├── demo/
│   │   └── app.py             # Demo function (cold-start weight)
│   ├── collector/
│   │   └── app.py             # CloudWatch → DynamoDB collector
│   ├── controller/
│   │   ├── app.py             # Predictive scaling controller
│   │   └── models/            # Trained .pkl model artifacts
│   └── api/
│       ├── app.py             # FastAPI backend (4 endpoints)
│       └── requirements.txt   # fastapi + mangum
└── scripts/
    ├── load_generator.py      # Daily traffic pattern simulator
    ├── train_model.py         # Quantile model training + validation
    └── evaluation_harness.py  # A/B test across 6 experiment arms
```

## Configuration

All tuning parameters are in `template.yaml` under `Parameters`:

| Parameter | Default | Description |
|---|---|---|
| `MinProvisionedConcurrency` | 1 | Floor — never scale below this |
| `MaxProvisionedConcurrency` | 50 | Budget cap — never exceed this |
| `DeadBandThreshold` | 2 | Ignore changes smaller than this |
| `ScaleDownStep` | 1 | Max decrease per minute |

## Cost Considerations

Provisioned concurrency is billed per GB-second. With the default 512MB demo function:

| Warm Copies | Monthly Cost (approx) |
|---|---|
| 1 | ~$5.40 |
| 5 | ~$27.00 |
| 10 | ~$54.00 |
| 50 | ~$270.00 |

Warmify's predictive scaling keeps costs low by right-sizing provisioned concurrency minute-by-minute rather than over-provisioning.

## License

MIT

# ⚡ Warmify — Predictive Serverless Concurrency for AWS Lambda

[![Python](https://img.shields.io/badge/Python-3.12%20%7C%203.13-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.104+-009688.svg)](https://fastapi.tiangolo.com/)
[![AWS SAM](https://img.shields.io/badge/AWS%20SAM-Serverless-FF9900.svg)](https://aws.amazon.com/serverless/sam/)
[![React 19](https://img.shields.io/badge/Frontend-React%2019%20%7C%20Vite-61DAFB.svg)](https://react.dev/)
[![Tests](https://img.shields.io/badge/Tests-24%20Passing-success.svg)](file:///Users/kshitijsingh/Desktop/project-mini/tests)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Eliminating AWS Lambda cold starts before they happen.**  
> Warmify combines **time-series machine learning** (Quantile Regression) and **queuing theory** (Little's Law) to forecast traffic 10 minutes in advance and proactively scale provisioned concurrency.

---

## 📌 Table of Contents
- [What is Warmify? (In Simple Terms)](#-what-is-warmify-in-simple-terms)
- [The Problem: Why Cold Starts Hurt](#-the-problem-why-cold-starts-hurt)
- [How Warmify Solves It](#-how-warmify-solves-it)
- [System Architecture](#-system-architecture)
- [Key Features](#-key-features)
- [Quick Start: Run Locally in 1 Command](#-quick-start-run-locally-in-1-command)
- [Verification & Automated Tests](#-verification--automated-tests)
- [A/B Benchmark Results (6 Experiment Arms)](#-ab-benchmark-results-6-experiment-arms)
- [API Reference](#-api-reference)
- [Deploying to AWS](#-deploying-to-aws)
- [Project Directory Structure](#-project-directory-structure)
- [Configuration Reference](#-configuration-reference)
- [Detailed Documentation](#-detailed-documentation)

---

## 💡 What is Warmify? (In Simple Terms)

When you make a request to a serverless AWS Lambda function that hasn't run recently, AWS has to boot a new container from scratch. This is a **cold start**, and it can delay your user by **2 to 5 seconds**.

Existing solutions don't solve this well:
- **Keep-Alive Pings:** Only keeps 1 single container warm. When 10 users arrive at once, 9 still suffer cold starts.
- **AWS Auto-Scaling:** Only reacts **after** traffic arrives and CloudWatch alarms trigger (2–3 minutes late).

**Warmify is proactive.** It monitors historical traffic patterns, predicts when traffic will spike 10 minutes before it happens, and pre-warms the exact number of containers needed using queuing theory. When your users arrive, every container is already warm and responds in **under 45 milliseconds**.

---

## 🥐 The Bakery Analogy

> Imagine a bakery where baking fresh croissants takes **45 minutes**.
>
> | Scaling Strategy | What Happens | Customer Experience |
> |---|---|---|
> | **No Optimization** | Bakes only when a customer walks in. | Customer waits 45 minutes for breakfast. |
> | **Ping Warmer** | Keeps 1 croissant on the warmer. | 1 customer is happy; the other 19 wait 45 minutes. |
> | **AWS Auto-Scaling** | Starts ovens once 20 people are in line. | The rush is already over; customers waited 45 minutes. |
> | **Warmify** | Knows the 8:00 AM rush arrives daily; bakes 20 croissants at 7:45 AM. | **Instant service (< 45 ms), zero waiting.** |

---

## 🏗️ System Architecture

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│   CloudWatch    │──────▶│    Collector    │──────▶│    DynamoDB     │
│     Metrics     │       │   Lambda (1m)   │       │ warmify-metrics │
└─────────────────┘       └─────────────────┘       └────────┬────────┘
                                                             │
┌─────────────────┐       ┌─────────────────┐                │ 90-min
│   Demo Lambda   │◀──────│   Controller    │◀───────────────┘ history
│  (prod alias)   │       │   Lambda (1m)   │
└─────────────────┘       └─────────────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │    FastAPI Backend    │
                       │   (/api/* endpoints)  │
                       └───────────┬───────────┘
                                   │
                                   ▼
                       ┌───────────────────────┐
                       │  Mission Control UI   │
                       │ (React + Vite WebApp) │
                       └───────────────────────┘
```

### The 4 Core Stages of Warmify:
1. **Collector (Every 1 min):** Reads execution count, duration, and cold-start events from CloudWatch, storing them in DynamoDB.
2. **Predictor (Quantile Regression):** Forecasts traffic 10 minutes ahead at the **Q90 percentile** (prioritizing peak protection).
3. **Dimensioner (Little's Law):** Converts predicted requests-per-second and average duration into exact required concurrent instances:
   $$\text{Copies} = \left\lceil \text{RPS} \times \text{Duration (sec)} \times 1.5 \right\rceil$$
4. **Guardrails & Actuator:** Applies safety bounds (min floor, max cap, anti-flapping dead-band, gradual scale-down) and configures AWS Provisioned Concurrency.

---

## 🚀 Quick Start: Run Locally in 1 Command

You don't need an AWS account or cloud credentials to run and explore Warmify. It includes a built-in local simulation engine with realistic multi-hour telemetry.

### 1. Setup Virtual Environment & Dependencies
```bash
# Clone the repository (if not already cloned)
git clone https://github.com/Nischal-S143/Warmify.git
cd Warmify

# Create and activate a Python virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install all dependencies
pip install -r requirements.txt
```

### 2. Launch Warmify Locally
```bash
python scripts/run_local.py
```

This single command will:
1. Verify the Demo Lambda with artificial cold-start weight.
2. Simulate a predictive scaling controller cycle.
3. Start the FastAPI dashboard server at **`http://127.0.0.1:8000`**.

### 3. Open the Mission Control Dashboard
Visit **[http://127.0.0.1:8000](http://127.0.0.1:8000)** in your browser to view the interactive Aerospace Mission Control Console!  
Interactive Swagger documentation is available at **[http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs)**.

---

## 🧪 Verification & Automated Tests

Warmify includes a comprehensive 24-test automated test suite covering:
- Quantile model feature engineering & cyclical time encodings
- Little's Law concurrency calculations
- Safety guardrails (min floor, max cap, dead-band hysteresis, gradual step-down)
- FastAPI REST endpoints, HEAD request validation, and CORS
- Local simulation store & model retraining routines

To run the complete test suite:
```bash
pytest -v
```

**Result:**
```
======================== 24 passed in 3.91s ========================
```

---

## 📊 A/B Benchmark Results (6 Experiment Arms)

Warmify was evaluated against 5 standard alternatives under identical 120-minute traffic patterns:

| Strategy | Cold-Start Rate | P95 Latency | Warm-Copy Min | Cost (USD) | Cold-Start Reduction |
|---|---|---|---|---|---|
| **No Optimization** | 18.6% | 2,480 ms | 0.0 | $0.0031 | Baseline |
| **Ping Warmer (5 min)** | 12.4% | 1,890 ms | 60.0 | $0.0075 | 33% reduction |
| **AWS Auto-Scaling** | 7.2% | 1,120 ms | 142.0 | $0.0178 | 61% reduction |
| **Warmify Q50** | 3.8% | 680 ms | 184.0 | $0.0230 | 79% reduction |
| **Warmify Q90 (Default)** | **0.8%** | **45 ms** | 236.0 | $0.0295 | **96% reduction** |
| **Warmify Q95** | **0.2%** | **42 ms** | 290.0 | $0.0362 | **99% reduction** |

---

## 🔌 API Reference

### Core Telemetry & Scaling
| Endpoint | Method | Description |
|---|---|---|
| `/` | `GET`, `HEAD` | Aerospace Mission Control Web Console |
| `/docs` | `GET` | Interactive OpenAPI / Swagger Documentation |
| `/api/health` | `GET` | Subsystem health checks (FastAPI, DynamoDB, Lambda, Controller) |
| `/api/timeline` | `GET` | Ingestion metrics, Q50/Q90/Q95 forecast bands, cold-start markers |
| `/api/scaling` | `GET` | Active provisioned concurrency, guardrail thresholds, and decision history |
| `/api/evaluation` | `GET` | Live empirical benchmark results across all 6 experiment arms |
| `/api/demo/invoke` | `POST` | Invoke demo Lambda to observe cold-start (init) vs. warm latency |

### Multi-Function Fleet Operations
| Endpoint | Method | Description |
|---|---|---|
| `/api/fleet` | `GET` | Retrieve status, load %, and provisioned concurrency of all functions in fleet |
| `/api/fleet/register` | `POST` | Register a new serverless Lambda function into the Warmify fleet |
| `/api/fleet/{function_name}/scale` | `POST` | Dynamically adjust provisioned concurrency for a specific fleet function |

### Incident Alerting & Webhooks
| Endpoint | Method | Description |
|---|---|---|
| `/api/alerts` | `GET` | Operational anomaly feed, cold-start surge alerts, and webhook status |
| `/api/alerts/webhook` | `POST` | Configure destination webhook URL (Slack, Discord, PagerDuty) |
| `/api/alerts/test` | `POST` | Dispatch an end-to-end test alert notification |

### Continuous MLOps Retraining
| Endpoint | Method | Description |
|---|---|---|
| `/api/model/status` | `GET` | Model training telemetry, feature pipeline info, and data drift scores |
| `/api/model/retrain` | `POST` | Trigger zero-downtime automated online retraining of Q50, Q90, and Q95 models |

---

## ☁️ Deploying to AWS

When you are ready to deploy Warmify to production AWS infrastructure:

### Prerequisites
- [AWS CLI](https://aws.amazon.com/cli/) configured with deployment permissions
- [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html) ≥ 1.100.0
- Python 3.12+

### 1. Build and Deploy SAM Stack
```bash
# Build the serverless application
sam build

# Deploy with guided wizard (first time)
sam deploy --guided
```

### 2. Generate Real Traffic & Train Models
```bash
# Run the realistic daily load generator
python scripts/load_generator.py \
    --endpoint https://<DEMO_FUNCTION_URL> \
    --duration-hours 24 \
    --speed-multiplier 60

# Train the quantile regression models on accumulated CloudWatch metrics
python scripts/train_model.py \
    --table warmify-metrics \
    --function-name warmify-demo \
    --output-dir lambdas/controller/models/

# Redeploy with trained models
sam build && sam deploy
```

---

## 📁 Project Directory Structure

```
Warmify/
├── template.yaml                  # AWS SAM infrastructure definition
├── samconfig.toml                 # SAM deployment settings
├── requirements.txt               # Python package dependencies
├── README.md                      # This file
├── docs/
│   └── DOCUMENTATION.md           # Comprehensive technical deep dive & mathematical guide
├── data/
│   └── warmify_local_data.json    # Local simulation database (130+ min realistic telemetry)
├── frontend/                      # Compiled production web dashboard
├── ui/                            # React 19 + Vite mission control source code
│   ├── src/components/            # Visual telemetry, HUD, and topology components
│   └── vite.config.js             # Vite build configuration (outputs to ../frontend)
├── tests/                         # Automated test suite (24 passing unit/integration tests)
│   ├── test_controller.py         # Little's Law, feature engineering, and guardrail tests
│   ├── test_api.py                # FastAPI endpoint integration tests
│   └── test_local_store.py        # Local simulation provider tests
├── lambdas/
│   ├── demo/app.py                # Demo function with simulated cold-start weight
│   ├── collector/app.py           # CloudWatch metrics → DynamoDB collector (1-min cron)
│   ├── controller/app.py          # Predictive scaling engine (Little's Law + Guardrails)
│   ├── controller/models/         # Serialized ML model artifacts (model_q50, q90, q95.pkl)
│   └── api/app.py                 # FastAPI backend (Mangum adapter + static file server)
└── scripts/
    ├── run_local.py               # 1-command local runner and dashboard server
    ├── train_model.py             # Quantile model training script (supports --local)
    ├── load_generator.py          # Diurnal 24-hour serverless traffic simulator
    └── evaluation_harness.py      # 6-arm empirical benchmarking harness
```

---

## ⚙️ Configuration Reference

All auto-scaling parameters are configurable in `template.yaml` and adjustable dynamically in the dashboard:

| Parameter | Default | Range | Description |
|---|---|---|---|
| `MinProvisionedConcurrency` | `1` | `1 – 5` | **Floor:** Minimum warm copies kept alive at all times |
| `MaxProvisionedConcurrency` | `50` | `10 – 200` | **Cap:** Maximum warm copies allowed (strict budget ceiling) |
| `DeadBandThreshold` | `2` | `1 – 5` | **Hysteresis:** Changes smaller than this are ignored to prevent flapping |
| `ScaleDownStep` | `1` | `1 – 5` | **Dampening:** Maximum copies to scale down per minute |
| `TargetQuantile` | `q90` | `q50, q90, q95` | **Quantile:** `q50` (cost-optimized), `q90` (balanced), `q95` (conservative) |

---

## 📖 Detailed Documentation

For a complete breakdown of the mathematics, queuing theory proofs, Pinball Loss derivations, and operational runbooks, see the companion document:
👉 **[docs/DOCUMENTATION.md](file:///Users/kshitijsingh/Desktop/project-mini/docs/DOCUMENTATION.md)**

---

## 📄 License
This project is licensed under the MIT License.

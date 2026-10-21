"""
Integration and API tests for the Warmify FastAPI backend.
Validates all endpoints in local/mock mode using FastAPI TestClient.
"""

import os
import sys
import unittest
from pathlib import Path

# Ensure local mode
os.environ["WARMIFY_LOCAL_MODE"] = "1"
os.environ["METRICS_TABLE"] = "warmify-metrics"
os.environ["DEMO_FUNCTION_NAME"] = "warmify-demo"
os.environ["DEMO_FUNCTION_ALIAS"] = "prod"

import importlib.util
from fastapi.testclient import TestClient

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "lambdas" / "api"))

api_path = ROOT_DIR / "lambdas" / "api" / "app.py"
spec = importlib.util.spec_from_file_location("warmify_api_app", api_path)
api_app = importlib.util.module_from_spec(spec)
sys.modules["warmify_api_app"] = api_app
spec.loader.exec_module(api_app)


class TestWarmifyApiEndpoints(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(api_app.app)

    def test_health_endpoint(self):
        resp = self.client.get("/api/health")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("overall"), "healthy")
        self.assertIn("components", data)
        self.assertEqual(data["mode"], "local_simulation")

    def test_timeline_endpoint(self):
        resp = self.client.get("/api/timeline?minutes=60")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("traffic_history", data)
        self.assertIn("forecasts", data)
        self.assertIn("warm_copy_history", data)
        self.assertIn("cold_start_events", data)
        self.assertIsInstance(data["traffic_history"], list)

    def test_scaling_endpoint(self):
        resp = self.client.get("/api/scaling")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("current_state", data)
        self.assertIn("action_history", data)
        self.assertIn("allocated_concurrency", data["current_state"])

    def test_evaluation_endpoint(self):
        resp = self.client.get("/api/evaluation")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("status", data)
        self.assertIn("experiment_arms", data)
        self.assertIsInstance(data["experiment_arms"], list)

    def test_demo_invoke_endpoint(self):
        resp = self.client.get("/api/demo/invoke")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("is_cold_start", data)
        self.assertIn("execution_type", data)
        self.assertIn("total_elapsed_ms", data)
        self.assertIn("demo_response", data)

    def test_evaluation_run_endpoint(self):
        resp = self.client.post("/api/evaluation/run")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("status"), "complete")
        self.assertIn("experiment_arms", data)
        self.assertEqual(len(data["experiment_arms"]), 6)

    def test_fleet_endpoints(self):
        resp = self.client.get("/api/fleet")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("status"), "active")
        self.assertIn("fleet_size", data)
        self.assertIn("functions", data)
        self.assertGreaterEqual(data["fleet_size"], 1)

        # Test fleet register
        reg_resp = self.client.post("/api/fleet/register", json={
            "function_name": "test-microservice",
            "memory_mb": 256,
            "runtime": "python3.11",
            "current_pc": 2,
            "min_floor": 1,
            "max_cap": 20,
            "target_quantile": "q90",
            "status": "MANAGED_ACTIVE"
        })
        self.assertEqual(reg_resp.status_code, 200)
        self.assertEqual(reg_resp.json().get("status"), "registered")

        # Test fleet scale
        scale_resp = self.client.post("/api/fleet/test-microservice/scale?target_pc=5")
        self.assertEqual(scale_resp.status_code, 200)
        self.assertEqual(scale_resp.json().get("status"), "scaled")

    def test_alerts_endpoints(self):
        resp = self.client.get("/api/alerts")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertEqual(data.get("status"), "ok")
        self.assertIn("alerts", data)

        # Test webhook configuration
        wh_resp = self.client.post("/api/alerts/webhook", json={"webhook_url": "https://hooks.slack.com/services/test/123"})
        self.assertEqual(wh_resp.status_code, 200)

        # Test alert test dispatch
        test_alert_resp = self.client.post("/api/alerts/test", json={"message": "Test ping alert"})
        self.assertEqual(test_alert_resp.status_code, 200)
        self.assertEqual(test_alert_resp.json().get("status"), "dispatched")

    def test_model_retrain_and_status(self):
        resp = self.client.get("/api/model/status")
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIn("models", data)
        self.assertIn("features", data)

        # Trigger model retraining
        retrain_resp = self.client.post("/api/model/retrain")
        self.assertEqual(retrain_resp.status_code, 200)
        retrain_data = retrain_resp.json()
        self.assertIn("status", retrain_data)


if __name__ == "__main__":
    unittest.main()

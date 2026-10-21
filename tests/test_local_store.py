"""
Unit tests for Warmify local data store and mock simulation provider.
"""

import unittest
from pathlib import Path
import sys

ROOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT_DIR / "lambdas" / "api"))

import local_store


class TestWarmifyLocalStore(unittest.TestCase):
    def test_get_local_data(self):
        data = local_store.get_local_data()
        self.assertIsInstance(data, dict)
        self.assertIn("metrics", data)
        self.assertIn("decisions", data)
        self.assertIn("config", data)
        self.assertIn("evaluations", data)
        self.assertGreater(len(data["metrics"]), 0)

    def test_get_and_update_config(self):
        cfg = local_store.get_config()
        self.assertIn("min_floor", cfg)
        self.assertIn("max_cap", cfg)
        self.assertIn("dead_band", cfg)

        updated_cfg, pc = local_store.update_config({"headroom": 1.6})
        self.assertEqual(updated_cfg.get("headroom"), 1.6)

    def test_record_invocation(self):
        local_store.record_invocation(duration_ms=2100.0, cold_start=True)
        data = local_store.get_local_data()
        self.assertGreaterEqual(data["metrics"][-1]["cold_start_count"], 1)

    def test_save_evaluations(self):
        data = local_store.get_local_data()
        evals = data.get("evaluations", [])
        self.assertIsInstance(evals, list)
        self.assertEqual(len(evals), 6)

        # Test save_evaluations
        updated_evals = list(evals)
        updated_evals[0]["test_tag"] = "unit_test_eval"
        local_store.save_evaluations(updated_evals)
        reloaded = local_store.get_local_data().get("evaluations", [])
        self.assertEqual(reloaded[0].get("test_tag"), "unit_test_eval")

    def test_run_controller_cycle(self):
        res = local_store.run_controller_cycle(quantile="q90")
        self.assertIsInstance(res, dict)
        self.assertIn("final_copies", res)
        self.assertIn("guardrail_reasons", res)
        self.assertIn("predictions", res)


if __name__ == "__main__":
    unittest.main()

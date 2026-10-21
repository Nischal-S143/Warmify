"""
Unit tests for Warmify Controller predictive scaling logic.
Tests feature engineering, Little's Law, guardrails, and dynamic quantile selection.
"""

import math
import os
import sys
import importlib.util
import unittest
from datetime import datetime, timezone
from pathlib import Path

ROOT_DIR = Path(__file__).resolve().parent.parent

controller_path = ROOT_DIR / "lambdas" / "controller" / "app.py"
spec = importlib.util.spec_from_file_location("warmify_controller_app", controller_path)
controller_app = importlib.util.module_from_spec(spec)
sys.modules["warmify_controller_app"] = controller_app
spec.loader.exec_module(controller_app)


class TestControllerPredictiveLogic(unittest.TestCase):
    def setUp(self):
        controller_app.MIN_PC = 1
        controller_app.MAX_PC = 50
        controller_app.DEAD_BAND = 2
        controller_app.SCALE_DOWN_STEP = 1

    def test_encode_time_cyclical(self):
        # Test midnight (00:00)
        dt_midnight = datetime(2026, 10, 21, 0, 0, tzinfo=timezone.utc)
        sin_m, cos_m = controller_app._encode_time(dt_midnight)
        self.assertAlmostEqual(sin_m, 0.0, places=5)
        self.assertAlmostEqual(cos_m, 1.0, places=5)

        # Test midday (12:00)
        dt_noon = datetime(2026, 10, 21, 12, 0, tzinfo=timezone.utc)
        sin_n, cos_n = controller_app._encode_time(dt_noon)
        self.assertAlmostEqual(sin_n, 0.0, places=5)
        self.assertAlmostEqual(cos_n, -1.0, places=5)

    def test_littles_law_calculation(self):
        # 60 req/min = 1.0 req/sec, duration = 0.5s, safety factor = 1.0
        # copies = ceil(1.0 * 0.5 * 1.0) = ceil(0.5) = 1
        copies_1 = controller_app._littles_law(60, 0.5, 1.0)
        self.assertEqual(copies_1, 1)

        # 300 req/min = 5.0 req/sec, duration = 0.8s, safety factor = 1.5
        # copies = ceil(5.0 * 0.8 * 1.5) = ceil(6.0) = 6
        copies_2 = controller_app._littles_law(300, 0.8, 1.5)
        self.assertEqual(copies_2, 6)

    def test_guardrails_floor_and_ceiling(self):
        # Below floor
        target, reasons = controller_app._apply_guardrails(
            raw_copies=0, current_copies=1, cold_starts_recent=0
        )
        self.assertEqual(target, 1)
        self.assertTrue(any("floor" in r for r in reasons))

        # Above ceiling
        target_ceil, reasons_ceil = controller_app._apply_guardrails(
            raw_copies=100, current_copies=10, cold_starts_recent=0
        )
        self.assertEqual(target_ceil, 50)
        self.assertTrue(any("cap" in r for r in reasons_ceil))

    def test_guardrails_dead_band(self):
        # Current = 5, target = 6 (difference = 1, less than dead-band 2)
        # Should stay at current 5 when cold_starts == 0
        target, reasons = controller_app._apply_guardrails(
            raw_copies=6, current_copies=5, cold_starts_recent=0
        )
        self.assertEqual(target, 5)
        self.assertTrue(any("dead_band" in r for r in reasons))

        # Cold starts detected (>0) should override dead-band to prevent SLA breach
        target_override, reasons_override = controller_app._apply_guardrails(
            raw_copies=6, current_copies=5, cold_starts_recent=3
        )
        self.assertEqual(target_override, 6)
        self.assertTrue(any("cold-start surge override" in r for r in reasons_override))

    def test_guardrails_gradual_scale_down(self):
        # Current = 10, target = 5.
        # Max scale-down step is 1, so target should only step down to 9
        target, reasons = controller_app._apply_guardrails(
            raw_copies=5, current_copies=10, cold_starts_recent=0
        )
        self.assertEqual(target, 9)
        self.assertTrue(any("gradual scale-down" in r for r in reasons))

    def test_feature_engineering_pipeline(self):
        # Synthetic 90 minutes of records
        base_time = datetime(2026, 10, 21, 10, 0, tzinfo=timezone.utc)
        records = []
        for i in range(90):
            ts = base_time.replace(minute=i % 60).isoformat()
            records.append({
                "timestamp": ts,
                "invocations": 10 + (i % 20),
                "avg_duration_ms": 150.0,
            })
        features = controller_app._build_features(records)
        self.assertEqual(len(features), 8)
        self.assertEqual(len(controller_app.FEATURE_NAMES), 8)


if __name__ == "__main__":
    unittest.main()

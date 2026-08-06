import unittest
from datetime import datetime, timedelta, timezone

from fireguard_backend.domain import apply_monitoring_event, summarize_enterprises
from fireguard_backend.app import MonitoringEventCreate


class MonitoringDomainTests(unittest.TestCase):
    def test_summary_aggregates_enterprise_state(self):
        summary = summarize_enterprises([
            {"risk_level": "high", "online_rate": 89, "pending_signal_count": 3, "maintenance_overdue": 2},
            {"risk_level": "low", "online_rate": 99, "pending_signal_count": 0, "maintenance_overdue": 0},
        ])

        self.assertEqual(summary, {
            "enterprise_count": 2,
            "high_risk_count": 1,
            "online_rate": 94.0,
            "pending_signal_count": 3,
            "maintenance_overdue": 2,
        })

    def test_fire_alarm_updates_selected_enterprise(self):
        enterprise = {
            "id": "ent-001",
            "health_score": 58,
            "risk_level": "high",
            "pending_signal_count": 3,
            "fault_count_30d": 18,
            "maintenance_overdue": 2,
        }

        updated = apply_monitoring_event(enterprise, {"event_type": "fire_alarm"})

        self.assertEqual(updated["pending_signal_count"], 4)
        self.assertEqual(updated["health_score"], 53)
        self.assertEqual(updated["risk_level"], "high")
        self.assertEqual(enterprise["pending_signal_count"], 3)

    def test_unknown_event_keeps_metrics_unchanged(self):
        enterprise = {"health_score": 76, "risk_level": "medium", "pending_signal_count": 0}
        self.assertEqual(apply_monitoring_event(enterprise, {"event_type": "verification_requested"}), enterprise)

    def test_event_time_requires_timezone_and_reasonable_window(self):
        with self.assertRaises(ValueError):
            MonitoringEventCreate(enterprise_id="ent-001", event_type="fire_alarm", occurred_at=datetime.now())
        with self.assertRaises(ValueError):
            MonitoringEventCreate(
                enterprise_id="ent-001",
                event_type="fire_alarm",
                occurred_at=datetime.now(timezone.utc) + timedelta(hours=1),
            )


if __name__ == "__main__":
    unittest.main()

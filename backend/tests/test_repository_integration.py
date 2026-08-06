import os
import unittest
from datetime import datetime, timedelta

from fireguard_backend.repository import PostgresRepository


@unittest.skipUnless(os.getenv("FIREGUARD_TEST_DATABASE_URL"), "integration database not configured")
class RepositoryIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.repository = PostgresRepository(os.environ["FIREGUARD_TEST_DATABASE_URL"])
        await self.repository.init()

    async def test_event_is_persisted_and_updates_enterprise(self):
        before = await self.repository.get_enterprise("ent-003")
        event = await self.repository.create_event({
            "enterprise_id": "ent-003",
            "event_type": "fire_alarm",
            "severity": "high",
            "source": "integration_test",
            "payload": {"device_id": "test-device"},
        })
        after = await self.repository.get_enterprise("ent-003")

        self.assertIsInstance(event["id"], int)
        self.assertEqual(after["pending_signal_count"], before["pending_signal_count"] + 1)
        self.assertEqual(after["health_score"], max(0, before["health_score"] - 5))

        previous_last_seen = after["last_seen_at"]
        await self.repository.create_event({
            "enterprise_id": "ent-003",
            "event_type": "fault",
            "severity": "medium",
            "source": "integration_test",
            "occurred_at": datetime.fromisoformat(previous_last_seen) - timedelta(hours=1),
        })
        stale_after = await self.repository.get_enterprise("ent-003")
        self.assertEqual(stale_after["last_seen_at"], previous_last_seen)

    async def test_incident_flow_is_persisted_and_ordered(self):
        event = await self.repository.create_event({
            "enterprise_id": "ent-001", "event_type": "fire_alarm",
            "severity": "high", "source": "incident_integration",
        })
        confirmed = await self.repository.verify_signal(event["id"], "confirmed", "人工核实（模拟）")
        repeated = await self.repository.verify_signal(event["id"], "confirmed", "人工核实（模拟）")

        self.assertTrue(confirmed["changed"])
        self.assertFalse(repeated["changed"])
        self.assertEqual(confirmed["incident"]["id"], repeated["incident"]["id"])
        with self.assertRaisesRegex(ValueError, "verification_conflict"):
            await self.repository.verify_signal(event["id"], "dismissed")

        incident_id = confirmed["incident"]["id"]
        dispatched = await self.repository.dispatch_incident(incident_id, "station-hx-01")
        duplicate_dispatch = await self.repository.dispatch_incident(incident_id, "station-hx-01")
        self.assertTrue(dispatched["changed"])
        self.assertFalse(duplicate_dispatch["changed"])
        self.assertEqual(dispatched["station"]["status"], "awaiting_ack")

        with self.assertRaisesRegex(ValueError, "invalid_transition"):
            await self.repository.transition_dispatch(dispatched["dispatch"]["id"], "depart")
        acknowledged = await self.repository.transition_dispatch(dispatched["dispatch"]["id"], "acknowledge")
        enroute = await self.repository.transition_dispatch(dispatched["dispatch"]["id"], "depart")
        arrived = await self.repository.transition_dispatch(dispatched["dispatch"]["id"], "arrive")
        self.assertEqual(acknowledged["station"]["status"], "assigned")
        self.assertEqual(enroute["station"]["status"], "enroute")
        self.assertEqual(arrived["station"]["status"], "on_scene")

        report = await self.repository.add_dispatch_report(
            dispatched["dispatch"]["id"], "现场有烟雾，正在侦察（合成）", "unknown"
        )
        repeated_report = await self.repository.add_dispatch_report(
            dispatched["dispatch"]["id"], "现场有烟雾，正在侦察（合成）", "unknown"
        )
        self.assertTrue(report["changed"])
        self.assertFalse(repeated_report["changed"])
        self.assertEqual(len(report["incident"]["timeline"]), 6)

        station_tasks = await self.repository.get_station_tasks("station-hx-01")
        other_station_tasks = await self.repository.get_station_tasks("station-hx-02")
        self.assertEqual(station_tasks["tasks"][0]["id"], incident_id)
        self.assertEqual(other_station_tasks["tasks"], [])


if __name__ == "__main__":
    unittest.main()

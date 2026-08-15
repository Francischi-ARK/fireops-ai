import os
import unittest
from datetime import datetime, timedelta

from psycopg import AsyncConnection

from fireguard_backend.repository import PostgresRepository


@unittest.skipUnless(os.getenv("FIREGUARD_TEST_DATABASE_URL"), "integration database not configured")
class RepositoryIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.repository = PostgresRepository(os.environ["FIREGUARD_TEST_DATABASE_URL"])
        await self.repository.init()
        # 中断的历史运行可能把班组留在 busy/on_scene，使派单用例误报
        # station_busy；开跑前恢复基线，保证测试与顺序、残留无关。
        async with await AsyncConnection.connect(os.environ["FIREGUARD_TEST_DATABASE_URL"]) as connection:
            await connection.execute("UPDATE fire_stations SET status = 'available'")

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
        dispatched = await self.repository.dispatch_incident(incident_id, "crew-wx-01")
        duplicate_dispatch = await self.repository.dispatch_incident(incident_id, "crew-wx-01")
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

        closed = await self.repository.close_incident(incident_id)
        repeated_close = await self.repository.close_incident(incident_id)
        self.assertTrue(closed["changed"])
        self.assertFalse(repeated_close["changed"])
        self.assertEqual(closed["incident"]["status"], "closed")
        self.assertEqual(closed["incident"]["dispatch"]["status"], "completed")

        station_tasks = await self.repository.get_station_tasks("crew-wx-01")
        other_station_tasks = await self.repository.get_station_tasks("crew-wx-02")
        self.assertEqual(station_tasks["tasks"][0]["id"], incident_id)
        self.assertEqual(other_station_tasks["tasks"], [])

    async def test_rectification_requires_workorder_completion_before_recheck(self):
        finding = await self.repository.create_inspection_finding({
            "enterprise_id": "ent-001",
            "title": "测试整改状态机",
            "category": "现场隐患",
            "severity": "high",
            "location": "测试点位",
            "description": "用于验证人工开工、完成和复查边界",
            "department": "生产部",
            "owner": "李强",
            "image_asset": "assets/evidence-extinguisher-blocked.png",
            "voice_text": "",
            "confidence": 0.9,
            "status": "draft",
            "pin": {"left": 50, "top": 50},
            "evidence_refs": ["image:test"],
        })
        dispatched = await self.repository.dispatch_inspection_finding(finding["id"], "人工派发")
        workorder_id = dispatched["workorder"]["id"]

        with self.assertRaisesRegex(ValueError, "workorder_state_conflict"):
            await self.repository.complete_workorder(workorder_id, "不能跳过开工")
        with self.assertRaisesRegex(ValueError, "recheck_workorder_not_done"):
            await self.repository.recheck_inspection_finding(finding["id"], "passed", "工单未完成")

        started = await self.repository.start_workorder(workorder_id, "开始整改")
        completed = await self.repository.complete_workorder(workorder_id, "整改完成")
        rechecked = await self.repository.recheck_inspection_finding(finding["id"], "passed", "复查通过")
        repeated = await self.repository.recheck_inspection_finding(finding["id"], "passed", "重复复查")

        self.assertEqual(started["workorder"]["status"], "in_progress")
        self.assertEqual(completed["workorder"]["status"], "done")
        self.assertEqual(rechecked["finding"]["status"], "closed")
        self.assertFalse(repeated["changed"])

    async def test_maintenance_crew_keeps_completed_workorder_in_history(self):
        created = await self.repository.create_ops_workorder({
            "enterprise_id": "ent-001",
            "kind": "repair",
            "summary": "验证完成工单仍可追溯",
            "crew_id": "crew-wb-01",
            "owner": "维保组带班员",
            "status": "draft",
            "evidence_refs": ["test:completed-inbox-history"],
        })
        workorder_id = created["id"]
        await self.repository.approve_workorder(workorder_id, "批准")
        await self.repository.start_workorder(workorder_id, "开工")
        await self.repository.complete_workorder(workorder_id, "完成")

        inbox = await self.repository.get_workbench_inbox(role="crew", crew_id="crew-wb-01")
        item = next((row for row in inbox["items"] if row["workorder_id"] == workorder_id), None)
        self.assertIsNotNone(item, "completed workorder disappeared from crew history")
        self.assertEqual(item["status"], "done")

    async def test_enterprise_dossier_aggregates_operational_context(self):
        fire_event = await self.repository.create_event({
            "enterprise_id": "ent-001",
            "event_type": "fire_alarm",
            "severity": "high",
            "source": "dossier_integration",
            "payload": {"controller_no": 2, "loop_no": 1, "point_no": 5},
        })
        fault_event = await self.repository.create_event({
            "enterprise_id": "ent-001",
            "event_type": "fault",
            "severity": "medium",
            "source": "dossier_integration",
            "payload": {"location": "电池车间消控室 机2火警主机"},
        })
        finding = await self.repository.create_inspection_finding({
            "enterprise_id": "ent-001",
            "title": "档案聚合测试隐患",
            "category": "现场隐患",
            "severity": "medium",
            "location": "PACK 通道",
            "description": "测试档案聚合",
            "department": "生产部",
            "owner": "李强",
            "image_asset": "assets/evidence-extinguisher-blocked.png",
            "voice_text": "",
            "confidence": 0.8,
            "status": "draft",
            "pin": {"left": 50, "top": 50},
            "evidence_refs": ["image:dossier-test"],
        })

        self.assertTrue(
            hasattr(self.repository, "get_enterprise_dossier"),
            "enterprise dossier aggregate missing",
        )
        dossier = await self.repository.get_enterprise_dossier("ent-001")

        self.assertEqual(dossier["enterprise"]["id"], "ent-001")
        self.assertTrue(dossier["device_points"])
        self.assertIn(fire_event["id"], [item["id"] for item in dossier["recent_events"]])
        self.assertIn(fault_event["id"], [item["id"] for item in dossier["recent_events"]])
        self.assertIn(finding["id"], [item["id"] for item in dossier["findings"]])
        self.assertIn(fault_event["id"], [
            item["event_id"] for item in dossier["workorders"] if item["kind"] == "repair"
        ])
        self.assertIn(f"monitoring_events/{fire_event['id']}", dossier["evidence_refs"])
        self.assertIn("image:dossier-test", dossier["evidence_refs"])
        self.assertEqual(dossier["next_context"]["event_id"], fire_event["id"])
        self.assertIsNotNone(dossier["next_context"]["workorder_id"])


if __name__ == "__main__":
    unittest.main()

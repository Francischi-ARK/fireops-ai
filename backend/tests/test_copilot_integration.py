import json
import os
import unittest
from pathlib import Path

from psycopg import AsyncConnection

from fireguard_backend.copilot import CopilotEngine
from fireguard_backend.copilot_provider import CopilotProvider
from fireguard_backend.copilot_schema import CopilotRunCreate, ToolCall
from fireguard_backend.copilot_tools import RunContext, ToolGuard
from fireguard_backend.repository import PostgresRepository


SCENARIOS_PATH = Path(__file__).resolve().parents[2] / "demo-data" / "copilot_scenarios.json"

READ_TOOLS = {
    "get_signal_context", "get_site_packet", "get_maintenance_context",
    "find_missing_fields", "recommend_crew", "search_manual",
}


def covers(collected_refs, expected):
    return any(ref == expected or ref.startswith(expected) or expected in ref for ref in collected_refs)


@unittest.skipUnless(os.getenv("FIREGUARD_TEST_DATABASE_URL"), "integration database not configured")
class CopilotIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.repository = PostgresRepository(os.environ["FIREGUARD_TEST_DATABASE_URL"])
        await self.repository.init()
        self.guard = ToolGuard(CopilotProvider(self.repository))
        raw = json.loads(SCENARIOS_PATH.read_text(encoding="utf-8"))
        self.scenarios = {s["scenario_id"]: s for s in raw["scenarios"]}

    async def _create_signal(self, scenario):
        signal = scenario["input"]["signal"]
        return await self.repository.create_event({
            "enterprise_id": scenario["enterprise_id"],
            "event_type": signal["event_type"],
            "severity": signal["severity"],
            "source": "copilot_integration_test",
            "payload": signal["payload"],
        })

    async def _run_read_tools(self, scenario, ctx):
        for name in scenario["allowed_tools"]:
            if name not in READ_TOOLS:
                continue
            if name == "get_signal_context":
                args = {"event_id": ctx.event_id}
            elif name == "find_missing_fields":
                args = {"reporter_text": scenario["input"]["reporter_text"], "known_fields": {}}
            elif name == "search_manual":
                args = {"query": "备电故障 蓄电池 更换"}
            else:
                args = {"enterprise_id": scenario["enterprise_id"]}
            result = await self.guard.execute(ToolCall(name=name, arguments=args), ctx)
            self.assertTrue(result.ok, f"{scenario['scenario_id']}:{name} -> {result.error}")

    def _assert_evidence_covered(self, scenario, ctx):
        refs = [ref.ref for ref in ctx.collected_evidence]
        for expected in scenario["expected_evidence"]:
            self.assertTrue(covers(refs, expected), f"missing evidence {expected}; got {refs}")

    async def test_scenario_a_maintenance_adjacent_evidence(self):
        scenario = self.scenarios["A-false-alarm-paint-shop"]
        event = await self._create_signal(scenario)
        ctx = RunContext(enterprise_id=scenario["enterprise_id"], event_id=event["id"])
        await self._run_read_tools(scenario, ctx)
        self._assert_evidence_covered(scenario, ctx)

        # 报警帧解析出的点位应命中点位编码表（机1回路1点位3）。
        signal = await self.guard.execute(ToolCall(
            name="get_signal_context", arguments={"event_id": event["id"]},
        ), ctx)
        self.assertEqual(signal.data["device_point"]["point_id"], "pt-01-01-003")

        draft = await self.guard.execute(ToolCall(
            name="create_verification_draft",
            arguments={"event_id": event["id"], "note": "维保测试与报警时间相邻，需现场核实"},
        ), ctx)
        self.assertTrue(draft.ok)
        self.assertTrue(draft.data["is_draft"])
        self.assertEqual(draft.data["requires_approval"], "verification_result")

    async def test_scenario_b_full_chain_with_human_approvals(self):
        scenario = self.scenarios["B-confirmed-fire-battery-workorder"]
        event = await self._create_signal(scenario)
        ctx = RunContext(enterprise_id=scenario["enterprise_id"], event_id=event["id"])
        await self._run_read_tools(scenario, ctx)
        self._assert_evidence_covered(scenario, ctx)

        recommend = await self.guard.execute(ToolCall(
            name="recommend_crew", arguments={"enterprise_id": scenario["enterprise_id"]},
        ), ctx)
        recommended_ids = [c["id"] for c in recommend.data["recommended"]]
        for crew_id in scenario["expected_outputs"]["recommended_crew_ids"]:
            self.assertIn(crew_id, recommended_ids)

        # Draft is blocked until a human confirms the signal through the real API.
        incident = (await self.repository.verify_signal(event["id"], "confirmed", "人工核实（模拟）"))["incident"]
        ctx.incident_id = incident["id"]
        ctx.verification_status = "confirmed"
        draft = await self.guard.execute(ToolCall(
            name="create_workorder_draft",
            arguments={"incident_id": incident["id"], "crew_id": recommended_ids[0],
                       "summary": "确认火警先期处置（模拟）"},
        ), ctx)
        self.assertTrue(draft.ok)
        self.assertTrue(draft.data["is_draft"])

        # Human issues the workorder through the existing API, then the copilot
        # may record its activity note with the matching approval recorded.
        # ponytail: crew-wb-01 keeps this test independent of test_repository_integration,
        # which drives crew-wx-01 in the same shared test database.
        await self.repository.dispatch_incident(incident["id"], "crew-wb-01")
        ctx.approvals.add("copilot_note")
        appended = await self.guard.execute(ToolCall(
            name="append_incident_activity",
            arguments={"incident_id": incident["id"], "event_type": "copilot_note", "note": "已生成三端交付（模拟）"},
        ), ctx)
        self.assertTrue(appended.ok)
        detail = await self.repository.get_incident(incident["id"])
        self.assertIn("copilot_note", [row["event_type"] for row in detail["timeline"]])
        await self._remove_dispatch(incident["id"])

    async def _remove_dispatch(self, incident_id):
        # ponytail: the suite shares one demo test database; undo our dispatch so
        # test_repository_integration still finds crew-wb-01 untouched.
        dsn = os.environ["FIREGUARD_TEST_DATABASE_URL"]
        async with await AsyncConnection.connect(dsn) as connection:
            await connection.execute("DELETE FROM incident_timeline WHERE incident_id = %s", (incident_id,))
            await connection.execute("DELETE FROM incident_dispatches WHERE incident_id = %s", (incident_id,))
            await connection.execute("UPDATE fire_stations SET status = 'available' WHERE id = 'crew-wb-01'")
            await connection.execute("DELETE FROM fire_incidents WHERE id = %s", (incident_id,))

    async def test_scenario_c_fault_diagnosis_workorder(self):
        scenario = self.scenarios["C-controller-fault-diagnosis"]
        event = await self._create_signal(scenario)
        ctx = RunContext(enterprise_id=scenario["enterprise_id"], event_id=event["id"],
                         event_type="fault")
        await self._run_read_tools(scenario, ctx)
        self._assert_evidence_covered(scenario, ctx)

        # 说明书检索必须命中备电故障条目并作为证据被引用。
        refs = [ref.ref for ref in ctx.collected_evidence]
        self.assertIn("kb-002", refs)

        # 设施故障不需要火警核实即可起草维修工单，但派发仍需人工审批。
        crew_id = scenario["expected_outputs"]["recommended_crew_ids"][0]
        draft = await self.guard.execute(ToolCall(
            name="create_workorder_draft",
            arguments={"event_id": event["id"], "crew_id": crew_id,
                       "summary": "备电故障：检查电池连接器，充电8小时复测（模拟）"},
        ), ctx)
        self.assertTrue(draft.ok, draft.error)
        self.assertEqual(draft.data["requires_approval"], "workorder_dispatch")

    async def test_scenario_d_data_gap_visible_not_invented(self):
        scenario = self.scenarios["D-insufficient-data-safe-abstention"]
        event = await self._create_signal(scenario)
        ctx = RunContext(enterprise_id=scenario["enterprise_id"], event_id=event["id"])
        await self._run_read_tools(scenario, ctx)
        self._assert_evidence_covered(scenario, ctx)

        packet = await self.guard.execute(ToolCall(
            name="get_site_packet", arguments={"enterprise_id": "ent-004"},
        ), ctx)
        self.assertTrue(packet.ok)
        self.assertEqual(packet.data["profile"], {})
        maintenance = await self.guard.execute(ToolCall(
            name="get_maintenance_context", arguments={"enterprise_id": "ent-004"},
        ), ctx)
        self.assertEqual(maintenance.data["records"], [])

        missing = await self.guard.execute(ToolCall(
            name="find_missing_fields",
            arguments={"reporter_text": scenario["input"]["reporter_text"], "known_fields": {}},
        ), ctx)
        self.assertEqual(set(missing.data["missing_fields"]), set(scenario["expected_missing_fields"]))

    async def test_run_persisted_and_approval_recorded_in_timeline(self):
        scenario = self.scenarios["B-confirmed-fire-battery-workorder"]
        event = await self._create_signal(scenario)
        await self.repository.verify_signal(event["id"], "confirmed", "人工核实（模拟）")

        engine = CopilotEngine(CopilotProvider(self.repository))
        payload = CopilotRunCreate(
            enterprise_id="ent-001", event_id=event["id"],
            reporter_text=scenario["input"]["reporter_text"],
            scenario_id=scenario["scenario_id"], mode="scenario",
        )
        result = await engine.run(payload)
        self.assertIsNotNone(result.incident_id)
        self.assertEqual(result.status, "completed")

        run_id = await self.repository.create_copilot_run(payload, result)
        loaded = await self.repository.get_copilot_run(run_id)
        self.assertEqual(loaded["trace_json"]["status"], "completed")
        self.assertEqual(loaded["incident_id"], result.incident_id)
        self.assertTrue(loaded["is_simulation"])

        approval = await self.repository.add_copilot_approval(run_id, "workorder_dispatch", "同意派单（模拟）")
        self.assertTrue(approval["timeline_recorded"])
        detail = await self.repository.get_incident(result.incident_id)
        self.assertIn("approval_workorder_dispatch", [row["event_type"] for row in detail["timeline"]])

        repeated = await self.repository.add_copilot_approval(run_id, "workorder_dispatch", "重复点击（模拟）")
        self.assertEqual(repeated["approvals"].count("workorder_dispatch"), 1)
        self.assertFalse(repeated["timeline_recorded"])


if __name__ == "__main__":
    unittest.main()

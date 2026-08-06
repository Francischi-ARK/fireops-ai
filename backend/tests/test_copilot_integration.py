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
    "find_missing_fields", "recommend_station",
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
            else:
                args = {"enterprise_id": scenario["enterprise_id"]}
            result = await self.guard.execute(ToolCall(name=name, arguments=args), ctx)
            self.assertTrue(result.ok, f"{scenario['scenario_id']}:{name} -> {result.error}")

    def _assert_evidence_covered(self, scenario, ctx):
        refs = [ref.ref for ref in ctx.collected_evidence]
        for expected in scenario["expected_evidence"]:
            self.assertTrue(covers(refs, expected), f"missing evidence {expected}; got {refs}")

    async def test_scenario_a_maintenance_adjacent_evidence(self):
        scenario = self.scenarios["A-false-alarm-maintenance-adjacent"]
        event = await self._create_signal(scenario)
        ctx = RunContext(enterprise_id=scenario["enterprise_id"], event_id=event["id"])
        await self._run_read_tools(scenario, ctx)
        self._assert_evidence_covered(scenario, ctx)

        draft = await self.guard.execute(ToolCall(
            name="create_verification_draft",
            arguments={"event_id": event["id"], "note": "维保测试与报警时间相邻，需现场核实"},
        ), ctx)
        self.assertTrue(draft.ok)
        self.assertTrue(draft.data["is_draft"])
        self.assertEqual(draft.data["requires_approval"], "verification_result")

    async def test_scenario_b_full_chain_with_human_approvals(self):
        scenario = self.scenarios["B-confirmed-fire-full-dispatch"]
        event = await self._create_signal(scenario)
        ctx = RunContext(enterprise_id=scenario["enterprise_id"], event_id=event["id"])
        await self._run_read_tools(scenario, ctx)
        self._assert_evidence_covered(scenario, ctx)

        recommend = await self.guard.execute(ToolCall(
            name="recommend_station", arguments={"enterprise_id": scenario["enterprise_id"]},
        ), ctx)
        recommended_ids = [s["id"] for s in recommend.data["recommended"]]
        for station_id in scenario["expected_outputs"]["recommended_station_ids"]:
            self.assertIn(station_id, recommended_ids)

        # Draft is blocked until a human confirms the signal through the real API.
        incident = (await self.repository.verify_signal(event["id"], "confirmed", "人工核实（模拟）"))["incident"]
        ctx.incident_id = incident["id"]
        ctx.verification_status = "confirmed"
        draft = await self.guard.execute(ToolCall(
            name="create_dispatch_draft",
            arguments={"incident_id": incident["id"], "station_id": recommended_ids[0]},
        ), ctx)
        self.assertTrue(draft.ok)
        self.assertTrue(draft.data["is_draft"])

        # Human issues the dispatch through the existing API, then the copilot
        # may record its activity note with the matching approval recorded.
        # ponytail: hx-02 keeps this test independent of test_repository_integration,
        # which drives station-hx-01 in the same shared test database.
        await self.repository.dispatch_incident(incident["id"], "station-hx-02")
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
        # test_repository_integration still finds station-hx-02 untouched.
        dsn = os.environ["FIREGUARD_TEST_DATABASE_URL"]
        async with await AsyncConnection.connect(dsn) as connection:
            await connection.execute("DELETE FROM incident_timeline WHERE incident_id = %s", (incident_id,))
            await connection.execute("DELETE FROM incident_dispatches WHERE incident_id = %s", (incident_id,))
            await connection.execute("UPDATE fire_stations SET status = 'available' WHERE id = 'station-hx-02'")
            await connection.execute("DELETE FROM fire_incidents WHERE id = %s", (incident_id,))

    async def test_scenario_c_data_gap_visible_not_invented(self):
        scenario = self.scenarios["C-insufficient-data-safe-abstention"]
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
        scenario = self.scenarios["B-confirmed-fire-full-dispatch"]
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

        approval = await self.repository.add_copilot_approval(run_id, "dispatch_order", "同意调派（模拟）")
        self.assertTrue(approval["timeline_recorded"])
        detail = await self.repository.get_incident(result.incident_id)
        self.assertIn("approval_dispatch_order", [row["event_type"] for row in detail["timeline"]])

        repeated = await self.repository.add_copilot_approval(run_id, "dispatch_order", "重复点击（模拟）")
        self.assertEqual(repeated["approvals"].count("dispatch_order"), 1)
        self.assertFalse(repeated["timeline_recorded"])


if __name__ == "__main__":
    unittest.main()

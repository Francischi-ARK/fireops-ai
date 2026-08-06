import asyncio
import json
import unittest
from pathlib import Path

from pydantic import ValidationError

from fireguard_backend.copilot_schema import AgentPlan, EvidenceRef, ToolCall
from fireguard_backend.copilot_tools import RunContext, ToolGuard, validate_evidence


SCENARIOS_PATH = Path(__file__).resolve().parents[2] / "demo-data" / "copilot_scenarios.json"


class FakeCopilotProvider:
    """In-memory stand-in for repository and demo CSV data. Records every call."""

    def __init__(self):
        self.calls = []
        self.appended = []

    async def get_signal(self, event_id):
        self.calls.append(("get_signal", event_id))
        if event_id != 1:
            return None
        return {
            "id": 1,
            "enterprise_id": "ent-001",
            "event_type": "fire_alarm",
            "payload": {"device_ref": "FACP-01-L2-07"},
            "verification_status": "pending",
            "raw_ref": "demo/alarm/101",
        }

    async def get_enterprise(self, enterprise_id):
        self.calls.append(("get_enterprise", enterprise_id))
        if enterprise_id != "ent-001":
            return None
        return {"id": "ent-001", "name": "皓源新能源（虚拟）", "district": "高新区"}

    async def get_site_profile(self, enterprise_id):
        self.calls.append(("get_site_profile", enterprise_id))
        if enterprise_id != "ent-001":
            return None
        return {
            "address": "高新区新能源产业园 1 号生产厂房（合成）",
            "hazards": ["锂电池生产区域（合成）"],
            "access_points": ["厂区东门（合成）"],
            "water_sources": ["厂区消防水池（合成）"],
            "facilities": ["自动喷水灭火系统（合成）"],
        }

    async def get_maintenance(self, enterprise_id):
        self.calls.append(("get_maintenance", enterprise_id))
        return [
            {"maintenance_id": "maint-001", "facility_type": "fire_alarm_system",
             "completed_at": "2026-07-20T14:30:00+08:00", "status": "completed",
             "raw_ref": "demo/maint/001"}
        ]

    async def list_stations(self):
        self.calls.append(("list_stations",))
        return [
            {"id": "station-hx-01", "district": "高新区", "status": "available"},
            {"id": "station-jk-01", "district": "经开区", "status": "available"},
        ]

    async def get_incident(self, incident_id):
        self.calls.append(("get_incident", incident_id))
        if incident_id != 7:
            return None
        return {"id": 7, "status": "待调派", "enterprise_id": "ent-001"}

    async def append_incident_activity(self, incident_id, event_type, note, actor):
        self.appended.append((incident_id, event_type, note, actor))
        return {"incident_id": incident_id, "event_type": event_type}


def run(coro):
    return asyncio.run(coro)


def make_guard():
    provider = FakeCopilotProvider()
    context = RunContext(enterprise_id="ent-001", event_id=1)
    return ToolGuard(provider), context, provider


class CopilotSchemaTests(unittest.TestCase):
    def test_valid_plan_parses(self):
        plan = AgentPlan(
            intent="signal_verification",
            missing_fields=["现场复核人"],
            plan=["读取信号上下文", "生成核实草稿"],
            tool_calls=[ToolCall(name="get_signal_context", arguments={"event_id": 1})],
            evidence=[EvidenceRef(ref="demo/alarm/101", kind="signal")],
            approval_required=["verification_result"],
        )
        self.assertEqual(plan.intent, "signal_verification")
        self.assertFalse(plan.abstained)

    def test_invalid_intent_rejected(self):
        with self.assertRaises(ValidationError):
            AgentPlan(intent="auto_dispatch_everything")

    def test_empty_tool_name_rejected(self):
        with self.assertRaises(ValidationError):
            ToolCall(name="")

    def test_scenario_fixtures_are_valid(self):
        spec = json.loads(SCENARIOS_PATH.read_text(encoding="utf-8"))
        required = {
            "scenario_id", "title", "enterprise_id", "input", "expected_intent",
            "expected_missing_fields", "allowed_tools", "expected_evidence",
            "human_approval_points", "expected_outputs", "safe_failure",
        }
        self.assertEqual(len(spec["scenarios"]), 3)
        for scenario in spec["scenarios"]:
            self.assertFalse(required - set(scenario), scenario["scenario_id"])
            self.assertIn(scenario["expected_intent"], ("signal_verification", "incident_dispatch_support"))
        self.assertTrue(spec["is_simulation"])
        self.assertEqual(spec["external_system"], "none")


class ToolGuardTests(unittest.TestCase):
    def test_unknown_tool_rejected_without_side_effects(self):
        guard, context, provider = make_guard()
        result = run(guard.execute(ToolCall(name="drop_tables", arguments={}), context))
        self.assertFalse(result.ok)
        self.assertEqual(result.error, "unknown_tool")
        self.assertEqual(provider.calls, [])
        self.assertEqual(provider.appended, [])

    def test_arguments_are_validated(self):
        guard, context, provider = make_guard()
        result = run(guard.execute(ToolCall(name="get_signal_context", arguments={"event_id": "abc"}), context))
        self.assertFalse(result.ok)
        self.assertEqual(result.error, "invalid_arguments")
        self.assertEqual(provider.calls, [])

    def test_read_tool_returns_structured_data_and_evidence(self):
        guard, context, provider = make_guard()
        result = run(guard.execute(ToolCall(name="get_signal_context", arguments={"event_id": 1}), context))
        self.assertTrue(result.ok)
        self.assertEqual(result.data["enterprise_id"], "ent-001")
        refs = [ref.ref for ref in context.collected_evidence]
        self.assertIn("demo/alarm/101", refs)

    def test_missing_signal_is_not_invented(self):
        guard, context, provider = make_guard()
        result = run(guard.execute(ToolCall(name="get_signal_context", arguments={"event_id": 999}), context))
        self.assertFalse(result.ok)
        self.assertEqual(result.error, "signal_not_found")

    def test_dispatch_draft_requires_confirmed_verification(self):
        guard, context, provider = make_guard()
        call = ToolCall(name="create_dispatch_draft", arguments={"incident_id": 7, "station_id": "station-hx-01"})
        denied = run(guard.execute(call, context))
        self.assertFalse(denied.ok)
        self.assertEqual(denied.error, "state_not_allowed")

        context.verification_status = "confirmed"
        allowed = run(guard.execute(call, context))
        self.assertTrue(allowed.ok)
        self.assertTrue(allowed.data["is_draft"])
        self.assertEqual(provider.appended, [])

    def test_append_activity_requires_human_approval(self):
        guard, context, provider = make_guard()
        call = ToolCall(
            name="append_incident_activity",
            arguments={"incident_id": 7, "event_type": "copilot_note", "note": "已生成首战信息"},
        )
        denied = run(guard.execute(call, context))
        self.assertFalse(denied.ok)
        self.assertEqual(denied.error, "approval_required")
        self.assertEqual(provider.appended, [])

        context.approvals.add("copilot_note")
        allowed = run(guard.execute(call, context))
        self.assertTrue(allowed.ok)
        self.assertEqual(len(provider.appended), 1)

    def test_recommend_station_uses_district(self):
        guard, context, provider = make_guard()
        result = run(guard.execute(ToolCall(name="recommend_station", arguments={"enterprise_id": "ent-001"}), context))
        self.assertTrue(result.ok)
        self.assertEqual([s["id"] for s in result.data["recommended"]], ["station-hx-01"])

    def test_evidence_must_come_from_tool_results(self):
        guard, context, provider = make_guard()
        run(guard.execute(ToolCall(name="get_signal_context", arguments={"event_id": 1}), context))
        plan = AgentPlan(
            intent="signal_verification",
            evidence=[
                EvidenceRef(ref="demo/alarm/101", kind="signal"),
                EvidenceRef(ref="demo/alarm/999", kind="signal"),
            ],
        )
        rejected = validate_evidence(plan, context.collected_evidence)
        self.assertEqual(rejected, ["demo/alarm/999"])
        self.assertEqual([e.ref for e in plan.evidence], ["demo/alarm/101"])


if __name__ == "__main__":
    unittest.main()

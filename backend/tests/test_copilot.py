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
        if event_id == 1:
            return {
                "id": 1,
                "enterprise_id": "ent-001",
                "event_type": "fire_alarm",
                "payload": {"controller_no": 2, "loop_no": 1, "point_no": 5},
                "verification_status": "pending",
                "raw_ref": "demo/alarm/101",
            }
        if event_id == 2:
            return {
                "id": 2,
                "enterprise_id": "ent-001",
                "event_type": "fault",
                "payload": {"controller_no": 2, "loop_no": 0, "point_no": 0, "fault_detail": "备电故障"},
                "verification_status": "pending",
                "raw_ref": "demo/alarm/102",
            }
        return None

    async def get_device_point(self, controller_no, loop_no, point_no):
        self.calls.append(("get_device_point", controller_no, loop_no, point_no))
        if (controller_no, loop_no, point_no) == (2, 1, 5):
            return {
                "point_id": "pt-02-01-005", "enterprise_id": "ent-001",
                "controller_no": 2, "loop_no": 1, "point_no": 5,
                "device_type": "点型感烟", "location": "电池车间PACK线烟感5",
            }
        return None

    async def get_enterprise(self, enterprise_id):
        self.calls.append(("get_enterprise", enterprise_id))
        if enterprise_id != "ent-001":
            return None
        return {"id": "ent-001", "name": "电池车间（PACK/化成）", "district": "西区"}

    async def get_site_profile(self, enterprise_id):
        self.calls.append(("get_site_profile", enterprise_id))
        if enterprise_id != "ent-001":
            return None
        return {
            "address": "星澜新能源汽车工厂（虚拟）西区 电池车间厂房",
            "hazards": ["锂电池模组半成品缓存区（合成）"],
            "access_points": ["车间南门（合成）"],
            "water_sources": ["厂区环网消火栓（合成）"],
            "facilities": ["自动喷水灭火系统（合成）"],
        }

    async def get_maintenance(self, enterprise_id):
        self.calls.append(("get_maintenance", enterprise_id))
        return [
            {"maintenance_id": "maint-003", "facility_type": "火灾自动报警系统",
             "status": "overdue", "raw_ref": "demo/maint/003"}
        ]

    async def search_knowledge(self, query, limit=3):
        self.calls.append(("search_knowledge", query))
        if "备电" not in query:
            return []
        return [{"kb_id": "kb-002", "source": "GST-QKP02H/04H 安装使用说明书",
                 "section": "第8章 表3", "topic": "备电故障",
                 "symptom": "开机后显示备电故障", "guidance": "检查电池连接器及接线……",
                 "keywords": "备电故障 蓄电池"}]

    async def list_crews(self):
        self.calls.append(("list_crews",))
        return [
            {"id": "crew-wx-01", "district": "西区", "status": "available"},
            {"id": "crew-wx-02", "district": "东区", "status": "available"},
            {"id": "crew-wb-01", "district": "西区", "status": "available"},
        ]

    async def get_incident(self, incident_id):
        self.calls.append(("get_incident", incident_id))
        if incident_id != 7:
            return None
        return {"id": 7, "status": "pending_dispatch", "enterprise_id": "ent-001"}

    async def append_incident_activity(self, incident_id, event_type, note, actor):
        self.appended.append((incident_id, event_type, note, actor))
        return {"incident_id": incident_id, "event_type": event_type}


def run(coro):
    return asyncio.run(coro)


def make_guard(**ctx_kwargs):
    provider = FakeCopilotProvider()
    context = RunContext(enterprise_id="ent-001", event_id=1, **ctx_kwargs)
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

    def test_fault_diagnosis_intent_accepted(self):
        plan = AgentPlan(intent="fault_diagnosis")
        self.assertEqual(plan.intent, "fault_diagnosis")

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
        self.assertEqual(len(spec["scenarios"]), 5)
        for scenario in spec["scenarios"]:
            self.assertFalse(required - set(scenario), scenario["scenario_id"])
            self.assertIn(scenario["expected_intent"], (
                "signal_verification", "incident_response_support",
                "fault_diagnosis", "gas_release_advisory",
            ))
            self.assertNotIn("append_incident_activity", scenario["allowed_tools"])
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

    def test_signal_context_resolves_device_point(self):
        guard, context, provider = make_guard()
        result = run(guard.execute(ToolCall(name="get_signal_context", arguments={"event_id": 1}), context))
        self.assertTrue(result.ok)
        self.assertEqual(result.data["enterprise_id"], "ent-001")
        self.assertEqual(result.data["device_point"]["point_id"], "pt-02-01-005")
        refs = [ref.ref for ref in context.collected_evidence]
        self.assertIn("demo/alarm/101", refs)
        self.assertIn("pt-02-01-005", refs)

    def test_missing_signal_is_not_invented(self):
        guard, context, provider = make_guard()
        result = run(guard.execute(ToolCall(name="get_signal_context", arguments={"event_id": 999}), context))
        self.assertFalse(result.ok)
        self.assertEqual(result.error, "signal_not_found")

    def test_workorder_draft_requires_confirmed_verification_for_fire(self):
        guard, context, provider = make_guard()
        call = ToolCall(name="create_workorder_draft",
                        arguments={"incident_id": 7, "crew_id": "crew-wx-01"})
        denied = run(guard.execute(call, context))
        self.assertFalse(denied.ok)
        self.assertEqual(denied.error, "state_not_allowed")

        context.verification_status = "confirmed"
        allowed = run(guard.execute(call, context))
        self.assertTrue(allowed.ok)
        self.assertTrue(allowed.data["is_draft"])
        self.assertEqual(allowed.data["requires_approval"], "workorder_dispatch")
        self.assertEqual(provider.appended, [])

    def test_workorder_draft_allowed_for_fault_event(self):
        guard, context, provider = make_guard(event_type="fault")
        context.event_id = 2
        call = ToolCall(name="create_workorder_draft",
                        arguments={"event_id": 2, "crew_id": "crew-wb-01",
                                   "summary": "备电故障检查蓄电池"})
        result = run(guard.execute(call, context))
        self.assertTrue(result.ok)
        self.assertTrue(result.data["is_draft"])

    def test_workorder_draft_without_target_rejected(self):
        guard, context, provider = make_guard(event_type="fault")
        result = run(guard.execute(
            ToolCall(name="create_workorder_draft", arguments={"crew_id": "crew-wb-01"}), context))
        self.assertFalse(result.ok)
        self.assertEqual(result.error, "invalid_arguments")

    def test_model_cannot_append_activity_even_with_recorded_approval(self):
        guard, context, provider = make_guard()
        call = ToolCall(
            name="append_incident_activity",
            arguments={"incident_id": 7, "event_type": "copilot_note", "note": "已生成处置交付"},
        )
        denied = run(guard.execute(call, context))
        self.assertFalse(denied.ok)
        self.assertEqual(denied.error, "unknown_tool")
        self.assertEqual(provider.appended, [])

        context.approvals.add("copilot_note")
        still_denied = run(guard.execute(call, context))
        self.assertFalse(still_denied.ok)
        self.assertEqual(still_denied.error, "unknown_tool")
        self.assertEqual(provider.appended, [])

    def test_recommend_crew_uses_district(self):
        guard, context, provider = make_guard()
        result = run(guard.execute(ToolCall(name="recommend_crew", arguments={"enterprise_id": "ent-001"}), context))
        self.assertTrue(result.ok)
        self.assertEqual([c["id"] for c in result.data["recommended"]], ["crew-wx-01"])

    def test_search_manual_returns_cited_entries(self):
        guard, context, provider = make_guard()
        result = run(guard.execute(
            ToolCall(name="search_manual", arguments={"query": "备电故障 蓄电池"}), context))
        self.assertTrue(result.ok)
        self.assertEqual(result.data["entries"][0]["kb_id"], "kb-002")
        refs = [ref.ref for ref in context.collected_evidence]
        self.assertIn("kb-002", refs)
        self.assertIn("第8章", result.evidence[0].note)

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
        self.assertEqual(plan.evidence[0].kind, "signal")


if __name__ == "__main__":
    unittest.main()

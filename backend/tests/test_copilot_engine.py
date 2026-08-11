import asyncio
import json
import unittest

from fireguard_backend.copilot import CopilotEngine
from fireguard_backend.copilot_schema import CopilotRunCreate


def run(coro):
    return asyncio.run(coro)


class EngineFakeProvider:
    def __init__(self, verification_status="pending", with_incident=False, event_type="fire_alarm"):
        self.verification_status = verification_status
        self.with_incident = with_incident
        self.event_type = event_type
        self.appended = []

    async def get_signal(self, event_id):
        return {
            "id": event_id, "enterprise_id": "ent-001", "event_type": self.event_type,
            "payload": {"controller_no": 2, "loop_no": 1, "point_no": 5},
            "verification_status": self.verification_status,
            "raw_ref": f"monitoring_events/{event_id}",
        }

    async def get_device_point(self, controller_no, loop_no, point_no):
        if (controller_no, loop_no, point_no) == (2, 1, 5):
            return {"point_id": "pt-02-01-005", "enterprise_id": "ent-001",
                    "controller_no": 2, "loop_no": 1, "point_no": 5,
                    "device_type": "点型感烟", "location": "电池车间PACK线烟感5"}
        return None

    async def get_enterprise(self, enterprise_id):
        enterprises = {
            "ent-001": {"id": "ent-001", "name": "电池车间（PACK/化成）", "district": "西区"},
            "ent-005": {"id": "ent-005", "name": "涂装车间（PT）", "district": "西区"},
            "ent-004": {"id": "ent-004", "name": "冲压车间", "district": "西区"},
        }
        return enterprises.get(enterprise_id)

    async def get_site_profile(self, enterprise_id):
        if enterprise_id not in ("ent-001", "ent-005"):
            return None
        return {"address": "星澜新能源汽车工厂（虚拟）西区", "hazards": ["锂电池模组半成品缓存区（合成）"],
                "access_points": ["车间南门（合成）"], "water_sources": ["厂区环网消火栓（合成）"],
                "facilities": ["自动喷水灭火系统（合成）"]}

    async def get_maintenance(self, enterprise_id):
        if enterprise_id == "ent-005":
            return [{"maintenance_id": "maint-001", "raw_ref": "demo/maint/001", "status": "completed"}]
        if enterprise_id == "ent-001":
            return [{"maintenance_id": "maint-003", "raw_ref": "demo/maint/003", "status": "overdue"},
                    {"maintenance_id": "maint-004", "raw_ref": "demo/maint/004", "status": "overdue"}]
        return []

    async def search_knowledge(self, query, limit=3):
        rows = []
        if "备电" in query:
            rows.append({"kb_id": "kb-002", "source": "GST-QKP02H/04H 安装使用说明书",
                         "section": "第8章 表3", "topic": "备电故障", "symptom": "开机后显示备电故障",
                         "guidance": "检查电池连接器及接线……", "keywords": "备电故障 蓄电池"})
        if "气体" in query or "延时" in query or "紧急停动" in query:
            rows.append({"kb_id": "kb-008", "source": "GST-QKP02H/04H 安装使用说明书",
                         "section": "7.1.8", "topic": "紧急停动",
                         "symptom": "气体灭火延时启动阶段需要中止",
                         "guidance": "延时期间可紧急停动……", "keywords": "气体灭火 延时 紧急停动"})
            rows.append({"kb_id": "kb-006", "source": "GST-QKP02H/04H 安装使用说明书",
                         "section": "附录二", "topic": "火警处理流程",
                         "symptom": "控制器发出火警", "guidance": "先转手动并核实……",
                         "keywords": "火警处理 手动 核实"})
        return rows[:limit]

    async def list_crews(self):
        return [
            {"id": "crew-wx-01", "district": "西区", "status": "available"},
            {"id": "crew-wb-01", "district": "西区", "status": "available"},
        ]

    async def get_incident(self, incident_id):
        return {"id": incident_id, "status": "pending_dispatch", "enterprise_id": "ent-001"}

    async def get_incident_by_event(self, event_id):
        if not self.with_incident:
            return None
        return await self.get_incident(501)

    async def append_incident_activity(self, incident_id, event_type, note, actor):
        self.appended.append((incident_id, event_type, note, actor))
        return {"incident_id": incident_id, "event_type": event_type}


SCENARIO_A = "A-false-alarm-paint-shop"
SCENARIO_B = "B-confirmed-fire-battery-workorder"
SCENARIO_C = "C-controller-fault-diagnosis"
SCENARIO_D = "D-insufficient-data-safe-abstention"
SCENARIO_E = "E-gas-release-delay-advisory"


def make_create(scenario_id, enterprise_id="ent-001", mode="scenario"):
    return CopilotRunCreate(
        enterprise_id=enterprise_id, event_id=1,
        reporter_text="消控室值班员上报（合成）", scenario_id=scenario_id, mode=mode,
    )


class ScenarioModeTests(unittest.TestCase):
    def test_all_five_fixtures_run_offline(self):
        cases = {
            SCENARIO_A: ("ent-005", "completed", EngineFakeProvider()),
            SCENARIO_B: ("ent-001", "completed", EngineFakeProvider()),
            SCENARIO_C: ("ent-001", "completed", EngineFakeProvider(event_type="fault")),
            SCENARIO_D: ("ent-004", "abstained", EngineFakeProvider()),
            SCENARIO_E: ("ent-005", "completed", EngineFakeProvider(event_type="start")),
        }
        for scenario_id, (enterprise_id, status, provider) in cases.items():
            engine = CopilotEngine(provider)
            result = run(engine.run(make_create(scenario_id, enterprise_id)))
            self.assertEqual(result.status, status, scenario_id)
            self.assertTrue(result.trace, scenario_id)
            self.assertTrue(result.is_simulation)
            self.assertEqual(result.model_name, "deterministic-template")
            self.assertIsNone(result.fallback_reason)

    def test_scenario_b_no_workorder_draft_before_confirmation(self):
        engine = CopilotEngine(EngineFakeProvider(verification_status="pending"))
        result = run(engine.run(make_create(SCENARIO_B)))
        names = [entry.name for entry in result.trace]
        self.assertNotIn("create_workorder_draft", names)
        self.assertIn("recommend_crew", names)
        self.assertIn("verification_result", result.plan.approval_required)

    def test_scenario_b_after_confirmation_includes_draft_and_briefs(self):
        provider = EngineFakeProvider(verification_status="confirmed", with_incident=True)
        engine = CopilotEngine(provider)
        result = run(engine.run(make_create(SCENARIO_B)))
        names = [entry.name for entry in result.trace]
        self.assertIn("create_workorder_draft", names)
        self.assertEqual(names.count("build_role_brief"), 3)
        draft = next(e for e in result.trace if e.name == "create_workorder_draft")
        self.assertTrue(draft.ok)
        roles = [e.data.get("role") for e in result.trace if e.name == "build_role_brief"]
        self.assertEqual(roles, ["duty_officer", "responder", "area_owner"])

    def test_scenario_c_fault_diagnosis_produces_cited_workorder(self):
        engine = CopilotEngine(EngineFakeProvider(event_type="fault"))
        result = run(engine.run(make_create(SCENARIO_C)))
        self.assertEqual(result.plan.intent, "fault_diagnosis")
        names = [entry.name for entry in result.trace]
        self.assertIn("search_manual", names)
        draft = next(e for e in result.trace if e.name == "create_workorder_draft")
        self.assertTrue(draft.ok, draft.error)
        self.assertEqual(draft.data["crew_id"], "crew-wb-01")
        refs = [ref.ref for ref in result.plan.evidence]
        self.assertIn("kb-002", refs)
        self.assertIn("maint-003", refs)
        self.assertIn("workorder_dispatch", result.plan.approval_required)

    def test_scenario_d_abstains_without_drafts(self):
        engine = CopilotEngine(EngineFakeProvider())
        result = run(engine.run(make_create(SCENARIO_D, "ent-004")))
        self.assertTrue(result.plan.abstained)
        self.assertEqual(result.plan.draft_outputs, {})
        self.assertIn("具体位置", result.plan.missing_fields)

    def test_scenario_e_gas_advisory_no_control_draft(self):
        engine = CopilotEngine(EngineFakeProvider(event_type="start"))
        result = run(engine.run(make_create(SCENARIO_E, "ent-005")))
        self.assertEqual(result.plan.intent, "gas_release_advisory")
        names = [entry.name for entry in result.trace]
        self.assertIn("search_manual", names)
        self.assertNotIn("create_workorder_draft", names)
        refs = [ref.ref for ref in result.plan.evidence]
        self.assertIn("kb-008", refs)


class StubModelClient:
    def __init__(self, content, model="stub-model"):
        self.content = content
        self.model = model

    async def complete(self, system_prompt, user_prompt):
        return self.content


class SlowModelClient:
    model = "stub-slow"

    async def complete(self, system_prompt, user_prompt):
        await asyncio.sleep(5)
        return "{}"


VALID_PLAN_JSON = json.dumps({
    "intent": "signal_verification",
    "missing_fields": ["现场复核人"],
    "plan": ["读取信号上下文", "生成核实草稿"],
    "tool_calls": [{"name": "get_signal_context", "arguments": {"event_id": 1}}],
    "evidence": [{"ref": "monitoring_events/1", "kind": "signal"}],
    "draft_outputs": {},
    "risks": [],
    "approval_required": ["verification_result"],
    "abstained": False,
}, ensure_ascii=False)


class LiveModeTests(unittest.TestCase):
    def make_live_create(self):
        return make_create(SCENARIO_A, "ent-005", mode="live")

    def test_valid_model_output_executes_through_guard(self):
        engine = CopilotEngine(EngineFakeProvider(), model_client=StubModelClient(VALID_PLAN_JSON))
        result = run(engine.run(self.make_live_create()))
        self.assertEqual(result.model_name, "stub-model")
        self.assertIsNone(result.fallback_reason)
        self.assertEqual([e.name for e in result.trace], ["get_signal_context"])
        self.assertEqual([e.ref for e in result.plan.evidence], ["monitoring_events/1"])
        self.assertEqual(result.rejected_evidence, [])

    def test_model_invented_evidence_is_dropped(self):
        content = json.loads(VALID_PLAN_JSON)
        content["evidence"] = [{"ref": "demo/alarm/does-not-exist", "kind": "signal"}]
        engine = CopilotEngine(EngineFakeProvider(), model_client=StubModelClient(json.dumps(content)))
        result = run(engine.run(self.make_live_create()))
        self.assertEqual(result.rejected_evidence, ["demo/alarm/does-not-exist"])
        self.assertEqual(result.plan.evidence, [])

    def test_model_unknown_tool_is_rejected_in_trace(self):
        content = json.loads(VALID_PLAN_JSON)
        content["tool_calls"] = [{"name": "drop_tables", "arguments": {}}]
        provider = EngineFakeProvider()
        engine = CopilotEngine(provider, model_client=StubModelClient(json.dumps(content)))
        result = run(engine.run(self.make_live_create()))
        self.assertEqual(result.trace[0].error, "unknown_tool")
        self.assertEqual(provider.appended, [])

    def test_invalid_json_falls_back_to_deterministic(self):
        engine = CopilotEngine(EngineFakeProvider(), model_client=StubModelClient("not json {"))
        result = run(engine.run(self.make_live_create()))
        self.assertEqual(result.fallback_reason, "model_invalid_output")
        self.assertEqual(result.status, "completed")
        self.assertEqual(result.model_name, "deterministic-template")
        self.assertTrue(result.trace)

    def test_schema_invalid_falls_back_to_deterministic(self):
        engine = CopilotEngine(EngineFakeProvider(), model_client=StubModelClient('{"intent": "bogus"}'))
        result = run(engine.run(self.make_live_create()))
        self.assertEqual(result.fallback_reason, "model_invalid_output")

    def test_timeout_falls_back_to_deterministic(self):
        engine = CopilotEngine(EngineFakeProvider(), model_client=SlowModelClient(), model_timeout=0.2)
        result = run(engine.run(self.make_live_create()))
        self.assertEqual(result.fallback_reason, "model_timeout")
        self.assertEqual(result.status, "completed")


if __name__ == "__main__":
    unittest.main()

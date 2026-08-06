import asyncio
import json
import unittest

from fireguard_backend.copilot import CopilotEngine
from fireguard_backend.copilot_schema import CopilotRunCreate


def run(coro):
    return asyncio.run(coro)


class EngineFakeProvider:
    def __init__(self, verification_status="pending", with_incident=False):
        self.verification_status = verification_status
        self.with_incident = with_incident
        self.appended = []

    async def get_signal(self, event_id):
        return {
            "id": event_id, "enterprise_id": "ent-001", "event_type": "fire_alarm",
            "payload": {"device_ref": "FACP-01-L2-07"},
            "verification_status": self.verification_status,
            "raw_ref": f"monitoring_events/{event_id}",
        }

    async def get_enterprise(self, enterprise_id):
        enterprises = {
            "ent-001": {"id": "ent-001", "name": "皓源新能源（虚拟）", "district": "高新区"},
            "ent-004": {"id": "ent-004", "name": "启明电子（虚拟）", "district": "新城区"},
        }
        return enterprises.get(enterprise_id)

    async def get_site_profile(self, enterprise_id):
        if enterprise_id != "ent-001":
            return None
        return {"address": "高新区新能源产业园 1 号生产厂房（合成）", "hazards": ["锂电池生产区域（合成）"],
                "access_points": ["厂区东门（合成）"], "water_sources": ["厂区消防水池（合成）"],
                "facilities": ["自动喷水灭火系统（合成）"]}

    async def get_maintenance(self, enterprise_id):
        if enterprise_id != "ent-001":
            return []
        return [{"maintenance_id": "maint-001", "raw_ref": "demo/maint/001", "status": "completed"}]

    async def list_stations(self):
        return [
            {"id": "station-hx-01", "district": "高新区", "status": "available"},
            {"id": "station-hx-02", "district": "高新区", "status": "available"},
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


SCENARIO_A = "A-false-alarm-maintenance-adjacent"
SCENARIO_B = "B-confirmed-fire-full-dispatch"
SCENARIO_C = "C-insufficient-data-safe-abstention"


def make_create(scenario_id, enterprise_id="ent-001", mode="scenario"):
    return CopilotRunCreate(
        enterprise_id=enterprise_id, event_id=1,
        reporter_text="控制室上报（合成）", scenario_id=scenario_id, mode=mode,
    )


class ScenarioModeTests(unittest.TestCase):
    def test_all_three_fixtures_run_offline(self):
        engine = CopilotEngine(EngineFakeProvider())
        expectations = {
            SCENARIO_A: ("ent-001", "completed"),
            SCENARIO_B: ("ent-001", "completed"),
            SCENARIO_C: ("ent-004", "abstained"),
        }
        for scenario_id, (enterprise_id, status) in expectations.items():
            result = run(engine.run(make_create(scenario_id, enterprise_id)))
            self.assertEqual(result.status, status, scenario_id)
            self.assertTrue(result.trace, scenario_id)
            self.assertTrue(result.is_simulation)
            self.assertEqual(result.model_name, "deterministic-template")
            self.assertIsNone(result.fallback_reason)

    def test_scenario_b_no_dispatch_draft_before_confirmation(self):
        engine = CopilotEngine(EngineFakeProvider(verification_status="pending"))
        result = run(engine.run(make_create(SCENARIO_B)))
        names = [entry.name for entry in result.trace]
        self.assertNotIn("create_dispatch_draft", names)
        self.assertIn("recommend_station", names)
        self.assertIn("verification_result", result.plan.approval_required)

    def test_scenario_b_after_confirmation_includes_draft_and_briefs(self):
        provider = EngineFakeProvider(verification_status="confirmed", with_incident=True)
        engine = CopilotEngine(provider)
        result = run(engine.run(make_create(SCENARIO_B)))
        names = [entry.name for entry in result.trace]
        self.assertIn("create_dispatch_draft", names)
        self.assertEqual(names.count("build_role_brief"), 3)
        draft = next(e for e in result.trace if e.name == "create_dispatch_draft")
        self.assertTrue(draft.ok)

    def test_scenario_c_abstains_without_drafts(self):
        engine = CopilotEngine(EngineFakeProvider())
        result = run(engine.run(make_create(SCENARIO_C, "ent-004")))
        self.assertTrue(result.plan.abstained)
        self.assertEqual(result.plan.draft_outputs, {})
        self.assertIn("具体地点", result.plan.missing_fields)


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
        return make_create(SCENARIO_A, mode="live")

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

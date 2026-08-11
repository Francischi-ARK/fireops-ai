import unittest

from fastapi.testclient import TestClient

import fireguard_backend.app as app_module
from fireguard_backend.copilot_schema import AgentPlan, CopilotRunResult, ToolTraceEntry


class FakeCopilotRepository:
    def __init__(self):
        self.runs = {}
        self.next_id = 1

    async def init(self):
        return None

    async def ping(self):
        return True

    async def create_copilot_run(self, payload, result):
        run_id = self.next_id
        self.next_id += 1
        self.runs[run_id] = {
            "id": run_id, "scenario_id": payload.scenario_id,
            "trace_json": result.model_dump(), "approvals": [],
        }
        return run_id

    async def get_copilot_run(self, run_id):
        return self.runs.get(run_id)

    async def add_copilot_approval(self, run_id, action, note):
        run = self.runs.get(run_id)
        if not run:
            return None
        recorded = action not in run["approvals"]
        if recorded:
            run["approvals"].append(action)
        return {"run_id": run_id, "approvals": list(run["approvals"]), "timeline_recorded": False}


class FakeCopilotEngine:
    async def run(self, payload, approvals=None):
        if payload.scenario_id == "bogus":
            raise ValueError("unknown_scenario")
        return CopilotRunResult(
            scenario_id=payload.scenario_id, mode=payload.mode,
            model_name="deterministic-template", status="completed",
            plan=AgentPlan(intent="signal_verification"),
            trace=[ToolTraceEntry(name="get_signal_context", arguments={"event_id": 1}, ok=True)],
        )


RUN_PAYLOAD = {
    "enterprise_id": "ent-001", "event_id": 1,
    "reporter_text": "控制室上报（合成）",
    "scenario_id": "A-false-alarm-paint-shop", "mode": "scenario",
}


class CopilotApiTests(unittest.TestCase):
    def setUp(self):
        self.original_repository = app_module.repository
        self.original_engine = app_module.copilot_engine
        self.repository = FakeCopilotRepository()
        app_module.repository = self.repository
        app_module.copilot_engine = FakeCopilotEngine()
        self.client_context = TestClient(app_module.app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        app_module.repository = self.original_repository
        app_module.copilot_engine = self.original_engine

    def test_run_create_get_and_approve(self):
        created = self.client.post("/copilot/runs", json=RUN_PAYLOAD)
        self.assertEqual(created.status_code, 201)
        body = created.json()
        self.assertTrue(body["is_simulation"])
        self.assertEqual(body["external_system"], "none")
        self.assertEqual(body["status"], "completed")

        run_id = body["run_id"]
        loaded = self.client.get(f"/copilot/runs/{run_id}")
        self.assertEqual(loaded.status_code, 200)
        trace = loaded.json()["trace_json"]["trace"]
        self.assertEqual(trace[0]["name"], "get_signal_context")

        approved = self.client.post(f"/copilot/runs/{run_id}/approve", json={"action": "verification_result"})
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.json()["approvals"], ["verification_result"])

        repeated = self.client.post(f"/copilot/runs/{run_id}/approve", json={"action": "verification_result"})
        self.assertEqual(repeated.json()["approvals"], ["verification_result"])

    def test_unknown_scenario_is_422(self):
        response = self.client.post("/copilot/runs", json={**RUN_PAYLOAD, "scenario_id": "bogus"})
        self.assertEqual(response.status_code, 422)

    def test_missing_run_is_404(self):
        self.assertEqual(self.client.get("/copilot/runs/999").status_code, 404)
        response = self.client.post("/copilot/runs/999/approve", json={"action": "workorder_dispatch"})
        self.assertEqual(response.status_code, 404)


if __name__ == "__main__":
    unittest.main()

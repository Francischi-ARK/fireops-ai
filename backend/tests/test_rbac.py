import unittest

from fastapi.testclient import TestClient

import fireguard_backend.app as app_module


class FakeRbacRepository:
    def __init__(self):
        self.calls = []

    async def init(self):
        return None

    async def ping(self):
        return True

    async def verify_signal(self, event_id, result, note, actor):
        self.calls.append(("verify", actor))
        return {"changed": False, "verification": {"status": result}, "incident": None}

    async def transition_dispatch(self, dispatch_id, action, note, actor):
        self.calls.append(("transition", actor))
        return {"changed": False, "dispatch": {"id": dispatch_id, "status": "issued"}}

    async def close_incident(self, incident_id, note, actor):
        self.calls.append(("close", actor))
        return {"changed": False, "incident": {"id": incident_id, "status": "closed"}}

    async def recheck_inspection_finding(self, finding_id, result="passed", note=""):
        self.calls.append(("recheck", finding_id))
        return {"changed": False, "finding": {"id": finding_id, "status": "closed"}}


class RbacApiTests(unittest.TestCase):
    def setUp(self):
        self.original = app_module.repository
        self.repository = FakeRbacRepository()
        app_module.repository = self.repository
        self.client = TestClient(app_module.app)

    def tearDown(self):
        app_module.repository = self.original

    def post(self, path, actor, body):
        headers = {"X-FireOps-Actor": actor} if actor else {}
        return self.client.post(path, json=body, headers=headers)

    def test_missing_actor_is_401(self):
        response = self.post("/signals/1/verification", None, {"result": "dismissed"})
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.json()["detail"], "actor_required")

    def test_wrong_role_is_403_without_repository_call(self):
        response = self.post("/signals/1/verification", "crew-demo", {"result": "dismissed"})
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["detail"], "role_not_allowed")
        self.assertEqual(self.repository.calls, [])

    def test_duty_can_verify_and_actor_is_audited(self):
        response = self.post("/signals/1/verification", "duty-demo", {"result": "dismissed"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.repository.calls[0], ("verify", "消控室值班员（演示）"))

    def test_only_crew_can_transition_dispatch(self):
        denied = self.post("/dispatches/1/transition", "duty-demo", {"action": "acknowledge"})
        allowed = self.post("/dispatches/1/transition", "crew-demo", {"action": "acknowledge"})
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(self.repository.calls[-1], ("transition", "处置/维保班组（演示）"))

    def test_only_inspector_can_recheck(self):
        denied = self.post("/inspection/findings/3/recheck", "owner-demo", {"result": "passed"})
        allowed = self.post("/inspection/findings/3/recheck", "inspector-demo", {"result": "passed"})
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(allowed.status_code, 200)

    def test_only_duty_can_close_incident(self):
        denied = self.post("/incidents/3/close", "crew-demo", {})
        allowed = self.post("/incidents/3/close", "duty-demo", {})
        self.assertEqual(denied.status_code, 403)
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(self.repository.calls[-1], ("close", "消控室值班员（演示）"))


if __name__ == "__main__":
    unittest.main()

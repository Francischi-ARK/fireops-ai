import unittest

from fastapi.testclient import TestClient

import fireguard_backend.app as app_module


class FakeRepository:
    def __init__(self):
        self.enterprise = {
            "id": "ent-001",
            "name": "电池车间（PACK/化成）",
            "industry": "锂电 PACK 与化成工艺",
            "district": "西区",
            "building": "电池车间厂房",
            "health_score": 58,
            "risk_level": "high",
            "online_rate": 89.0,
            "open_hazards": 12,
            "pending_signal_count": 3,
            "fault_count_30d": 18,
            "maintenance_overdue": 2,
            "last_seen_at": "2026-08-02T14:30:00+08:00",
            "updated_at": "2026-08-02T14:32:00+08:00",
        }

    async def init(self):
        return None

    async def ping(self):
        return True

    async def get_summary(self):
        return {"enterprise_count": 1, "high_risk_count": 1, "online_rate": 89.0, "pending_signal_count": 3, "maintenance_overdue": 2}

    async def list_enterprises(self):
        return [self.enterprise]

    async def get_enterprise(self, enterprise_id):
        return self.enterprise if enterprise_id == "ent-001" else None

    async def create_event(self, data):
        if data["enterprise_id"] != "ent-001":
            return None
        self.enterprise = {**self.enterprise, "pending_signal_count": 4, "health_score": 53}
        return {
            "id": 1,
            "enterprise_id": "ent-001",
            "event_type": data["event_type"],
            "severity": data["severity"],
            "source": data["source"],
            "payload": data["payload"],
            "occurred_at": "2026-08-02T14:32:00+08:00",
            "created_at": "2026-08-02T14:32:00+08:00",
            "enterprise": self.enterprise,
        }


class MonitoringApiTests(unittest.TestCase):
    def setUp(self):
        self.original_repository = app_module.repository
        app_module.repository = FakeRepository()
        self.client_context = TestClient(app_module.app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        app_module.repository = self.original_repository

    def test_summary_and_enterprises_are_available(self):
        self.assertEqual(self.client.get("/health").status_code, 200)
        self.assertEqual(self.client.get("/monitoring/summary").json()["enterprise_count"], 1)
        self.assertEqual(self.client.get("/monitoring/enterprises").json()["items"][0]["id"], "ent-001")

    def test_event_endpoint_updates_and_returns_enterprise(self):
        response = self.client.post("/monitoring/events", json={
            "enterprise_id": "ent-001",
            "event_type": "fire_alarm",
            "severity": "high",
            "source": "api_test",
        })

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["enterprise"]["pending_signal_count"], 4)

    def test_unknown_enterprise_and_untrusted_time_are_rejected(self):
        missing = self.client.post("/monitoring/events", json={
            "enterprise_id": "missing",
            "event_type": "fire_alarm",
            "severity": "high",
            "source": "api_test",
        })
        invalid_time = self.client.post("/monitoring/events", json={
            "enterprise_id": "ent-001",
            "event_type": "fire_alarm",
            "occurred_at": "2026-08-02T14:32:00",
        })

        self.assertEqual(missing.status_code, 404)
        self.assertEqual(invalid_time.status_code, 422)


if __name__ == "__main__":
    unittest.main()

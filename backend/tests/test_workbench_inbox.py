import unittest

from fastapi.testclient import TestClient

import fireguard_backend.app as app_module


class FakeInboxRepository:
    async def init(self):
        return None

    async def ping(self):
        return True

    async def get_workbench_inbox(self, role="crew", crew_id=None, owner=None):
        items = [
            {
                "inbox_id": "dispatch-1",
                "source": "incident_dispatch",
                "kind": "response",
                "status": "issued",
                "enterprise_id": "ent-001",
                "enterprise_name": "电池车间（PACK/化成）",
                "crew_id": "crew-wx-01",
                "crew_name": "微型消防站·西区站（虚拟）",
                "owner": "",
                "summary": "处置事件 #1",
                "incident_id": 1,
                "dispatch_id": 1,
                "event_id": None,
                "workorder_id": None,
                "created_at": "2026-08-08T10:00:00+00:00",
            },
            {
                "inbox_id": "workorder-2",
                "source": "ops_workorder",
                "kind": "repair",
                "status": "draft",
                "enterprise_id": "ent-001",
                "enterprise_name": "电池车间（PACK/化成）",
                "crew_id": "crew-wb-01",
                "crew_name": "crew-wb-01",
                "owner": "维保组带班员",
                "summary": "备电故障维修",
                "incident_id": None,
                "dispatch_id": None,
                "event_id": 9,
                "workorder_id": 2,
                "created_at": "2026-08-08T11:00:00+00:00",
            },
        ]
        if role == "crew" and crew_id == "crew-wx-01":
            items = [item for item in items if item["source"] == "incident_dispatch"]
        elif role == "crew" and crew_id == "crew-wb-01":
            items = [item for item in items if item["kind"] in ("repair", "maintenance")]
        return {
            "role": role,
            "crew_id": crew_id,
            "owner": owner,
            "items": items,
            "stations": [{"id": "crew-wx-01", "name": "微型消防站·西区站（虚拟）", "status": "available"}],
            "pending_signals": [],
        }


class WorkbenchInboxApiTests(unittest.TestCase):
    def setUp(self):
        self.original = app_module.repository
        app_module.repository = FakeInboxRepository()
        self.client = TestClient(app_module.app)

    def tearDown(self):
        app_module.repository = self.original

    def test_crew_inbox_filters_response_tasks(self):
        response = self.client.get("/workbench/inbox", params={"role": "crew", "crew_id": "crew-wx-01"})
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["role"], "crew")
        self.assertTrue(all(item["kind"] == "response" for item in body["items"]))

    def test_maintenance_crew_sees_repair_drafts(self):
        response = self.client.get("/workbench/inbox", params={"role": "crew", "crew_id": "crew-wb-01"})
        self.assertEqual(response.status_code, 200)
        kinds = {item["kind"] for item in response.json()["items"]}
        self.assertIn("repair", kinds)


if __name__ == "__main__":
    unittest.main()

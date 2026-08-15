import unittest

from fastapi.testclient import TestClient

import fireguard_backend.app as app_module


class FakeInboxRepository:
    async def init(self):
        return None

    async def ping(self):
        return True

    async def get_enterprise(self, enterprise_id):
        if enterprise_id != "ent-001":
            return None
        return {"id": "ent-001", "name": "电池车间（PACK/化成）"}

    async def get_enterprise_dossier(self, enterprise_id):
        if enterprise_id != "ent-001":
            return None
        return {
            "enterprise": {"id": "ent-001", "name": "电池车间（PACK/化成）"},
            "profile": {"hazards": ["锂电池模组半成品缓存区（合成）"]},
            "device_points": [{"point_id": "pt-02-01-005", "location": "PACK线烟感5"}],
            "recent_events": [{
                "id": 9, "event_type": "fault", "raw_ref": "monitoring_events/9",
            }],
            "findings": [{"id": 4, "title": "灭火器被遮挡", "evidence_refs": ["image:test"]}],
            "workorders": [{"id": 2, "kind": "repair", "event_id": 9, "status": "draft"}],
            "evidence_refs": ["monitoring_events/9", "image:test"],
            "next_context": {"event_id": 9, "workorder_id": 2, "finding_id": 4},
        }

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

    def test_enterprise_dossier_api_includes_maintenance_and_evidence(self):
        response = self.client.get("/enterprises/ent-001")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertIn("enterprise", body, "enterprise dossier response missing")
        self.assertEqual(body["enterprise"]["id"], "ent-001")
        self.assertEqual(body["device_points"][0]["point_id"], "pt-02-01-005")
        self.assertTrue(body["maintenance_records"])
        self.assertIn("maint-003", [item["maintenance_id"] for item in body["maintenance_records"]])
        self.assertIn("maint-003", body["evidence_refs"])
        self.assertEqual(body["next_context"]["workorder_id"], 2)


if __name__ == "__main__":
    unittest.main()

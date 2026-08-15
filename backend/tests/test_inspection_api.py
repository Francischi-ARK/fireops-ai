import unittest

from fastapi.testclient import TestClient

import fireguard_backend.app as app_module


class FakeInspectionRepository:
    def __init__(self):
        self.findings = {}
        self.workorders = {}
        self._fid = 0
        self._wid = 0

    async def init(self):
        return None

    async def ping(self):
        return True

    async def create_inspection_finding(self, data):
        self._fid += 1
        row = {"id": self._fid, **data}
        self.findings[self._fid] = row
        return row

    async def list_inspection_findings(self, enterprise_id=None):
        items = list(self.findings.values())
        if enterprise_id:
            items = [item for item in items if item["enterprise_id"] == enterprise_id]
        return items

    async def dispatch_inspection_finding(self, finding_id, note=""):
        finding = self.findings.get(finding_id)
        if not finding:
            return None
        finding = {**finding, "status": "assigned"}
        self.findings[finding_id] = finding
        self._wid += 1
        workorder = {
            "id": self._wid, "kind": "rectification", "status": "approved",
            "finding_id": finding_id, "enterprise_id": finding["enterprise_id"],
            "owner": finding["owner"], "summary": note or finding["title"],
        }
        self.workorders[self._wid] = workorder
        return {"changed": True, "finding": finding, "workorder": workorder}

    async def create_maintenance_workorder(self, data):
        self._wid += 1
        row = {"id": self._wid, "status": "draft", "kind": "maintenance", **data}
        self.workorders[self._wid] = row
        return row

    async def approve_workorder(self, workorder_id, note=""):
        row = self.workorders.get(workorder_id)
        if not row:
            return None
        row = {**row, "status": "approved"}
        self.workorders[workorder_id] = row
        return {"changed": True, "workorder": row}

    async def start_workorder(self, workorder_id, note=""):
        row = self.workorders.get(workorder_id)
        if not row:
            return None
        if row["status"] != "approved":
            raise ValueError("workorder_state_conflict")
        row = {**row, "status": "in_progress"}
        self.workorders[workorder_id] = row
        return {"changed": True, "workorder": row}

    async def complete_workorder(self, workorder_id, note=""):
        row = self.workorders.get(workorder_id)
        if not row:
            return None
        if row["status"] != "in_progress":
            raise ValueError("workorder_state_conflict")
        row = {**row, "status": "done"}
        self.workorders[workorder_id] = row
        return {"changed": True, "workorder": row}

    async def recheck_inspection_finding(self, finding_id, result="passed", note=""):
        finding = self.findings.get(finding_id)
        if not finding:
            return None
        if finding["status"] not in ("assigned", "in_progress"):
            raise ValueError("finding_state_conflict")
        workorder = next(
            (item for item in self.workorders.values() if item.get("finding_id") == finding_id),
            None,
        )
        if not workorder or workorder["status"] != "done":
            raise ValueError("recheck_workorder_not_done")
        if result == "failed":
            return {"changed": True, "finding": finding, "workorder": workorder, "recheck_result": "failed"}
        finding = {**finding, "status": "closed"}
        self.findings[finding_id] = finding
        return {
            "changed": True, "finding": finding, "workorder": workorder, "recheck_result": "passed",
        }

    async def list_workorders(self, enterprise_id=None, status=None):
        items = list(self.workorders.values())
        if enterprise_id:
            items = [item for item in items if item.get("enterprise_id") == enterprise_id]
        if status:
            items = [item for item in items if item.get("status") == status]
        return items


class InspectionApiTests(unittest.TestCase):
    def setUp(self):
        self.original_repository = app_module.repository
        self.repository = FakeInspectionRepository()
        app_module.repository = self.repository
        # overdue scan uses CopilotProvider.get_maintenance — stub via provider patch
        self.original_provider_ctor = app_module.CopilotProvider
        self.client = TestClient(app_module.app)
        self.inspector_headers = {"X-FireOps-Actor": "inspector-demo"}
        self.owner_headers = {"X-FireOps-Actor": "owner-demo"}

    def tearDown(self):
        app_module.repository = self.original_repository

    def test_analyze_create_and_dispatch_finding(self):
        analyze = self.client.post("/inspection/analyze", json={
            "enterprise_id": "ent-001",
            "image_asset": "assets/evidence-extinguisher-blocked.png",
            "voice_text": "灭火器被物料箱挡住",
        })
        self.assertEqual(analyze.status_code, 200)
        self.assertTrue(analyze.json()["draft"]["recognized"])

        created = self.client.post("/inspection/findings", json={
            "enterprise_id": "ent-001",
            "image_asset": "assets/evidence-extinguisher-blocked.png",
            "voice_text": "灭火器被物料箱挡住",
        }, headers=self.inspector_headers)
        self.assertEqual(created.status_code, 201)
        finding_id = created.json()["finding"]["id"]

        dispatched = self.client.post(
            f"/inspection/findings/{finding_id}/dispatch",
            json={"note": "请网格责任人今日处理"},
            headers=self.inspector_headers,
        )
        self.assertEqual(dispatched.status_code, 200)
        self.assertEqual(dispatched.json()["finding"]["status"], "assigned")
        self.assertEqual(dispatched.json()["workorder"]["kind"], "rectification")
        workorder_id = dispatched.json()["workorder"]["id"]
        premature_complete = self.client.post(
            f"/workorders/{workorder_id}/complete",
            json={"note": "不能跳过开工"}, headers=self.owner_headers,
        )
        self.assertEqual(premature_complete.status_code, 409)
        premature_recheck = self.client.post(
            f"/inspection/findings/{finding_id}/recheck",
            json={"result": "passed", "note": "工单尚未完成"}, headers=self.inspector_headers,
        )
        self.assertEqual(premature_recheck.status_code, 409)
        started = self.client.post(
            f"/workorders/{workorder_id}/start",
            json={"note": "网格责任人开始整改"}, headers=self.owner_headers,
        )
        self.assertEqual(started.status_code, 200)
        self.assertEqual(started.json()["workorder"]["status"], "in_progress")
        completed = self.client.post(
            f"/workorders/{workorder_id}/complete",
            json={"note": "现场遮挡已清除"}, headers=self.owner_headers,
        )
        self.assertEqual(completed.status_code, 200)
        self.assertEqual(completed.json()["workorder"]["status"], "done")
        rechecked = self.client.post(
            f"/inspection/findings/{finding_id}/recheck",
            json={"result": "passed", "note": "复查通过，灭火器通道畅通"}, headers=self.inspector_headers,
        )
        self.assertEqual(rechecked.status_code, 200)
        self.assertEqual(rechecked.json()["finding"]["status"], "closed")
        self.assertEqual(rechecked.json()["recheck_result"], "passed")

    def test_inspection_provider_and_abstention_are_visible_without_persistence(self):
        response = self.client.post("/inspection/analyze", json={
            "enterprise_id": "ent-001",
            "image_asset": "",
            "voice_text": "好像有点不对",
            "mode": "live",
        })
        self.assertEqual(response.status_code, 200)
        draft = response.json()["draft"]
        self.assertTrue(draft["abstained"])
        self.assertEqual(draft["provider"], "local-demo")
        self.assertEqual(draft["fallback_reason"], "vision_provider_not_configured")
        self.assertEqual(self.repository.findings, {})

        create = self.client.post("/inspection/findings", json={
            "enterprise_id": "ent-001",
            "image_asset": "",
            "voice_text": "好像有点不对",
            "mode": "live",
        }, headers=self.inspector_headers)
        self.assertEqual(create.status_code, 422)
        self.assertEqual(self.repository.findings, {})

    def test_maintenance_scan_creates_draft_workorders(self):
        fake_rows = [{
            "maintenance_id": "maint-003",
            "enterprise_id": "ent-001",
            "facility_type": "火灾自动报警系统",
            "maintenance_type": "主机备电蓄电池季度检查",
            "planned_at": "2026-07-05T09:00:00+08:00",
            "status": "overdue",
            "raw_ref": "demo/maint/003",
        }]

        class FakeProvider:
            def __init__(self, _repo):
                pass

            async def get_maintenance(self, enterprise_id):
                return fake_rows if enterprise_id == "ent-001" else []

        app_module.CopilotProvider = FakeProvider
        try:
            response = self.client.post("/maintenance/overdue-scan", json={
                "enterprise_id": "ent-001",
                "create_drafts": True,
            }, headers=self.inspector_headers)
        finally:
            app_module.CopilotProvider = self.original_provider_ctor
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(len(body["suggestions"]), 1)
        self.assertEqual(len(body["workorders"]), 1)
        workorder_id = body["workorders"][0]["id"]
        approved = self.client.post(
            f"/workorders/{workorder_id}/approve",
            json={"note": "确认派维保组"}, headers=self.inspector_headers,
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(approved.json()["workorder"]["status"], "approved")


if __name__ == "__main__":
    unittest.main()

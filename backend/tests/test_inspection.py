import unittest

from fireguard_backend.inspection import analyze_inspection, scan_overdue_maintenance


class InspectionAnalyzeTests(unittest.TestCase):
    def test_extinguisher_image_recognized(self):
        draft = analyze_inspection(
            "ent-001",
            image_asset="assets/evidence-extinguisher-blocked.png",
            voice_text="通道东侧灭火器被箱子挡住了",
        )
        self.assertTrue(draft["recognized"])
        self.assertFalse(draft["abstained"])
        self.assertIn("灭火器", draft["title"])
        self.assertEqual(draft["owner"], "李强")
        self.assertGreater(draft["confidence"], 0.5)

    def test_voice_only_exit_sign(self):
        draft = analyze_inspection("ent-001", image_asset="", voice_text="化成区疏散指示灯不亮")
        self.assertTrue(draft["recognized"])
        self.assertIn("疏散", draft["title"])

    def test_insufficient_evidence_abstains(self):
        draft = analyze_inspection("ent-001", image_asset="", voice_text="好像有点不对")
        self.assertTrue(draft["abstained"])
        self.assertFalse(draft["recognized"])
        self.assertIn("hazard_type", draft["missing_fields"])


class MaintenanceScanTests(unittest.TestCase):
    def test_overdue_rows_become_drafts(self):
        rows = [
            {
                "maintenance_id": "maint-003",
                "enterprise_id": "ent-001",
                "facility_type": "火灾自动报警系统",
                "maintenance_type": "主机备电蓄电池季度检查",
                "planned_at": "2026-07-05T09:00:00+08:00",
                "status": "overdue",
                "raw_ref": "demo/maint/003",
            },
            {
                "maintenance_id": "maint-001",
                "enterprise_id": "ent-005",
                "facility_type": "火灾自动报警系统",
                "maintenance_type": "月度测试",
                "planned_at": "2026-07-28T09:00:00+08:00",
                "status": "completed",
                "raw_ref": "demo/maint/001",
            },
        ]
        drafts = scan_overdue_maintenance(rows, "ent-001")
        self.assertEqual(len(drafts), 1)
        self.assertEqual(drafts[0]["recommended_crew_id"], "crew-wb-01")
        self.assertIn("预防性维保逾期", drafts[0]["summary"])


if __name__ == "__main__":
    unittest.main()

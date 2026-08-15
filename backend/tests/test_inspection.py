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
        self.assertEqual(draft["mode"], "scenario")
        self.assertEqual(draft["provider"], "local-demo")
        self.assertEqual(draft["model_name"], "deterministic-image-catalog-v1")
        self.assertEqual(draft["fallback_reason"], "")

    def test_voice_only_exit_sign(self):
        draft = analyze_inspection("ent-001", image_asset="", voice_text="化成区疏散指示灯不亮")
        self.assertTrue(draft["recognized"])
        self.assertIn("疏散", draft["title"])

    def test_insufficient_evidence_abstains(self):
        draft = analyze_inspection("ent-001", image_asset="", voice_text="好像有点不对")
        self.assertTrue(draft["abstained"])
        self.assertFalse(draft["recognized"])
        self.assertIn("hazard_type", draft["missing_fields"])
        self.assertEqual(draft["provider"], "local-demo")

    def test_live_mode_without_provider_falls_back_explicitly(self):
        draft = analyze_inspection(
            "ent-001",
            image_asset="assets/evidence-extinguisher-blocked.png",
            mode="live",
        )
        self.assertEqual(draft["mode"], "scenario")
        self.assertEqual(draft["provider"], "local-demo")
        self.assertEqual(draft["fallback_reason"], "vision_provider_not_configured")
        self.assertTrue(draft["is_simulation"])

    def test_live_provider_can_be_injected_without_business_state(self):
        def provider(_enterprise_id, _image_asset, _voice_text):
            return {
                "recognized": True,
                "abstained": False,
                "confidence": 0.91,
                "title": "测试隐患",
                "category": "现场隐患",
                "severity": "high",
                "location": "测试点位",
                "description": "测试 provider 返回的草稿",
                "department": "生产部",
                "owner": "李强",
                "tag": "现场隐患",
                "pin": {"left": 50, "top": 50},
                "missing_fields": [],
                "evidence_refs": ["image:test.png"],
                "provider": "test-live-provider",
                "model_name": "test-vision-model",
            }

        draft = analyze_inspection(
            "ent-001",
            image_asset="test.png",
            mode="live",
            live_provider=provider,
        )
        self.assertEqual(draft["mode"], "live")
        self.assertEqual(draft["provider"], "test-live-provider")
        self.assertFalse(draft["is_simulation"])
        self.assertEqual(draft["external_system"], "vision-provider")


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

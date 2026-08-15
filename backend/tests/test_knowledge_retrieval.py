import asyncio
import json
import unittest
from pathlib import Path

from fireguard_backend.copilot_provider import CopilotProvider


ROOT = Path(__file__).resolve().parents[2]


class KnowledgeRetrievalTests(unittest.TestCase):
    def setUp(self):
        self.provider = CopilotProvider(None, ROOT / "demo-data")

    def search(self, query, **filters):
        return asyncio.run(self.provider.search_knowledge(query, limit=3, **filters))

    def test_oral_synonym_retrieves_battery_fault(self):
        rows = self.search("主机备用电源报警，充了八小时还没恢复")
        self.assertEqual(rows[0]["kb_id"], "kb-002")

    def test_unknown_model_does_not_cite_model_specific_manual(self):
        rows = self.search("备电故障怎么处理", device_model="OTHER-9000")
        self.assertNotIn("kb-002", [row["kb_id"] for row in rows])

    def test_result_contains_citation_and_match_explanation(self):
        row = self.search("RS485通讯超时怎么排查")[0]
        self.assertEqual(row["kb_id"], "kb-012")
        self.assertEqual(row["document_type"], "protocol")
        self.assertTrue(row["citation"])
        self.assertTrue(row["match_reasons"])
        self.assertGreater(row["retrieval_score"], 0)

    def test_unrelated_question_returns_no_evidence(self):
        self.assertEqual(self.search("摄像头RTSP密码忘了"), [])

    def test_eval_set_top3_recall_and_abstention(self):
        document = json.loads((ROOT / "demo-data/knowledge_eval.json").read_text(encoding="utf-8"))
        answered = 0
        hit = 0
        no_answer = 0
        correct_abstention = 0
        for case in document["cases"]:
            refs = [row["kb_id"] for row in self.search(case["query"])]
            if case["expected"]:
                answered += 1
                hit += int(any(ref in refs for ref in case["expected"]))
            else:
                no_answer += 1
                correct_abstention += int(not refs)
        self.assertGreaterEqual(hit / answered, 0.9)
        self.assertEqual(correct_abstention, no_answer)


if __name__ == "__main__":
    unittest.main()

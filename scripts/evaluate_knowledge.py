#!/usr/bin/env python3
import asyncio
import json
from pathlib import Path

from fireguard_backend.copilot_provider import CopilotProvider


ROOT = Path(__file__).resolve().parents[1]


async def main():
    cases = json.loads((ROOT / "demo-data/knowledge_eval.json").read_text(encoding="utf-8"))["cases"]
    provider = CopilotProvider(None, ROOT / "demo-data")
    rows = []
    for case in cases:
        found = await provider.search_knowledge(case["query"], 3)
        refs = [item["kb_id"] for item in found]
        rows.append({**case, "retrieved": refs, "hit_top1": bool(refs) and refs[0] in case["expected"],
                     "hit_top3": any(ref in refs for ref in case["expected"]),
                     "abstained": not refs})
    answered = [row for row in rows if row["expected"]]
    unknown = [row for row in rows if not row["expected"]]
    report = {
        "schema_version": "fireops-knowledge-eval-report/v1",
        "cases": len(rows),
        "top1_recall": sum(row["hit_top1"] for row in answered) / len(answered),
        "top3_recall": sum(row["hit_top3"] for row in answered) / len(answered),
        "unknown_abstention_rate": sum(row["abstained"] for row in unknown) / len(unknown),
        "results": rows,
    }
    target = ROOT / "docs/submission/knowledge-eval-report.json"
    target.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: value for key, value in report.items() if key != "results"}, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())

"""Wires copilot tools to the real Postgres repository and demo CSV files."""

import csv
import re
from pathlib import Path

DEMO_DATA_DIR = Path(__file__).resolve().parents[2] / "demo-data"

KNOWLEDGE_ALIASES = {
    "备用电源": "备电", "备用电池": "蓄电池", "电瓶": "蓄电池",
    "接头": "连接器", "八小时": "8小时", "还没恢复": "不能消除",
    "一路": "回路", "探头": "探测器", "倒计时": "延时",
    "停止": "停动", "喷放": "气体灭火", "销号": "销项",
    "报火警": "火警处理",
}


def _normalise_knowledge_text(value):
    text = str(value or "").lower()
    for source, target in KNOWLEDGE_ALIASES.items():
        text = text.replace(source, target)
    return re.sub(r"[^0-9a-z\u4e00-\u9fff]+", "", text)


class CopilotProvider:
    def __init__(self, repository, demo_data_dir=DEMO_DATA_DIR):
        self.repository = repository
        self.demo_data_dir = Path(demo_data_dir)

    async def get_signal(self, event_id):
        return await self.repository.get_signal(event_id)

    async def get_enterprise(self, enterprise_id):
        return await self.repository.get_enterprise(enterprise_id)

    async def get_site_profile(self, enterprise_id):
        return await self.repository.get_site_profile(enterprise_id)

    async def get_device_point(self, controller_no, loop_no, point_no):
        return await self.repository.get_device_point(controller_no, loop_no, point_no)

    async def get_maintenance(self, enterprise_id):
        path = self.demo_data_dir / "maintenance_records.csv"
        if not path.exists():
            return []
        with path.open(encoding="utf-8") as handle:
            return [row for row in csv.DictReader(handle) if row["enterprise_id"] == enterprise_id]

    async def search_knowledge(self, query, limit=3, device_model=None, document_type=None):
        """领域混合检索：精确元数据过滤 + 同义词归一化 + 关键词重排。"""
        path = self.demo_data_dir / "knowledge.csv"
        if not path.exists():
            return []
        normalised_query = _normalise_knowledge_text(query)
        if not normalised_query:
            return []
        scored = []
        with path.open(encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                row_model = row.get("device_model", "").strip()
                if device_model and row_model and row_model.casefold() != device_model.casefold():
                    continue
                if document_type and row.get("document_type") != document_type:
                    continue

                reasons = []
                score = 0
                topic = _normalise_knowledge_text(row["topic"])
                symptom = _normalise_knowledge_text(row["symptom"])
                if topic and topic in normalised_query:
                    score += 12
                    reasons.append(f"主题：{row['topic']}")
                if symptom and symptom in normalised_query:
                    score += 8
                    reasons.append(f"现象：{row['symptom']}")
                for keyword in row["keywords"].split():
                    token = _normalise_knowledge_text(keyword)
                    if token and token in normalised_query:
                        score += 4 if len(token) >= 3 else 2
                        reasons.append(f"关键词：{keyword}")
                if row_model and _normalise_knowledge_text(row_model) in normalised_query:
                    score += 16
                    reasons.append(f"型号：{row_model}")
                if score <= 0:
                    continue
                result = dict(row)
                result["retrieval_score"] = score
                result["match_reasons"] = list(dict.fromkeys(reasons))
                result["citation"] = {
                    "document": row["source"], "section": row["section"],
                    "page": row.get("page", ""), "evidence_ref": row["kb_id"],
                }
                scored.append((score, row["kb_id"], result))
        scored.sort(key=lambda item: (-item[0], item[1]))
        return [row for _, _, row in scored[:limit]]

    async def list_crews(self):
        return await self.repository.list_stations()

    async def get_incident(self, incident_id):
        return await self.repository.get_incident(incident_id)

    async def get_incident_by_event(self, event_id):
        return await self.repository.get_incident_by_event(event_id)

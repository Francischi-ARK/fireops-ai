"""Wires copilot tools to the real Postgres repository and demo CSV files."""

import csv
from pathlib import Path

DEMO_DATA_DIR = Path(__file__).resolve().parents[2] / "demo-data"


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

    async def search_knowledge(self, query, limit=3):
        """确定性的知识库关键词检索：按命中关键词数排序，零命中不返回。

        ponytail: 演示用简化实现；生产环境可替换为向量检索 + 重排，接口不变。
        """
        path = self.demo_data_dir / "knowledge.csv"
        if not path.exists():
            return []
        tokens = [token for token in query.replace("，", " ").replace("、", " ").split() if token]
        if not tokens:
            return []
        scored = []
        with path.open(encoding="utf-8") as handle:
            for row in csv.DictReader(handle):
                haystack = " ".join((row["topic"], row["symptom"], row["guidance"], row["keywords"]))
                score = sum(1 for token in tokens if token in haystack)
                if score > 0:
                    scored.append((score, row))
        scored.sort(key=lambda item: (-item[0], item[1]["kb_id"]))
        return [row for _, row in scored[:limit]]

    async def list_crews(self):
        return await self.repository.list_stations()

    async def get_incident(self, incident_id):
        return await self.repository.get_incident(incident_id)

    async def get_incident_by_event(self, event_id):
        return await self.repository.get_incident_by_event(event_id)

    async def append_incident_activity(self, incident_id, event_type, note, actor):
        return await self.repository.append_incident_activity(incident_id, event_type, note, actor)

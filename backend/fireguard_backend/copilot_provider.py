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

    async def get_maintenance(self, enterprise_id):
        path = self.demo_data_dir / "maintenance_records.csv"
        if not path.exists():
            return []
        with path.open(encoding="utf-8") as handle:
            return [row for row in csv.DictReader(handle) if row["enterprise_id"] == enterprise_id]

    async def list_stations(self):
        return await self.repository.list_stations()

    async def get_incident(self, incident_id):
        return await self.repository.get_incident(incident_id)

    async def get_incident_by_event(self, event_id):
        return await self.repository.get_incident_by_event(event_id)

    async def append_incident_activity(self, incident_id, event_type, note, actor):
        return await self.repository.append_incident_activity(incident_id, event_type, note, actor)

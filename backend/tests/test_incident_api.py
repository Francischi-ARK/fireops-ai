import unittest

from fastapi.testclient import TestClient

import fireguard_backend.app as app_module


class FakeIncidentRepository:
    async def init(self):
        return None

    async def ping(self):
        return True

    async def get_incident_overview(self):
        return {"signals": [], "incidents": [], "stations": []}

    async def get_station_tasks(self, station_id):
        if station_id == "missing":
            return None
        return {"station": {"id": station_id}, "tasks": []}


class IncidentApiTests(unittest.TestCase):
    def setUp(self):
        self.original_repository = app_module.repository
        app_module.repository = FakeIncidentRepository()
        self.client_context = TestClient(app_module.app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        app_module.repository = self.original_repository

    def test_overview_and_station_tasks_are_simulation_only(self):
        overview = self.client.get("/incidents/overview")
        station = self.client.get("/stations/station-hx-01/tasks")
        missing = self.client.get("/stations/missing/tasks")

        self.assertEqual(overview.status_code, 200)
        self.assertEqual(overview.json()["is_simulation"], True)
        self.assertEqual(overview.json()["external_system"], "none")
        self.assertEqual(station.status_code, 200)
        self.assertEqual(missing.status_code, 404)


if __name__ == "__main__":
    unittest.main()

import unittest

from fireguard_backend import domain, repository


class IncidentDomainTests(unittest.TestCase):
    def test_incident_helpers_exist(self):
        self.assertTrue(hasattr(domain, "next_dispatch_status"))
        self.assertTrue(hasattr(domain, "station_status_for_dispatch"))
        self.assertTrue(hasattr(domain, "build_response_brief"))

    def test_dispatch_transition_is_ordered_and_idempotent(self):
        self.assertEqual(domain.next_dispatch_status("issued", "acknowledge"), "acknowledged")
        self.assertEqual(domain.next_dispatch_status("acknowledged", "acknowledge"), "acknowledged")
        with self.assertRaisesRegex(ValueError, "invalid_transition"):
            domain.next_dispatch_status("issued", "depart")

    def test_station_status_follows_dispatch_status(self):
        self.assertEqual(domain.station_status_for_dispatch("issued"), "awaiting_ack")
        self.assertEqual(domain.station_status_for_dispatch("acknowledged"), "assigned")
        self.assertEqual(domain.station_status_for_dispatch("enroute"), "enroute")
        self.assertEqual(domain.station_status_for_dispatch("arrived"), "on_scene")

    def test_database_schema_accepts_archived_terminal_states(self):
        migration = getattr(repository, "MIGRATE_INCIDENT_STATUSES_SQL", "")
        self.assertIn("'closed'", repository.INCIDENT_SCHEMA_SQL)
        self.assertIn("'completed'", repository.INCIDENT_SCHEMA_SQL)
        self.assertIn("fire_incidents_status_check", migration)
        self.assertIn("incident_dispatches_status_check", migration)

    def test_response_brief_uses_sources_and_keeps_missing_fields_unknown(self):
        brief = domain.build_response_brief({
            "address": None,
            "hazards": ["锂电池生产区域（合成）"],
            "access_points": [],
            "water_sources": ["厂区消防水池（合成）"],
            "facilities": [],
        })

        self.assertEqual(brief["address"], "未知")
        self.assertEqual(len(brief["items"]), 4)
        self.assertTrue(all(item["sources"] for item in brief["items"]))
        self.assertIn("未知", brief["items"][1]["text"])
        self.assertEqual(brief["disclaimer"], "仅供辅助，不替代现场指挥")


if __name__ == "__main__":
    unittest.main()

import unittest

from fastapi.testclient import TestClient

import fireguard_backend.app as app_module
from fireguard_backend import modbus


class FakeGatewayRepository:
    def __init__(self):
        self.created = []

    async def init(self):
        return None

    async def ping(self):
        return True

    async def get_device_point(self, controller_no, loop_no, point_no):
        if (controller_no, loop_no, point_no) == (1, 1, 3):
            return {"point_id": "pt-01-01-003", "enterprise_id": "ent-005",
                    "controller_no": 1, "loop_no": 1, "point_no": 3,
                    "device_type": "点型感烟", "location": "PT1层消防通道烟感3",
                    "protect_target": "涂装车间一层疏散通道"}
        return None

    async def get_controller_area(self, controller_no):
        return "ent-001" if controller_no == 2 else None

    async def create_event(self, data):
        self.created.append(data)
        return {"id": 42, "created_at": "2026-08-08T10:00:00+08:00", **data,
                "occurred_at": "2026-08-08T10:00:00+08:00"}


class GatewayApiTests(unittest.TestCase):
    def setUp(self):
        self.original_repository = app_module.repository
        self.repository = FakeGatewayRepository()
        app_module.repository = self.repository
        self.client_context = TestClient(app_module.app)
        self.client = self.client_context.__enter__()

    def tearDown(self):
        self.client_context.__exit__(None, None, None)
        app_module.repository = self.original_repository

    def test_fire_alarm_frame_resolves_point_and_creates_event(self):
        frame = modbus.build_event_frame("fire_alarm", 1, 1, 3, device_type_code=3).hex()
        response = self.client.post("/gateway/modbus/frames", json={"frame_hex": frame})
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertTrue(body["is_simulation"])
        self.assertEqual(body["decoded"]["event_type_label"], "火警")
        self.assertEqual(body["decoded"]["device_ref"], "pt-01-01-003")
        self.assertEqual(body["event"]["enterprise_id"], "ent-005")
        self.assertEqual(self.repository.created[0]["event_type"], "fire_alarm")
        self.assertEqual(self.repository.created[0]["severity"], "high")

    def test_controller_fault_falls_back_to_controller_area(self):
        frame = modbus.build_event_frame("fault", 2, 0, 0, device_type_code=0, data_source=5).hex()
        response = self.client.post("/gateway/modbus/frames", json={"frame_hex": frame})
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(body["event"]["enterprise_id"], "ent-001")
        self.assertEqual(body["decoded"]["device_ref"], "controller-02")
        self.assertEqual(self.repository.created[0]["severity"], "medium")

    def test_manual_call_point_is_critical(self):
        frame = modbus.build_event_frame("fire_alarm", 2, 1, 9, device_type_code=11).hex()
        response = self.client.post("/gateway/modbus/frames", json={"frame_hex": frame})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.repository.created[0]["severity"], "critical")

    def test_bad_crc_is_422(self):
        frame = bytearray(modbus.build_event_frame("fire_alarm", 1, 1, 3))
        frame[-1] ^= 0xFF
        response = self.client.post("/gateway/modbus/frames", json={"frame_hex": bytes(frame).hex()})
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["detail"], "crc_mismatch")

    def test_unregistered_controller_is_404(self):
        frame = modbus.build_event_frame("fire_alarm", 9, 1, 1).hex()
        response = self.client.post("/gateway/modbus/frames", json={"frame_hex": frame})
        self.assertEqual(response.status_code, 404)

    def test_no_event_update_frame_returns_note(self):
        frame = bytearray(modbus.build_event_frame("fire_alarm", 1, 1, 1))
        frame[3] = 0x00
        crc = modbus.crc16_modbus(bytes(frame[:-2]))
        frame[-2], frame[-1] = (crc >> 8) & 0xFF, crc & 0xFF
        response = self.client.post("/gateway/modbus/frames", json={"frame_hex": bytes(frame).hex()})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json()["note"], "no_event_update")
        self.assertEqual(self.repository.created, [])


if __name__ == "__main__":
    unittest.main()

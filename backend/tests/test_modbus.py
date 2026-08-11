import unittest

from fireguard_backend import modbus


class Crc16Tests(unittest.TestCase):
    def test_known_vector(self):
        # 01 03 00 00 00 04 的 Modbus CRC16 = 0x0944（低字节 0x44，高字节 0x09）。
        self.assertEqual(modbus.crc16_modbus(bytes.fromhex("010300000004")), 0x0944)
        # 规约表 3 规定帧内 CRC 高字节在前。
        frame = modbus.build_query_frame()
        self.assertEqual(frame[-2:], bytes([0x09, 0x44]))


class PointCodeTests(unittest.TestCase):
    def test_roundtrip(self):
        code = modbus.encode_point_code(2, 1, 5)
        self.assertEqual(code, "0020100500")
        self.assertEqual(modbus.decode_point_code(code),
                         {"controller_no": 2, "loop_no": 1, "point_no": 5})

    def test_out_of_range_rejected(self):
        with self.assertRaises(modbus.ModbusFrameError):
            modbus.encode_point_code(100, 1, 1)


class EventFrameTests(unittest.TestCase):
    def test_fire_alarm_roundtrip(self):
        frame = modbus.build_event_frame("fire_alarm", 1, 1, 3, device_type_code=3)
        self.assertEqual(len(frame), modbus.RESPONSE_FRAME_LENGTH)
        event = modbus.parse_event_frame(frame)
        self.assertEqual(event.event_type, "fire_alarm")
        self.assertEqual(event.event_type_label, "火警")
        self.assertEqual((event.controller_no, event.loop_no, event.point_no), (1, 1, 3))
        self.assertEqual(event.device_type_label, "点型感烟")
        self.assertEqual(event.data_source_label, "总线设备")

    def test_controller_fault_from_self(self):
        frame = modbus.build_event_frame("fault", 2, 0, 0, device_type_code=0, data_source=5)
        event = modbus.parse_event_frame(frame)
        self.assertEqual(event.event_type, "fault")
        self.assertEqual(event.data_source_label, "自身设备")
        self.assertEqual(event.device_type_label, "控制器部件")

    def test_no_event_update_returns_none(self):
        frame = modbus.build_event_frame("fire_alarm", 1, 1, 1)
        mutated = bytearray(frame)
        mutated[3] = 0x00  # 事件类型 00h：无事件更新
        crc = modbus.crc16_modbus(bytes(mutated[:-2]))
        mutated[-2], mutated[-1] = (crc >> 8) & 0xFF, crc & 0xFF
        self.assertIsNone(modbus.parse_event_frame(bytes(mutated)))

    def test_bad_crc_rejected(self):
        frame = bytearray(modbus.build_event_frame("fire_alarm", 1, 1, 1))
        frame[-1] ^= 0xFF
        with self.assertRaises(modbus.ModbusFrameError):
            modbus.parse_event_frame(bytes(frame))

    def test_unknown_event_type_rejected(self):
        with self.assertRaises(modbus.ModbusFrameError):
            modbus.build_event_frame("meltdown", 1, 1, 1)

    def test_hex_parsing_and_payload(self):
        frame = modbus.build_event_frame("fire_alarm", 2, 1, 5)
        event = modbus.parse_event_frame_hex(frame.hex())
        payload = event.to_payload()
        self.assertEqual(payload["protocol"], "modbus-rtu/gst-event-pool")
        self.assertEqual(payload["point_code"], "0020100500")
        self.assertEqual(payload["frame_hex"], frame.hex())
        with self.assertRaises(modbus.ModbusFrameError):
            modbus.parse_event_frame_hex("zz")

    def test_query_frame_shape(self):
        frame = modbus.build_query_frame()
        self.assertEqual(len(frame), modbus.QUERY_FRAME_LENGTH)
        self.assertEqual(frame[1], 0x03)


if __name__ == "__main__":
    unittest.main()

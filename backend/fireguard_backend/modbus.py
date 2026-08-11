"""GST 火灾报警控制器 Modbus RTU 事件帧的构造与解析。

依据《海湾消防控制器 MODBUS RTU 通讯规约》与《高能总线系列控制器
MODBUS 通讯规约 V1.1》实现：控制器作为从机、以"事件池"方式对外输出
火警/故障/启动/反馈等事件。第三方主机（本项目中为 ARK 工业网关）以
03/04 功能码轮询 40001~40004 寄存器，控制器返回 13 字节应答帧：

    Byte1   从机地址
    Byte2   功能码 (0x03 / 0x04)
    Byte3   应答字节数 (0x08)
    Byte4   事件类型（01h 火警 … 0Ch 控制器状态）
    Byte5   数据源（0 未定义 / 1 总线设备 / 2 手动盘 / 3 直控盘 / 4 网络设备 / 5 自身设备）
    Byte6   设备类型（见说明书表 1）
    Byte7~11 二次码（压缩 BCD，10 位数字）
    Byte12  CRC 高字节
    Byte13  CRC 低字节

二次码采用本工厂编码表约定（企业自定义，与点位表 device_points 对应）：
    10 位 = 预留(1) + 机号(2) + 回路(2) + 点位(3) + 预留(2)
例如 机 1 / 回路 1 / 点位 3 -> "0010100300"。

本模块仅用于演示仿真与解析，不向任何真实设备发送指令。
"""

from dataclasses import dataclass
from typing import Optional

EVENT_TYPES = {
    0x01: "fire_alarm",
    0x02: "fault",
    0x03: "start",
    0x04: "stop",
    0x05: "isolate",
    0x06: "release",
    0x07: "supervise",
    0x08: "feedback",
    0x09: "action",
    0x0A: "reset",
    0x0B: "restore",
    0x0C: "controller_status",
}

EVENT_TYPE_LABELS = {
    "fire_alarm": "火警",
    "fault": "故障",
    "start": "启动",
    "stop": "停动",
    "isolate": "隔离",
    "release": "释放",
    "supervise": "监管",
    "feedback": "反馈",
    "action": "动作",
    "reset": "复位操作",
    "restore": "恢复",
    "controller_status": "控制器状态",
}

DATA_SOURCES = {
    0: "未定义",
    1: "总线设备",
    2: "手动盘",
    3: "直控盘",
    4: "网络设备",
    5: "自身设备",
}

# 摘自 GST-QKP02H/04H 安装使用说明书 表 1「可识别/定义类型」，
# 以及监管类设备类型（7.1.3.1.10）。0 号为控制器自身部件（主/备电、总线等）。
DEVICE_TYPES = {
    0: "控制器部件",
    1: "光栅测温",
    2: "点型感温",
    3: "点型感烟",
    4: "报警接口",
    5: "复合火焰",
    6: "光束感烟",
    7: "紫外火焰",
    8: "线型感温",
    9: "吸气感烟",
    10: "复合探测",
    11: "手动按钮",
    13: "讯响器",
    22: "防火阀",
    29: "压力开关",
    32: "空调机组",
    34: "照明配电",
    37: "气体启动",
    47: "喷洒指示",
    55: "急启按钮",
    67: "手动允许",
    68: "自动允许",
    69: "可燃气体",
    76: "声光警报",
    87: "手自动灯",
    89: "漏电报警",
    95: "漏电测温",
}

RESPONSE_FRAME_LENGTH = 13
QUERY_FRAME_LENGTH = 8


class ModbusFrameError(ValueError):
    """帧长度、CRC 或字段取值不合法。"""


def crc16_modbus(data: bytes) -> int:
    """标准 Modbus RTU CRC16（多项式 0xA001）。"""
    crc = 0xFFFF
    for byte in data:
        crc ^= byte
        for _ in range(8):
            if crc & 0x0001:
                crc = (crc >> 1) ^ 0xA001
            else:
                crc >>= 1
    return crc


def _append_crc(payload: bytes) -> bytes:
    # 规约表 3 的字节序为 CRC 高字节在前。
    crc = crc16_modbus(payload)
    return payload + bytes([(crc >> 8) & 0xFF, crc & 0xFF])


def _check_crc(frame: bytes) -> None:
    expected = crc16_modbus(frame[:-2])
    actual = (frame[-2] << 8) | frame[-1]
    if expected != actual:
        raise ModbusFrameError("crc_mismatch")


def encode_point_code(controller_no: int, loop_no: int, point_no: int) -> str:
    """机号/回路/点位 -> 10 位二次码字符串（本厂编码表约定）。"""
    if not (0 <= controller_no <= 99 and 0 <= loop_no <= 99 and 0 <= point_no <= 999):
        raise ModbusFrameError("point_code_out_of_range")
    return f"0{controller_no:02d}{loop_no:02d}{point_no:03d}00"


def decode_point_code(code: str) -> dict:
    """10 位二次码 -> {controller_no, loop_no, point_no}。"""
    if len(code) != 10 or not code.isdigit():
        raise ModbusFrameError("invalid_point_code")
    return {
        "controller_no": int(code[1:3]),
        "loop_no": int(code[3:5]),
        "point_no": int(code[5:8]),
    }


def _bcd_encode(digits: str) -> bytes:
    return bytes(int(digits[i]) << 4 | int(digits[i + 1]) for i in range(0, len(digits), 2))


def _bcd_decode(data: bytes) -> str:
    out = []
    for byte in data:
        high, low = byte >> 4, byte & 0x0F
        if high > 9 or low > 9:
            raise ModbusFrameError("invalid_bcd")
        out.append(f"{high}{low}")
    return "".join(out)


def build_query_frame(slave_addr: int = 0x01, function_code: int = 0x03, start: int = 0x0000) -> bytes:
    """主机（网关）查询命令：读事件池 4 个寄存器。"""
    payload = bytes([slave_addr, function_code, (start >> 8) & 0xFF, start & 0xFF, 0x00, 0x04])
    return _append_crc(payload)


@dataclass
class ControllerEvent:
    """一条解析后的控制器事件。"""

    slave_addr: int
    event_type: str
    data_source: int
    device_type_code: int
    controller_no: int
    loop_no: int
    point_no: int
    point_code: str
    frame_hex: str

    @property
    def event_type_label(self) -> str:
        return EVENT_TYPE_LABELS.get(self.event_type, self.event_type)

    @property
    def device_type_label(self) -> str:
        return DEVICE_TYPES.get(self.device_type_code, f"未知类型{self.device_type_code:02d}")

    @property
    def data_source_label(self) -> str:
        return DATA_SOURCES.get(self.data_source, "未定义")

    def to_payload(self) -> dict:
        return {
            "protocol": "modbus-rtu/gst-event-pool",
            "frame_hex": self.frame_hex,
            "slave_addr": self.slave_addr,
            "event_type": self.event_type,
            "event_type_label": self.event_type_label,
            "data_source": self.data_source_label,
            "device_type_code": self.device_type_code,
            "device_type_label": self.device_type_label,
            "controller_no": self.controller_no,
            "loop_no": self.loop_no,
            "point_no": self.point_no,
            "point_code": self.point_code,
        }


def build_event_frame(
    event_type: str,
    controller_no: int,
    loop_no: int,
    point_no: int,
    device_type_code: int = 3,
    data_source: int = 1,
    slave_addr: int = 0x01,
    function_code: int = 0x03,
) -> bytes:
    """按规约表 3 构造 13 字节事件应答帧（仿真器使用）。"""
    type_codes = {name: code for code, name in EVENT_TYPES.items()}
    if event_type not in type_codes:
        raise ModbusFrameError("unknown_event_type")
    if data_source not in DATA_SOURCES:
        raise ModbusFrameError("unknown_data_source")
    point_code = encode_point_code(controller_no, loop_no, point_no)
    payload = bytes([
        slave_addr, function_code, 0x08,
        type_codes[event_type], data_source, device_type_code,
    ]) + _bcd_encode(point_code)
    return _append_crc(payload)


def parse_event_frame(frame: bytes) -> Optional[ControllerEvent]:
    """解析 13 字节事件应答帧；事件类型 00（无事件更新）返回 None。"""
    if len(frame) != RESPONSE_FRAME_LENGTH:
        raise ModbusFrameError("invalid_frame_length")
    if frame[1] not in (0x03, 0x04):
        raise ModbusFrameError("unsupported_function_code")
    if frame[2] != 0x08:
        raise ModbusFrameError("invalid_byte_count")
    _check_crc(frame)
    if frame[3] == 0x00:
        return None
    event_type = EVENT_TYPES.get(frame[3])
    if event_type is None:
        raise ModbusFrameError("unknown_event_type")
    point_code = _bcd_decode(frame[6:11])
    point = decode_point_code(point_code)
    return ControllerEvent(
        slave_addr=frame[0],
        event_type=event_type,
        data_source=frame[4],
        device_type_code=frame[5],
        controller_no=point["controller_no"],
        loop_no=point["loop_no"],
        point_no=point["point_no"],
        point_code=point_code,
        frame_hex=frame.hex(),
    )


def parse_event_frame_hex(frame_hex: str) -> Optional[ControllerEvent]:
    try:
        frame = bytes.fromhex(frame_hex.replace(" ", ""))
    except ValueError as error:
        raise ModbusFrameError("invalid_hex") from error
    return parse_event_frame(frame)

#!/usr/bin/env python3
"""海湾火警主机 Modbus RTU 事件仿真器。

按《海湾/高能 MODBUS 通讯规约》构造 13 字节事件应答帧（含 CRC16），
模拟 ARK 工业网关轮询主机事件池后的上报动作，把帧投递到后端
`POST /gateway/modbus/frames`。仅用于演示，不连接任何真实设备。

用法（后端需运行在 8000 端口）：
    python3 scripts/modbus_simulator.py --list                 # 查看预置事件
    python3 scripts/modbus_simulator.py A                      # 注入场景 A 的报警帧
    python3 scripts/modbus_simulator.py B B2 C                 # 连续注入多帧
    python3 scripts/modbus_simulator.py --frame 0103080101...  # 注入自定义帧
"""

import argparse
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))

from fireguard_backend import modbus  # noqa: E402

DEFAULT_BASE_URL = "http://127.0.0.1:8000"

# 预置事件与 demo-data/device_points.csv 中的点位编码表对应。
PRESETS = {
    "A": {
        "note": "场景A：涂装车间 机1回路1点位3 PT1层消防通道烟感3 火警",
        "kwargs": dict(event_type="fire_alarm", controller_no=1, loop_no=1, point_no=3,
                       device_type_code=3, data_source=1),
    },
    "B": {
        "note": "场景B：电池车间 机2回路1点位5 PACK线烟感5 火警",
        "kwargs": dict(event_type="fire_alarm", controller_no=2, loop_no=1, point_no=5,
                       device_type_code=3, data_source=1),
    },
    "B2": {
        "note": "场景B：电池车间 机2回路1点位9 南门手报 动作（火警）",
        "kwargs": dict(event_type="fire_alarm", controller_no=2, loop_no=1, point_no=9,
                       device_type_code=11, data_source=1),
    },
    "C": {
        "note": "场景C：机2火警主机 备电故障（自身设备）",
        "kwargs": dict(event_type="fault", controller_no=2, loop_no=0, point_no=0,
                       device_type_code=0, data_source=5),
    },
    "RESTORE": {
        "note": "机2主机 故障恢复",
        "kwargs": dict(event_type="restore", controller_no=2, loop_no=0, point_no=0,
                       device_type_code=0, data_source=5),
    },
    "GAS-START": {
        "note": "调漆间气体灭火 机1回路2点位4 启动（延时阶段）",
        "kwargs": dict(event_type="start", controller_no=1, loop_no=2, point_no=4,
                       device_type_code=37, data_source=1),
    },
    "GAS-FEEDBACK": {
        "note": "调漆间钢瓶压力开关 机1回路2点位5 反馈（气体已喷洒）",
        "kwargs": dict(event_type="feedback", controller_no=1, loop_no=2, point_no=5,
                       device_type_code=29, data_source=1),
    },
}


def post_frame(base_url: str, frame_hex: str, gateway_id: str = "ark-gw-01") -> dict:
    body = json.dumps({"frame_hex": frame_hex, "gateway_id": gateway_id}).encode("utf-8")
    request = urllib.request.Request(
        f"{base_url.rstrip('/')}/gateway/modbus/frames",
        data=body, headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=10) as response:
        return json.loads(response.read().decode("utf-8"))


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("presets", nargs="*", help=f"预置事件键：{', '.join(PRESETS)}")
    parser.add_argument("--frame", action="append", default=[], help="自定义帧（hex，可多次）")
    parser.add_argument("--base-url", default=DEFAULT_BASE_URL)
    parser.add_argument("--dry-run", action="store_true", help="只打印帧，不上报")
    parser.add_argument("--list", action="store_true", help="列出预置事件")
    args = parser.parse_args()

    if args.list or (not args.presets and not args.frame):
        print("预置事件：")
        for key, preset in PRESETS.items():
            frame = modbus.build_event_frame(**preset["kwargs"])
            print(f"  {key:<12} {frame.hex()}  {preset['note']}")
        return 0

    frames = []
    for key in args.presets:
        preset = PRESETS.get(key.upper())
        if preset is None:
            print(f"未知预置事件：{key}（可用：{', '.join(PRESETS)}）", file=sys.stderr)
            return 2
        frames.append((preset["note"], modbus.build_event_frame(**preset["kwargs"]).hex()))
    frames.extend(("自定义帧", frame) for frame in args.frame)

    for note, frame_hex in frames:
        decoded = modbus.parse_event_frame_hex(frame_hex)
        print(f"-> {note}")
        print(f"   帧: {frame_hex}")
        print(f"   解码: {decoded.event_type_label} | {decoded.data_source_label} | "
              f"{decoded.device_type_label} | 机{decoded.controller_no}回路{decoded.loop_no}点位{decoded.point_no}")
        if args.dry_run:
            continue
        result = post_frame(args.base_url, frame_hex)
        event = result.get("event") or {}
        print(f"   上报成功: event_id={event.get('id')} enterprise={event.get('enterprise_id')} "
              f"severity={event.get('severity')}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

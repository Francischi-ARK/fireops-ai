import json
import ssl
from pathlib import Path
from urllib.request import Request, urlopen

base_url = "https://qwen-qwen3-tts-demo.hf.space"
ssl_context = ssl.create_default_context(cafile="/etc/ssl/cert.pem")
text = """工厂里，一条火警信号并不难收到。难的是后面：它来自哪个点位，谁去核实，依据在哪里，处理完有没有人复查。很多现场仍靠主机、表格、群消息和纸质手册来回对照，报警收到了，责任却容易断在交接里。
FireOps 把这些动作放进同一个事件。信号进来后，系统先定位控制器、回路和点位，再把相邻探测器、设备状态和视频证据放到值班员面前。AI 负责查资料、补上下文、整理建议；是否确认火情，仍由人决定。
确认后，事件编号、证据和班组一起进入工单。现场人员按签收、出动、到场、首报推进，不能跳步。故障和维保走维修链，巡查图片和口述先形成隐患草稿，再由责任人整改、巡查员复查。
AI 在这里不是聊天入口。它连接点位台账、手册、维保记录和历史事件，交付可引用的结论、工具轨迹和岗位简报。证据不足时，它会停下来说明缺什么，不会自动建单。
最后留下的不是一条漂亮的回答，而是一条能追到事件、工单、隐患、责任人和时间戳的证据链。FireOps 让 AI 进入消防现场，但不越过现场的人。"""
target = Path(__file__).parents[1] / "public" / "audio" / "narration-full.wav"

request = Request(
    f"{base_url}/gradio_api/call/tts_interface",
    data=json.dumps({"data": [text, "Serena / 苏瑶", "Chinese / 中文"]}).encode(),
    headers={"Content-Type": "application/json"},
    method="POST",
)
event_id = json.loads(urlopen(request, timeout=30, context=ssl_context).read())["event_id"]
events = urlopen(f"{base_url}/gradio_api/call/tts_interface/{event_id}", timeout=300, context=ssl_context).read().decode()
result = next(
    value
    for value in reversed([json.loads(line[6:]) for line in events.splitlines() if line.startswith("data: ")])
    if value
)
audio_url = result[0]["url"]
target.write_bytes(urlopen(audio_url, timeout=60, context=ssl_context).read())
print(target)

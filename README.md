# FireOps AI

> 工厂消防设备运维 Agent · GOAI 无界应用赛道（AI+工业制造）参赛作品
> 全部数据为合成演示数据：不控制真实设备、不自动启动灭火装置、AI 只起草不执行；对外报警（119）由人工执行。

面向新能源汽车制造工厂：把火警主机 Modbus 报警帧、点位编码表、维保记录与说明书检索串成一条可审计的运维闭环——Agent 完成任务理解、证据补全、故障诊断与工单草稿；核实与派发由消控室 / 值班负责人确认。

## 三个亮点

1. **Modbus → 证据 → 动作**：解析海湾消防控制器 Modbus RTU 事件帧，映射到点位档案与车间危险源；无依据时明确回答「未知」，虚构证据编号会被服务端拦截。
2. **Permission-gated Agent**：模型只能起草和推荐；工具白名单、参数 schema、状态机、人工审批四层拦截越权动作（含工单派发）。
3. **一次事件 · 三端交付**：同一事件编号自动生成消控室值班简报、处置班组任务卡、网格责任人待办，写入同一时间线；可导出 JSON 审计包。

产品采用响应式 Web：桌面端用于态势监测、核实与派单，手机端提供固定导航与现场人工确认。

| 桌面 Copilot | 手机现场确认 |
| --- | --- |
| ![桌面端 Copilot 工作台](docs/images/copilot-desktop.png) | ![手机端人工确认链](copilot-mobile-390x844.png) |

## 快速开始

```bash
cd backend
docker compose up -d --wait postgres   # 容器 fireops-postgres，端口 54330
uv sync
DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard \
  uv run uvicorn fireguard_backend.app:app --host 127.0.0.1 --port 8000

# 另一个终端（项目根目录）
python3 -m http.server 4173
# 打开 http://127.0.0.1:4173/#/copilot
```

五个演示场景（误报 / 确认火警派单 / 主机故障诊断 / 数据不足拒答 / 气体灭火延时咨询）在 Scenario 模式下离线可复现。Live 模式设置 `COPILOT_MODEL_API_KEY` 后走真实模型，失败自动回退模板。

可选：用 `scripts/modbus_simulator.py` 向 `POST /gateway/modbus/frames` 注入合成报警帧。
主演示串联：`#/monitoring` 模拟火警 → 自动进 `#/incidents` 核实派单 → `#/station` 统一收件箱签收；故障帧进维保组维修草稿；巡查/维保工单同一中枢。
Copilot 可「中枢信号」绑定已有事件，不再旁路新建。

详细运行指南见 [run-guide](docs/submission/run-guide.md)。

## 验证

- 后端 unittest（含 Modbus CRC、网关解析、工具守门、五场景模板、证据链集成）：见 `backend/tests/`
- 前端冒烟：`scripts/smoke_test.cjs`；五场景 E2E + 390px 手机确认链：`scripts/copilot_e2e.cjs`
- 评测报告：[eval-report](docs/submission/eval-report.md)

## 文档

- **[开发交接 HANDOFF](docs/HANDOFF.md)**（fable5 规划、中枢三链、已完成项、建议后续工作包 — 交给其他 Agent 续作请从这个读）
- [产品需求 PRD](docs/FireGuard_AI_PRD.md)（历史稿，定位以本 README 为准）
- [技术架构说明](docs/submission/architecture.md)
- [数据来源与合规说明](docs/submission/data-compliance.md)
- [演示场景夹具](demo-data/copilot_scenarios.json) · [Demo 脚本](docs/demo-script.md)

## 许可证

以 [MIT](LICENSE) 发布。合成数据与合成图片为本项目自制。

# FireGuard Copilot

> 工业园区消防风险与警情协同 Agent · GOAI 无界应用赛道（AI+工业制造）参赛作品
> 全部数据为合成演示数据：未连接 119、不控制真实设备、AI 不替代现场指挥。

把一起设备火警信号从“人工拼凑信息、电话反复核实”变成“证据齐全的处置建议”：
Agent 完成任务理解、缺项追问、证据检索与步骤规划，核实、调派等高风险动作全部由授权人员确认。

## 三个亮点

1. **Evidence-to-Action**：每条建议可回溯到具体设备、维保或预案记录，无依据时明确回答“未知”；模型虚构的证据编号会被服务端拦截。
2. **Permission-gated Agent**：模型只能起草和推荐；工具白名单、参数 schema、状态机、人工审批四层拦截越权动作。
3. **一次事件 · 三端交付**：同一事件编号自动生成指挥台简报、救援站首战信息、企业整改待办，写入同一时间线。

产品采用响应式 Web：桌面端用于监测、研判和调派，手机端提供固定导航与现场人工确认；每次运行可下载 JSON 格式的可审计事件包。

| 桌面指挥台 | 手机现场确认 |
| --- | --- |
| ![桌面端 Copilot 工作台](preview.png) | ![手机端人工确认链](copilot-mobile-390x844.png) |

## 快速开始

```bash
cd backend
docker compose up -d --wait postgres
uv sync
DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54329/fireguard \
  uv run uvicorn fireguard_backend.app:app --host 127.0.0.1 --port 8000

# 另一个终端
python3 -m http.server 4173   # 项目根目录
# 打开 http://127.0.0.1:4173/#/copilot
```

Scenario 模式离线可复现三个演示场景；Live 模式设置 `COPILOT_MODEL_API_KEY` 后走真实模型（默认魔搭 Qwen，OpenAI 兼容可替换），失败自动回退模板。

详细运行指南、验证命令与注意事项见 [run-guide](docs/submission/run-guide.md)。

## 验证

- 后端 44 个测试：`unittest discover`（含工具守门、双模式回退、证据链集成、运行持久化）
- 前端冒烟：`smoke_test.cjs`；三场景 E2E + 390px 手机确认链：`copilot_e2e.cjs`
- 评测报告：[eval-report](docs/submission/eval-report.md)

## 文档

- [产品需求 PRD](docs/FireGuard_AI_PRD.md)
- [技术架构说明](docs/submission/architecture.md)
- [数据来源与合规说明](docs/submission/data-compliance.md)
- [演示场景夹具](demo-data/copilot_scenarios.json) · [90 秒 Demo 脚本](docs/demo-script.md)

## 报名材料

- [500 字作品简介](docs/submission/project-intro-500.md)
- [路演 PPT（PPTX 可编辑）](docs/submission/FireGuard-Copilot-GOAI.pptx) · [同版 PDF](docs/submission/FireGuard-Copilot-GOAI.pdf)
- [43 秒演示视频](fireguard-copilot-demo.mp4)

## 许可证

以 [MIT](LICENSE) 发布。合成数据与合成图片为本项目自制。

# FireOps AI 开发交接

> 仓库：`/Users/francischi/Documents/Vibe coding/fireops-ai`
> 分支：`codex/fireops-completion`
> 产品：`FireOps AI｜工厂消防设备运维 Agent`
> 赛道：GOAI「无界应用」AI+工业制造
> 更新：2026-08-11

## 接手后的第一件事

先读这 5 个文件：

1. `README.md`：产品、启动、测试和材料入口。
2. `docs/product-walkthrough.md`：页面功能、AI 作用和三条闭环。
3. `docs/FireOps-AI-completion-spec.md`：完整验收目标。
4. `.codex/dev-loop/development-plan.md`：8 个实施单元与测试门。
5. `docs/submission/goai-checklist.md`：赛事提交与评审映射。

比赛材料以 `docs/submission/` 内的 FireOps AI 文件为准；根目录旧视频或旧 FireGuard 材料不属于本次提交物。

## 一句话架构

火警主机 Modbus 帧、设备故障、维保逾期和巡查隐患进入同一个事件与工单中枢；Agent 读取证据并起草，人负责所有高风险状态迁移。

```mermaid
flowchart LR
  A["Modbus / 维保 / 图片语音"] --> B["事件与工单中枢"]
  B --> C["Agent：理解、检索、诊断、草稿"]
  C --> D["人工确认闸"]
  D --> E["消控室 / 班组 / 网格责任人"]
  E --> F["完工、首报、复查与审计证据"]
```

## 当前完成状态

| 单元 | 内容 | 状态 |
| --- | --- | --- |
| dev-001 | 工单/复查状态机，巡查视觉 provider 与安全拒答 | 完成，测试通过 |
| dev-002 | Copilot 工具白名单、证据校验、Scenario/Live 回退 | 完成，测试通过 |
| dev-003 | 单元档案后端聚合与下一步编号 | 完成，测试通过 |
| dev-004 | 一键运行、双库 reset、只读备份校验 | 完成，测试通过 |
| dev-005 | 全按钮、跨页上下文、移动端、3D/2D 降级 | 完成，6 组 E2E 通过 |
| dev-006 | Logo、当前文档、截图与 GOAI 清单 | 完成，材料检查通过 |
| dev-007 | 12 页 16:9 PPTX 与同版 PDF | 完成，结构与逐页渲染通过 |
| dev-008 | 85–95 秒 1080p 中文配音视频 | 完成，90.05 秒音画校验通过 |

dev-005 最新整套结果：

```text
action contract: ok
FireOps workbench smoke test: ok
copilot e2e ok
crosspage flow e2e ok
mobile e2e: ok
monitoring 3d e2e: ok
e2e contracts: ok
```

开发流程的范围审计会把最终 MP4、PPTX/PDF、AAC 和 15 张 1080p 镜头计入源码行数，并在超过固定的 25 文件阈值后报警。当前变更全部位于 8 个单元声明范围内，无越界文件；原因与处理记录在 `.codex/dev-loop/blocker-resolutions.md`。

## 最终提交物

| 文件 | 说明 |
| --- | --- |
| `docs/submission/FireOps-AI-GOAI.pptx` | 12 页、16:9、可编辑 PowerPoint，含逐页讲稿 |
| `docs/submission/FireOps-AI-GOAI.pdf` | 与 PPT 同版的 12 页 PDF，已逐页检查中文与裁切 |
| `docs/submission/FireOps-AI-GOAI-demo-v3.mp4` | 90.05 秒、1920×1080、30fps、H.264/AAC 中文配音 Demo |
| `docs/submission/video/timeline.json` | 旁白、字幕、截图和时码的单一数据源 |
| `docs/submission/video/transcript.json` | 与时间轴逐段一致的中文旁白文本 |

## 运行拓扑

| 服务 | 地址 / 端口 | 说明 |
| --- | --- | --- |
| 前端 | `http://127.0.0.1:4173` | 静态 HTML/CSS/JS，无构建步骤 |
| API | `http://127.0.0.1:8000` | FastAPI |
| 演示数据库 | PostgreSQL `54330/fireguard` | 页面与 Demo 使用 |
| 测试数据库 | PostgreSQL `54330/fireguard_test` | unittest 专用 |

启动：

```bash
./start-demo.command
```

官方演示库重置：

```bash
FIREGUARD_DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard \
  PYTHONPATH=backend backend/.venv/bin/python backend/tests/reset_demo_database.py
```

禁止用手写 `TRUNCATE` 代替 reset，也不要把测试 DSN 指向演示库。

## 页面与角色

| 路由 | 角色 | 关键动作 |
| --- | --- | --- |
| `#/home` | 所有人 | 选择 6 个岗位工作台，查看主演示顺序 |
| `#/monitoring` | 消控室 / EHS | 工厂 3D 总览、车间二维平面、状态/楼层筛选、四类证据页签、模拟火警/故障和二维降级 |
| `#/incidents` | 消控室值班员 | 核实或排除信号、建立事件、人工派单 |
| `#/workflow` | 值班员 / 班组 / EHS | 监管事件步骤、当前责任与下一动作，执行跨角色交接 |
| `#/station` | 处置班组 / 维保组 | 签收、出动、到场、首报；工单开工与完工 |
| `#/owner` | 网格责任人 | “整改待办”：接收、开始并完成巡查整改；空状态引导返回防火巡查 |
| `#/inspections` | 防火巡查员 | 图片/语音辅助识别、派发、维保扫描、复查关闭 |
| `#/enterprises/:id` | EHS | 点位、事件、维保、隐患、工单与证据聚合 |
| `#/copilot` | 消控室 / EHS | 五场景、中枢事件绑定、五段式运行记录、回退与原始 JSON 下载 |

URL 使用 `enterprise_id`、`event_id`、`workorder_id`、`finding_id` 保存跨页上下文。新增跳转时应复用 `routeHash()`，不要写丢编号的裸 hash。

## 三条验收链

### 火警

公开评审：`工厂总览 → 电池车间 → 待核实火警 → Copilot 核实处置演示`。

本地完整服务：`模拟火警帧 → 报警核实台人工确认 → 派单 → 签收 → 出动 → 到场 → 现场反馈 → 人工归档`。模拟按钮只创建事件，不直接代表人工确认。

`#/analysis/:id` 页面名称为“消防健康报告”。无结构化评估数据时只显示空状态，评委可选择固定演示数据查看规则、扣分和结论的对应关系。

### 故障 / 维保

`故障或逾期 → 证据检索 → 草稿 → 人工派发 → 开工 → 完工`

### 巡查

`图片/口述 → 隐患草稿 → 人工派发 → 网格整改 → 完成工单 → 复查关闭`

状态约束：工单只能 `draft → approved → in_progress → done`；未开工不能完成；隐患只有在关联工单 `done` 后才能复查关闭。
完成后的维修/维保工单仍保留在维保班组历史中，便于查看刚完成的结果，不会在 `done` 后从页面消失。

## AI 的权限边界

- 可以：意图理解、任务规划、只读查询、说明书检索、诊断、缺项提示、草稿和岗位简报。
- 不可以：直接确认火警、直接派单、直接开始或完成工单、直接关闭隐患、控制设备、启动灭火或拨打 119。
- 未配置 Live 密钥时返回 `model_not_configured` 并回退；模型计划整体结构不合格时整次运行回退；未知工具、非法参数和虚构证据编号则由守门逻辑拒绝，不执行对应动作。
- 巡查识别返回 provider、model、confidence、fallback reason 与 simulation 标记。

## 五个 Copilot 场景

夹具：`demo-data/copilot_scenarios.json`

| ID | 目标 |
| --- | --- |
| A | 涂装作业相邻误报，人工登记后不建事件 |
| B | 电池车间确认火警，生成处置草稿和三岗位简报 |
| C | 主机备电故障，检索手册并生成维修草稿 |
| D | 数据不足，列出缺项并拒答 |
| E | 气体灭火延时咨询，只给手册依据，不产生控制动作 |

## 3D 实现

- `monitoring-3d.js` 使用本地 Three.js 与 6 个 Blender 生成的 GLB：factory、office、warehouse、mall、tower、tanks。
- 当前布局 20 栋建筑、5 个企业风险点位；风险柱已收细并带光晕、扩散环和粒子。
- DOM 暴露 `data-3d-state`、建筑类型/数量和点位数量，便于验证。
- 3.5 秒未 ready 或 WebGL 初始化失败时，显示 `.twin-fallback` 和二维单元档案链接，不再无限加载。
- 资产生成脚本：`assets/buildings/generate_buildings.py`。除非需要修改建筑资产，不必依赖 Blender 运行 Demo。

## 测试入口

```bash
node scripts/engine.test.cjs
bash scripts/runtime_contract.test.sh
bash scripts/e2e_contract.test.sh

cd backend
FIREGUARD_TEST_DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard_test \
  PYTHONPATH=. .venv/bin/python -m unittest discover -s tests
```

`e2e_contract.test.sh` 会在每个浏览器脚本前执行官方 reset。不要在测试脚本里吞掉数据库错误或自行清库。

## 关键文件

```text
app.js                              前端路由、状态与全部业务交互
monitoring-3d.js                    Three.js 厂区与风险点位
styles.css                          响应式和工业控制台视觉
backend/fireguard_backend/app.py    API 路由与请求合同
backend/fireguard_backend/repository.py  PostgreSQL、状态机与聚合查询
backend/fireguard_backend/copilot.py     Scenario/Live Agent 引擎
backend/fireguard_backend/copilot_tools.py  工具白名单与证据守门
backend/fireguard_backend/inspection.py  巡查识别与回退元数据
demo-data/                          合成数据、知识库与五场景
scripts/e2e_contract.test.sh        浏览器总合同
docs/submission/                    报名与复赛材料
.codex/dev-loop/                    计划、证据与评审记录
```

## 交付前只需做的事

1. 运行本文测试入口和 `python scripts/validate_submission_artifacts.py --deck/--video`。
2. 官网已于 2026-08-11 复核；登录报名系统后仍需确认单文件大小、命名与上传口径。
3. 重置演示库后，从 `#/monitoring` 按视频同序演示；不要接真实设备或真实个人数据。

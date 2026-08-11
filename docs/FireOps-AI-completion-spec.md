# FireOps AI 赛事交付规格

## Goal

把现有 Fable5 FireOps 原型完成为 GOAI「无界应用」AI+工业制造方向的企业级可运行作品：以消防主机 Modbus 事件为入口，让报警、设备故障、预防性维保和防火巡查进入同一工单中枢；AI 负责理解任务、补齐上下文、检索证据、诊断与起草，所有高风险状态迁移由人确认；桌面与手机端均可从异常发现走到责任闭环，并提供可复现代码、评测、PPT/PDF、操作说明和带配音的 90 秒演示视频。

## Product boundary

- 面向新能源汽车工厂消控室值班员、设施维保组、网格责任人和 EHS 经理。
- 本次参赛不包含政府监管、119 指挥调派或消防救援机构产品线。
- 全部演示数据为合成数据；不控制真实设备，不自动启动灭火装置，不自动拨打 119。
- AI 只读取、分析、检索、推荐和起草；核实、派发、完工核验和复查闭环必须由人触发。
- 默认 Scenario 模式离线可复现；Live 模式通过环境变量接 OpenAI 兼容模型，失败时回退并显式说明原因。

## Core workflows

### A. 报警与设备故障

Modbus 帧 → CRC/点位解析 → 同一事件进入值班台 → 人工核实或 Copilot 诊断 → 人工派发 → 班组签收/处理/反馈 → 审计记录。

### B. 预防性维保

维保记录 → 逾期扫描 → AI/规则说明逾期原因与证据 → 工单草稿 → 人工派发 → 开工 → 完成核验。

### C. 防火巡查

现场照片与口述 → 识别草稿或安全拒答 → 人工派发网格责任人 → 开始整改 → 完成待复查 → 巡查员复查 → 隐患关闭。

### D. 单元档案

档案不是静态介绍页，而是单元上下文中枢：设备点位、最近事件、维保、隐患、工单、风险边界和下一步动作必须可追踪，并能跳转到对应流程且保留同一企业/事件上下文。

### E. Copilot

Copilot 可从独立场景或现有中枢事件进入。界面必须显示任务理解、工具调用、证据引用、缺失信息、人工审批点、回退原因和结果交付。不得通过重新创建无关事件模拟“绑定”。

## AI responsibility

- 将自然语言、设备事件和业务上下文归类为核实、响应支持、故障诊断或安全咨询。
- 通过白名单工具读取信号、点位、档案、维保和知识库，不允许模型直接改业务状态。
- 所有结论引用真实工具返回的 evidence ref；未知或无证据时停下。
- 生成核实草稿、维修/处置草稿、角色简报和下一步建议。
- Live API 不可用、超时或输出非法时，自动回退 Scenario/确定性计划并显示原因。
- 巡查视觉能力采用可替换 provider：有 API 时调用真实视觉模型，无 API 时使用明确标注的本地演示识别与安全拒答。

## UX and brand direction

- 参考 VoltAgent 的 Agent 可观测性：工具轨迹、证据、状态和输入输出在同一视图内可读。
- 使用 FireOps 自有工业控制台语言：石墨黑/钢灰底，安全红用于高风险人工动作，绿色仅用于在线与成功状态，琥珀用于待确认。
- 创建独立可缩放 SVG Logo，表达“火焰/信号/闭环/盾牌”，不复用原 FireGuard 通用盾牌。
- 每页显示当前角色、当前任务、来源、状态、下一步；禁止大面积无说明空白。
- 所有可见按钮必须真实工作，或明确禁用并说明前置条件；跨页动作保留企业、事件或工单上下文。
- 桌面 1440×1024 与手机 390×844 无横向溢出；手机端优先显示个人待办和主动作。
- 正文不低于 12px，关键操作和手机触点不低于 44px；保留键盘焦点和 reduced-motion。

## Deliverables

- 可运行前后端、合成数据库、Scenario/Live 双模式和一键启动脚本。
- 独立政府版备份与独立 FireOps Git 仓库。
- README、企业版 PRD、架构、数据合规、评测报告、运行指南、完整按钮/流程说明。
- FireOps 赛事 PPTX 与 PDF：问题、用户、源头数据、Agent 工作流、三条闭环、AI 价值、技术、安全、评测、复用与路线图。
- 90 秒 16:9 Demo：按真实按钮顺序录制，从 Modbus 源头到最终闭环；字幕、画面高亮和中文配音同步，语气参考漫游簿的平静路线讲解。
- 可提交的项目简介、演示脚本、截图和视频文件。

## Acceptance Criteria

1. 政府版仓库保持未修改，并存在可校验的完整 Git bundle 备份。
2. 全新环境按运行指南启动后，健康检查通过；测试和演示使用隔离数据库，重复执行不会被上次状态污染。
3. 报警/故障、维保、巡查三条链均有浏览器级自动化，从入口走到终态；事件、工单、责任人和证据编号在跨页后保持一致。
4. 单元档案读取后端真实聚合数据，并能进入核实、Copilot、班组或巡查流程；不再依赖静态摘要冒充台账。
5. Copilot 对中枢事件运行时不创建第二条无关事件；工具调用、证据、人工审批和回退原因可见且可导出。
6. Scenario 五场景全部通过；Live 模式至少有契约测试、非法输出/超时回退测试和一组自由文本评测，不把确定性模板宣传成真实模型能力。
7. 巡查识别清楚标识当前 provider；无 API 时可完成本地演示并安全拒答，有 API 时接口可替换且不改业务状态机。
8. 逐页按钮审计通过：没有无响应的主按钮、错误页面跳转、上下文丢失、原始英文业务状态或无解释空白。
9. 后端全量测试、领域引擎、全路由 smoke、五场景 E2E、三条跨页闭环和移动端检查全部通过。
10. 新 Logo、页面、README、PPT/PDF、视频、项目简介中的名称、数字、场景、角色和安全边界一致，不含政府端叙事。
11. PPT/PDF 每页无溢出、错字和旧截图；视频为 90 秒左右 1080p，配音、字幕、按钮点击和流程解锁同步。
12. 最终再次对照 GOAI 无界应用规则，明确目标用户、痛点、交互、技术、模型、工具、知识库、数据来源、部署、合规和迭代计划，缺项为零。

## Canonical domain contract

### Actors and authority

| Actor | May perform | Must not perform |
| --- | --- | --- |
| 消控室值班员 / EHS | 核实或排除信号、确认 Copilot 草稿、选择并派发班组、查看全局审计 | 让模型代替自己确认火警、自动拨打 119 或远程控制灭火装置 |
| 微型消防站 / 维保班组 | 签收、出发、到场、提交首次反馈；审批维修/维保草稿、开工、完成核验 | 跳过签收或开工状态，替代巡查员关闭隐患 |
| 网格责任人 | 接收整改单、开始整改、提交整改完成 | 自行复查并关闭隐患 |
| 巡查员 | 上传现场证据与口述、人工修订识别草稿、派发整改、复查通过或退回 | 让视觉模型直接派单或关闭隐患 |
| Copilot | 保存运行结果、工具轨迹、证据引用、缺失字段、建议与草稿 | 调用核实、派发、开工、完成、复查、119 或设备控制接口 |

AI 的持久化边界仅为 `copilot_runs`、可导出的轨迹/证据和未生效草稿；任何业务状态迁移均来自页面上的人工按钮及其对应 API，并记录操作者语义。

### State machines

| Workflow | Legal path | Human confirmation | Terminal state |
| --- | --- | --- | --- |
| 火警信号 | `pending → dismissed`，或 `pending → confirmed → incident/pending_dispatch → issued → acknowledged → enroute → arrived → first_report` | 核实、派发、签收、出发、到场、首次反馈均为人工动作 | `dismissed` 或已提交 `first_report` |
| 故障/维保工单 | `draft → approved → in_progress → done` | 审批、开工、完成核验均为人工动作，不允许 `approved → done` 跳步 | `done` |
| 巡查整改 | `draft → assigned`，关联工单 `approved → in_progress → done`；随后复查 `failed → assigned` 或 `passed → closed` | 派发、开工、整改完成、复查均为人工动作 | finding 为 `closed`；复查失败不是终态 |
| 气体灭火咨询 | `event → advisory` | 只读咨询；所有现场确认与紧急停动均由人执行 | `advisory`，不得产生控制或派单动作 |
| 安全拒答 | `input → abstained` | 由人工补齐信息后新建一次运行 | `abstained`，不得生成工单或事件 |

重复提交相同的已完成动作应返回当前状态而不创建重复记录；非法跳步返回 `409` 和稳定错误码。跨页必须携带 `enterprise_id`，并在存在时携带 `event_id`、`incident_id`、`workorder_id` 或 `finding_id`。

## Five canonical scenarios

`demo-data/copilot_scenarios.json` 是场景真源，以下结果为不可弱化的验收合同。

| ID | Fixture / intent | Required evidence | Missing fields | Required result |
| --- | --- | --- | --- | --- |
| A | `ent-005`；帧 `01030801010300101003001d41`；`signal_verification` | `monitoring_events/…`、`maint-001`、`demo/maint/001` | 现场复核人、探测器点位复位状态 | 仅生成核实草稿；人工可登记 `dismissed`；不建 incident/workorder |
| B | `ent-001`；帧 `0103080101030020100500bd4d` + 手报关联帧；`incident_response_support` | `monitoring_events/…`、`ent-001`、`crew-wx-01` | 未撤出人员最后位置 | 核实前仅草稿；人工确认后复用同一 event 建 incident，推荐 `crew-wx-01`/`crew-wb-01`，生成三角色简报和待人工派发工单 |
| C | `ent-001`；帧 `0103080205000020000000ce4a`；`fault_diagnosis` | `monitoring_events/…`、`kb-002`、`maint-003`、`maint-004` | 电池连接器与接线检查结果 | 说明书与维保史共同支撑诊断；仅生成派给 `crew-wb-01` 的维修草稿 |
| D | `ent-004`；网关离线且电话信息模糊；`signal_verification` | `ent-004` | 具体位置、烟雾或火光、人员、工艺、已采取措施 | `abstained=true`；不建 incident/workorder，不伪造点位 |
| E | `ent-005`；帧 `0103080301250010200400fdc5`；`gas_release_advisory` | `monitoring_events/…`、`kb-008`、`kb-006` | 人员撤离确认、紧急停动按钮状态 | 只输出有依据的延时/停动咨询；无审批、无工单、无控制调用 |

## AI and vision provider contract

- `POST /copilot/runs` 输入固定为 `enterprise_id`、可选 `event_id`/`incident_id`、`reporter_text`（最多 2000 字）、`image_assets[]`、可选 `scenario_id` 和 `mode=scenario|live`。
- 意图枚举固定为 `signal_verification`、`incident_response_support`、`fault_diagnosis`、`gas_release_advisory`、`unknown`。
- 工具白名单固定为 `get_signal_context`、`get_site_packet`、`get_maintenance_context`、`find_missing_fields`、`create_verification_draft`、`search_manual`、`recommend_crew`、`create_workorder_draft`、`build_role_brief`；`append_incident_activity` 只接受已经记录的人工作用域授权。未知工具、非法参数和状态不允许执行。
- 每条证据为 `{ref, kind, note}`；`ref` 必须由真实工具返回，格式为数据库/合成数据原生编号（如 `monitoring_events/42`、`pt-02-01-005`、`kb-002`、`maint-003`、`ent-001`、`crew-wx-01`）。模型自报但工具未返回的编号进入 `rejected_evidence`，不得显示为有效依据。
- 运行结果固定包含 `mode`、`model_name`、`status`、`plan`、`trace`、`rejected_evidence`、`fallback_reason`、`is_simulation=true`、`external_system=none`，并可导出 `fireops-audit-pack/v1` JSON。
- Live 模型总超时 25 秒。未配置密钥、网络/HTTP 失败、超时、非 JSON、schema 非法或工具越权分别显示稳定的回退原因；有匹配场景时回退确定性计划，无匹配场景时安全拒答。回退不应伪装成模型成功。
- 自由文本 Live 契约测试至少覆盖：正确 JSON、非法 JSON、超时、未知工具、虚构证据和无场景输入。外部 API 成功不作为无密钥环境的必过条件。
- 巡查视觉输入接受项目内演示资源，Live provider 预留 `png/jpeg/webp` 且单文件不超过 5 MB。界面必须标识 `本地演示识别` 或真实 provider/model；缺图、格式不支持、低置信度或 provider 失败时保留人工录入并安全拒答，不创建工单、不改变状态机。

## Runtime and reset contract

- 支持 macOS / Linux、Python 3.12、Node.js 18+、Docker、Chrome/Playwright。
- PostgreSQL 16 监听 `127.0.0.1:54330`；演示库为 `fireguard`，自动化库为独立的 `fireguard_test`，测试命令不得指向演示库。
- 后端监听 `127.0.0.1:8000`，前端监听 `127.0.0.1:4173`；`GET /health` 返回 HTTP 200 和可机器判断的健康 JSON。
- `start-demo.command` 必须从任意当前目录启动，等待数据库和后端健康后再打开页面；失败时输出可执行的错误说明。
- 提供一条官方 reset 命令或脚本，重建合成演示状态且不要求手写 SQL。重置后五场景及三条闭环可重复运行两次，编号可变化但引用关系不可变化。

## Authoritative routes and actions

| Route | Primary user / source | Required primary actions and destination |
| --- | --- | --- |
| `#/monitoring` | 值班员；Modbus/合成态势 | 选单元、模拟火警/故障、进入核实、打开单元档案；加载失败显示原因与重试 |
| `#/incidents` | 值班员；待核实 signal / incident | 待核实信号也必须显示主区；登记误报、确认火警、绑定同一 event 到 Copilot、选择班组并派发 |
| `#/station` | 处置/维保班组 | 处置单依次签收/出发/到场/反馈；工单依次审批/开工/完成，不同时显示互斥动作；故障可携 event 进入 Copilot |
| `#/owner` | 网格责任人 | 开始整改、标记完成待复查、携 finding 返回巡查页 |
| `#/inspections` | 巡查员 | 上传/选择证据、查看 provider、人工修订、派发、查看证据、发起复查；设备/历史入口必须有真实面板或明确禁用原因 |
| `#/enterprises/:id` | 全角色；真实聚合档案 | 展示设备点位、最近事件、维保、隐患、工单、证据与下一步；进入核实/Copilot/班组/巡查时保留该企业上下文 |
| `#/copilot` | 值班员 / EHS | 选择五场景或绑定现有 event、运行/reset、人工确认/派发、导出审计；显示模型、provider、回退和工具轨迹 |
| `#/analysis` | EHS | 导入五份 CSV、解释风险评分、保存/重算/确认报告；只陈述规则计算，不冒充模型结论 |

所有 `data-action` 值必须命中显式 handler、原生导航或带原因的 `disabled` 状态。删除通用“下一阶段接入”兜底；新增静态合同测试，逐一比对 DOM action 与处理器。业务状态统一显示中文：`draft=待审批`、`approved=待开工`、`in_progress=处理中`、`done=已完成`、`assigned=整改中`、`closed=已闭环`、`issued=待签收`、`acknowledged=已签收`、`enroute=途中`、`arrived=已到场`、`abstained=证据不足`。

## Submission artifact contract

- 对外名称统一为 `FireOps AI｜工厂消防设备运维 Agent`。`FireGuard` 仅可作为内部兼容代码标识，不出现在赛事封面、项目简介、PPT/PDF、视频和主界面品牌位。
- 最终仓库至少包含：根 README、运行指南、企业版 PRD、架构说明、数据与安全说明、评测报告、完整交互说明、五场景 JSON、自动化测试、PPTX、同版 PDF、90 秒视频、旁白/字幕稿、关键截图和项目简介。
- PPT 固定 12 页、16:9：封面；痛点与用户；源头数据；Agent 架构；报警闭环；故障/维保闭环；巡查闭环；AI 证据与安全拒答；差异化；评测；开源复用/部署；结尾。逐页渲染，无溢出、裁切、旧名称、旧截图或不可辨认字号。
- 视频目标 85–95 秒、1920×1080、H.264 + AAC。画面只使用通过最终回归的真实页面；按 `Modbus → 核实 → Copilot 证据 → 人工派发 → 班组处理 → 巡查/维保闭环 → 安全边界` 顺序。字幕与对应旁白/点击的误差不超过 0.5 秒，无超过 3 秒的无解释静止画面，并人工检查至少 10 个时间点。
- Logo 为项目内 SVG，具备 `viewBox`、无外部字体/图片依赖，在 24、48、256 px 和深浅背景下可辨认；不复制 VoltAgent 标识。
- 赛事规则基线为 2026-08-09 复核的 GOAI 无界应用页。最终规则检查表逐项列出：目标用户、痛点、完整流程、模型/Agent、工具、知识库、数据来源、部署、安全合规、评测、迭代与开源复用。
- 最终 Git 历史在独立 FireOps 仓库中可审阅；本地交付必须完成。公网仓库 URL 是提交前必备外部步骤，若当前环境无 GitHub 权限则保留为明确未完成项，不伪造链接。

## Verification matrix and traceability

| Acceptance | Automated evidence | Manual oracle |
| --- | --- | --- |
| AC1 | `git bundle verify ../backups/fireguard-government-2026-08-09.bundle`；政府仓库 `git status --short` 与迁移前记录一致 | 核对两个仓库绝对路径与产品名称 |
| AC2 | 新建 `fireguard_test` 后运行 reset 两次；`curl -fsS http://127.0.0.1:8000/health` | 按运行指南从空环境启动一次 |
| AC3 / AC9 | 后端 unittest；`node scripts/copilot_e2e.cjs`；`node scripts/crosspage_flow_e2e.cjs`；新增巡查/维保终态 E2E | 抽查三条链的编号、责任人和证据连续性 |
| AC4 | 企业 dossier API 集成测试 + route E2E | 从档案分别进入核实、Copilot、班组和巡查 |
| AC5 / AC6 | 五场景 engine/API/E2E；Live provider timeout/invalid/evidence/unknown-tool tests；审计包 schema test | 页面检查工具输入输出、证据、审批点和回退标识 |
| AC7 | 巡查 provider、拒答、状态不变 API 测试 | 有图、无图、低置信度各操作一次 |
| AC8 | `node scripts/smoke_test.cjs` + action-contract test + 390×844 viewport E2E | 逐路由键盘和手机检查，无原始状态或空主区 |
| AC10 / AC11 | 搜索对外材料旧品牌/政府叙事；PPT render/slides tests；`ffprobe` 校验视频规格与时长 | 逐页查看 PPT/PDF；检查视频 10 个时间点与字幕同步 |
| AC12 | `docs/submission/goai-compliance-checklist.md` 无未勾选必填项 | 对照官方页面做提交前终审 |

最终质量门统一执行：后端全量测试、`node scripts/engine.test.cjs`、全路由 smoke、五场景 E2E、跨页闭环 E2E、action contract、移动端检查、PPT/PDF 渲染检查、视频 `ffprobe` 与材料一致性搜索。每条命令的日志、退出码和时间戳记录到 `.codex/dev-loop/validation-evidence.md`。

## Non-goals

- 不接真实 119、真实控制回路或生产系统。
- 不为了视觉效果继续扩建 3D 引擎；3D 只作为态势入口。
- 不做 React 重写、微服务拆分、多租户或生产级身份系统。
- 不以向量数据库、VLM 或云 ASR 的名义引入无法稳定演示的依赖。

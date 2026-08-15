# FireOps AI 全项目审查与继续优化任务书

> 供下一位 Agent 直接接手。用户已授权审查并继续做范围内优化：可以启动本地 Demo、访问本机 Docker、重置合成演示库和测试库、运行测试，并修复 P0 或实施一到三个 P1 改动。不得修改政府仓库、接入真实数据、对外发布、推送代码或执行破坏性 Git 操作。不要从头重构，也不要把比赛 Demo 当成生产系统包装。

## 1. 项目身份

- 仓库：`/Users/francischi/Documents/Vibe coding/fireops-ai`
- 当前分支：`codex/fireops-completion`
- 产品：`FireOps AI｜工厂消防设备运维 Agent`
- 赛事：GOAI「无界应用 / Boundless Agents」AI+工业制造
- 目标用户：新能源汽车工厂的消控室值班员、EHS、防火巡查员、处置班组、维保组和网格责任人
- 当前状态：比赛所需的本地可运行 Demo、PPTX、PDF、92 秒配音视频、运行文档和自动化验收均已生成；它不是生产系统，工作区也尚未提交或推送

一句话说明：FireOps AI 把 Modbus 火警主机事件、设备故障、维保记录、说明书和巡查隐患放进同一个事件与工单中枢。Agent 负责理解、检索、诊断、补缺和起草，所有高风险状态变化由人确认。

## 2. 本次审查要回答什么

请不要只看代码能否运行。审查需要回答下面六个问题：

1. 评委能否在 90 秒内理解问题、AI 的作用和最终交付结果？
2. 火警、故障/维保、巡查三条链是否真的从源头走到责任闭环，编号和状态有没有跨页丢失？
3. AI 是否基于工具证据工作，能否拒答、回退，并且没有越过人工审批？
4. 桌面端和手机端是否都能完成各自的主任务，所有可见按钮是否有结果或明确前置条件？
5. 3D 厂区、档案、Copilot 和岗位工作台是否服务于业务，而不是彼此孤立的展示页？
6. 代码、页面、PPT、PDF、视频和报名文案是否讲的是同一个企业产品？

## 3. 不可改变的边界

- 本次参赛不包含政府监管、消防救援机构或 119 指挥产品线。
- 不得修改政府版源仓库 `/Users/francischi/.cursor/Hackathon`。政府产品不属于 FireOps，但原项目迁出时需要证明源仓库和 Git bundle 未被本次开发破坏。凡是接触该仓库的操作，只允许执行 `scripts/verify_government_backup.py` 的只读校验。`scripts/runtime_contract.test.sh` 会调用这项校验，同时检查 FireOps 的 Docker、reset 和服务健康；它不会写入政府仓库。
- 全部数据必须继续标注为合成演示数据。
- 系统不上控，不启动灭火设备，不自动拨打 119，不替代 EHS、消防专业人员或现场负责人。
- AI 不得直接确认火警、派单、开工、完工或关闭隐患。
- PostgreSQL 和服务端状态机是业务真相源；3D、Copilot 和页面状态不能自行制造另一套事实。
- 保留 Scenario 离线模式。Live 模型没有密钥、超时或输出不合格时，必须显示原因并安全回退。
- 不要为了“更像 Agent”堆叠多 Agent、框架或外部依赖。只有能改善可验证任务闭环的改动才值得加入。
- 当前工作区包含用户已有改动。禁止 `git reset --hard`、`git checkout --` 或清理未跟踪提交物。

## 4. GOAI 规则映射

规则基线是 2026-07-16 版 20 页《GOAI 无界应用｜Boundless Agents 参赛手册》，官网于 2026-08-11 再次核对。

- 初赛截止：2026-08-16，北京时间。
- 必交：500 字以内作品简介、方案 PPT/PDF。
- 原型、Demo 视频和代码在初赛可选，但本项目已经全部准备。
- 复赛需要更新方案、可运行 Demo/视频、代码或等价工程材料、运行说明和数据合规材料。
- 作品必须面向真实行业任务，至少完成一个可演示、可验证的闭环；不鼓励泛聊天机器人。
- 当前材料按六项权重准备：行业价值 25%、Agent 闭环 25%、体验与 Demo 20%、技术 15%、安全与追溯 10%、开放复用 5%。

详细映射见 `docs/submission/goai-checklist.md`。官网没有公开单文件大小、命名和报名系统上传口径，提交前仍需登录确认，不能自行猜测。

## 5. 当前产品内容

### 5.1 页面和角色

| 路由 | 主要角色 | 页面作用 |
| --- | --- | --- |
| `#/home` | 全体 | 选择岗位工作台并查看主演示顺序 |
| `#/monitoring` | 消控室、EHS | 3D/2D 厂区态势、风险点位、模拟 Modbus 火警和设备故障入口 |
| `#/incidents` | 消控室值班员 | 人工确认火警后建立事件并派发；排除信号时不建立事件 |
| `#/station` | 处置班组、维保组 | 火警签收、出动、到场、首报；维修工单开工和完工 |
| `#/owner` | 网格责任人 | 接收、开始并完成巡查整改 |
| `#/inspections` | 防火巡查员 | 图片/语音辅助识别、隐患派发、预防性维保逾期扫描和复查关闭 |
| `#/enterprises/:id` | EHS | 聚合点位、事件、维保、隐患、工单、证据和下一步入口 |
| `#/copilot` | 消控室、EHS | 五个离线场景、中枢事件绑定、工具轨迹、证据、回退和审计包 |

跨页上下文通过 `enterprise_id`、`event_id`、`workorder_id` 和 `finding_id` 保存。新增导航应复用 `routeHash()`，不要写裸 hash。

岗位分工：消控室负责信号核实和处置派发；EHS 查看跨业务档案和证据；巡查员创建隐患并在整改完成后复查；处置/维保班组处理火警任务和维修工单；网格责任人完成巡查整改。

### 5.2 三条完整闭环

火警链有两个人工核实分支：

`Modbus 帧 → CRC/点位解析 → 待核实信号 → 人工确认火警 → 建立事件 → 派单 → 签收 → 出动 → 到场 → 首报`

如果人工选择“排除信号”，流程在核实记录处结束，不建立处置事件。Scenario A 验证的就是这一分支。

故障与维保链：

`设备故障或维保逾期 → 记录/手册检索 → AI 草稿 → 人工派发 → 开工 → 工单状态 done → 班组历史可回看`

设备故障从 `#/monitoring` 注入；维保逾期从 `#/inspections` 的扫描入口产生草稿。二者都在 `#/station` 的维保组工作台处理。

巡查链：

`图片/口述 → 识别草稿或拒答 → 人工派发 → 网格整改 → 工单完成 → 巡查复查 → 隐患关闭`

状态约束：信号只能 `pending → confirmed | dismissed`；火警事件按 `pending_dispatch → dispatched → acknowledged → enroute → arrived` 前进；运维工单只能按 `draft → approved → in_progress → done` 前进。巡查隐患从 `draft` 派发为 `assigned`，只有关联工单 `done` 后才能复查为 `closed`。重复终态动作应幂等，非法跳转不能改变数据库。

### 5.3 Agent 的实际作用

Agent 不是聊天入口，它位于每条业务链的“证据整理与决策准备”阶段：

- 理解自然语言、设备事件和当前业务上下文；
- 通过白名单工具查询信号、点位、企业档案、维保记录和说明书；
- 对工具返回的 evidence ref 做服务端校验，拒绝未知工具、非法参数和虚构证据；
- 生成核实草稿、维修/处置草稿、缺项清单和岗位简报；
- 数据不足时停下，不伪造结论；
- 导出 `fireops-audit-pack/v1`，记录输入、计划、工具轨迹、证据、人工决定和边界声明。

这里的 ToolGuard 是服务端工具守门层，负责白名单、参数结构、证据和权限校验；evidence ref 是工具真实返回的稳定证据编号，不是模型自由生成的引用；审计包是可下载的 JSON，不是另一个业务数据库。

五个 Scenario 场景位于 `demo-data/copilot_scenarios.json`：

| 场景 | 目的 |
| --- | --- |
| A | 涂装作业相邻误报，人工登记后不建立处置事件 |
| B | 电池车间确认火警，生成处置草稿和岗位简报 |
| C | 主机备电故障，检索手册并生成维修草稿 |
| D | 数据不足，列出缺项并安全拒答 |
| E | 气体灭火延时咨询，只引用手册，不生成控制动作 |

Live 使用 OpenAI 兼容接口。未配置密钥时返回 `model_not_configured`；调用失败或结构化结果不合格时回退 Scenario。当前知识检索是适合 Demo 规模的关键词 CSV，不应在材料中写成向量 RAG。

### 5.4 3D、移动端和视觉

- `monitoring-3d.js` 加载本地 Three.js 和 6 类 Blender GLB：factory、office、warehouse、mall、tower、tanks。
- 当前厂区有 20 栋建筑和 5 个企业风险点位。风险提示使用细光柱、光晕、扩散环和粒子，不再使用粗大“警戒锥”。
- 3.5 秒未 ready 或 WebGL 失败时，页面显示原因并保留二维档案入口，不能无限加载。
- 3D 是态势入口，不承担业务状态存储。
- 手机端以 390×844 验证 8 个关键路由，无横向溢出，主操作触点不小于 44px。
- 品牌使用 `assets/fireops-logo.svg`，外部名称统一为 FireOps AI。`FIREGUARD_DATABASE_URL` 等旧名称仅是历史兼容环境变量或后端包名，不是产品叙事。

## 6. 技术结构

```text
静态响应式前端（HTML / CSS / JS / Three.js）
  │ fetch + SSE
  ▼
FastAPI
  ├─ Modbus 帧接入与 CRC/点位解析
  ├─ 事件、核实、派发与班组状态机
  ├─ 工单、巡查、维保与企业档案聚合
  └─ Copilot Scenario/Live + ToolGuard
  │
  ▼
PostgreSQL
  + demo-data 合成 CSV、图片、知识库和场景夹具
```

关键文件：

| 文件 | 职责 |
| --- | --- |
| `app.js` | 路由、页面渲染、上下文和业务交互 |
| `monitoring-3d.js` | 厂区、建筑、点位和 2D 降级 |
| `styles.css` | 工业控制台视觉、响应式和可访问性 |
| `backend/fireguard_backend/app.py` | API 与请求合同 |
| `backend/fireguard_backend/repository.py` | PostgreSQL、状态机和聚合查询 |
| `backend/fireguard_backend/copilot.py` | Agent 运行与 Scenario/Live 编排 |
| `backend/fireguard_backend/copilot_tools.py` | 工具白名单、参数和证据守门 |
| `backend/fireguard_backend/inspection.py` | 巡查识别、provider 元数据和回退 |
| `scripts/e2e_contract.test.sh` | 浏览器端总验收入口 |
| `scripts/validate_submission_artifacts.py` | PPT/PDF/视频结构校验 |

当前工程边界：本地 Demo 无身份认证；SSE 是单进程内存广播；生产多 worker 需要换成 PostgreSQL LISTEN/NOTIFY 或消息系统。这些是明确缺口，不要在没有真实部署目标时做大规模基础设施改造。

本地拓扑和环境：

| 项目 | 要求或地址 |
| --- | --- |
| 操作系统 | macOS / Linux |
| 前端 | `http://127.0.0.1:4173` |
| FastAPI | `http://127.0.0.1:8000` |
| PostgreSQL | `127.0.0.1:54330`；演示库 `fireguard`，测试库 `fireguard_test` |
| 运行依赖 | Docker、Python 3.12 + uv、Node.js 18+；浏览器 E2E 需要本机 Chrome/Playwright |

## 7. 数据、合规和开放边界

- 企业、点位、事件、工单、维保、隐患、图片和 Modbus 帧均为项目自制合成数据。
- 不包含真实企业、警情、个人信息或商业秘密。
- 代码、文档和合成数据按 MIT 发布；第三方依赖遵守各自许可证。
- 默认 Scenario 可离线运行。Live 模式只应发送合成文本或合成图片说明。
- 模型、provider、model name、simulation 和 fallback reason 必须如实披露。

详见 `docs/submission/data-compliance.md`。

## 8. 已完成的交付物

| 文件 | 当前结果 |
| --- | --- |
| `docs/submission/project-intro-500.md` | 500 字以内项目简介 |
| `docs/submission/FireOps-AI-GOAI.pptx` | 12 页、16:9、可编辑、含讲稿 |
| `docs/submission/FireOps-AI-GOAI.pdf` | 与 PPT 同版 12 页 PDF |
| `docs/submission/FireOps-AI-GOAI-demo.mp4` | 92.02 秒、1920×1080、30fps、H.264/AAC、中文配音字幕 |
| `docs/submission/video/timeline.json` | 画面、旁白、字幕和时码的单一数据源 |
| `docs/submission/video/transcript.json` | 中文旁白文本 |
| `docs/product-walkthrough.md` | 页面、按钮、流程和 AI 作用说明 |
| `docs/HANDOFF.md` | 开发交接与运行入口 |

如果页面、数字、功能或安全边界发生变化，必须同步检查 PPT、PDF、视频、项目简介和 GOAI 清单。不要只改页面。

## 9. 已通过的验证

最后一次完整复核日期：2026-08-11。

- 后端 unittest：84 项通过。
- `node scripts/engine.test.cjs`：通过。
- `bash scripts/runtime_contract.test.sh`：政府源与 bundle 只读基线、演示库重复 reset、服务健康均通过。
- `bash scripts/e2e_contract.test.sh`：action contract、工作台 smoke、Copilot、跨页三闭环、移动端、3D/2D 降级全部通过。
- `node scripts/material_consistency.test.cjs`：通过。
- `python scripts/validate_submission_artifacts.py --deck`：通过。
- `python scripts/validate_submission_artifacts.py --video`：通过。
- `git diff --check`：通过。
- 规格基线 `specs/fireops-enterprise-application.md` 与 10 条 spec delta 一致。

测试和演示数据库必须隔离。运行 E2E 前使用项目提供的 reset，不要手写 `TRUNCATE`。

## 10. 已知不足

这些内容需要诚实保留，不要通过改文案掩盖：

- Live 模式只有契约、错误处理和回退验证，没有大规模模型质量评测。
- 巡查识别是演示级本地规则和合成证据，不是生产级 VLM。
- 浏览器 Web Speech 是语音输入的首选能力，没有独立 ASR 服务。
- 知识库是关键词匹配 CSV，不是向量 RAG。
- 当前无登录、RBAC、多租户和真实企业隔离。
- SSE 仅适合单进程本地 Demo。
- 合成数据能证明流程，不代表真实工厂的泛化结果。
- 官网尚未公开报名系统的文件大小、命名和具体上传限制。

## 11. 建议的审查顺序

1. 先读本文件、`README.md`、`docs/HANDOFF.md`、`docs/product-walkthrough.md`。
2. 对照 `docs/FireOps-AI-completion-spec.md` 和 `docs/submission/goai-checklist.md`，确认目标和边界。
3. 启动系统并从 `#/monitoring` 按火警、故障/维保、巡查顺序走一遍，不先读实现细节。
4. 逐页检查 8 个路由和手机尺寸；确认按钮、空状态、错误提示、上下文编号和完成后的历史记录。
5. 再读后端状态机、Copilot 工具守门、巡查识别和前端路由实现。
6. 运行完整测试，不接受“看起来没问题”。
7. 最后对照 PPT、PDF、视频和项目简介，检查叙事与实际 Demo 是否一致。

## 12. 继续优化的优先级

### P0：发现即阻断提交

- 状态机越权、重复创建事件、虚构 evidence ref 或 AI 直接改变业务状态；
- 任一主按钮无响应、错误跳转、跨页编号丢失或终态消失；
- Scenario 无法离线复现、Live 失败不回退、3D 加载失败后没有 2D 入口；
- 桌面或手机端主流程无法完成；
- 页面与提交材料出现事实冲突、旧品牌或政府叙事；
- 启动/reset/测试会污染演示库或政府版仓库。

### P1：能明显提高比赛竞争力再做

- 让评委更快看懂“AI 读取了哪些证据、做了什么、为什么停下、哪一步由人批准”；
- 改善主演示首屏、空状态、任务完成反馈和跨岗位交接提示；
- 在不增加加载风险的前提下提升厂区层次、建筑辨识度和风险点位可读性；
- 用真实自动化结果补充可复现指标，例如闭环步骤、测试覆盖和失败分支，不编造节省比例；
- 缩短不必要点击，让火警、故障/维保、巡查三条链更适合现场演示。

### P2：有生产目标时再做

- 登录、RBAC、多租户、审计签名和真实企业数据隔离；
- 生产级 VLM/ASR、向量检索和离线评测集；
- 多 worker SSE、消息队列、可观测性和云部署；
- 真实设备网关接入和行业合规评估。

不要为了比赛临时实现 P2。它们容易扩大风险，却不一定提高初赛得分。

## 13. 审查输出要求

请返回一份按严重度排序的报告：

1. `P0 / P1 / P2` 结论，每条包含文件、行号或页面路由、复现步骤和影响。
2. 区分“真实缺陷”“可选优化”“生产阶段能力”，不要混在一起。
3. 有截图问题时附截图；有流程问题时写清输入、动作、预期和实际结果。
4. 给出最小改动方案，优先复用现有状态机、路由、组件、脚本和依赖。
5. 修改前先记录基线；修改后运行与影响面匹配的测试。
6. 如果改了 UI、数字或功能，检查并同步提交材料。
7. 最后列出实际修改文件、通过的命令、仍需人工确认的事项。

先形成审查结论，再在同一任务内继续修改：有 P0 就修根因并补回归测试；没有 P0 时，只选择一到三个最能提高评审理解或 Demo 质量的 P1 改动。当前授权覆盖本地文件、Docker、合成演示库/测试库和验证命令，不覆盖政府仓库、真实数据、外部服务写入、提交、推送或发布。不要为制造工作量而改动。

## 14. 可直接复制给审查 Agent 的提示词

```text
请接管并审查 FireOps AI 全项目。

仓库：/Users/francischi/Documents/Vibe coding/fireops-ai
分支：codex/fireops-completion
首要文档：docs/AGENT-REVIEW-BRIEF.md

先完整阅读任务书、README、HANDOFF、产品说明、赛事规格和 GOAI 清单，再启动 Demo。请从用户视角实际走完火警、故障/维保、巡查三条链，检查 8 个页面、移动端、3D/2D 降级、Copilot 五场景、证据引用、人工审批和审计导出。随后审查代码、测试、PPT/PDF、92 秒视频和项目简介是否一致。

不要修改政府版源仓库，不要接真实设备，不要扩大 AI 权限，不要删除当前工作区改动，不要做无依据的大重构。先形成 P0/P1/P2 审查结论，然后在当前授权范围内修复 P0；没有 P0 时，只实施一到三个能明显提高评委理解、任务闭环或演示质量的 P1 优化。

完成后必须运行与改动匹配的后端、runtime、E2E、材料和提交物校验，并列出修改文件、测试证据、剩余风险及是否需要重新生成 PPT/PDF/视频。
```

## 15. 启动与验证命令

以下命令并非全部只读：`runtime_contract.test.sh` 会访问 Docker、重复 reset 演示库，并对政府源做只读校验；`e2e_contract.test.sh` 会在每组浏览器测试前 reset 演示库；后端 unittest 只能连接 `fireguard_test`。用户已授权这些本地操作，当前演示状态无需保留；仍不得把测试 DSN 指向其他数据库。

```bash
cd "/Users/francischi/Documents/Vibe coding/fireops-ai"
./start-demo.command

node scripts/engine.test.cjs
bash scripts/runtime_contract.test.sh
bash scripts/e2e_contract.test.sh
node scripts/material_consistency.test.cjs
python scripts/validate_submission_artifacts.py --deck
python scripts/validate_submission_artifacts.py --video
git diff --check
```

后端全量测试：

```bash
cd "/Users/francischi/Documents/Vibe coding/fireops-ai/backend"
FIREGUARD_TEST_DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard_test \
  PYTHONPATH=. .venv/bin/python -m unittest discover -s tests
```

演示前用官方 reset 恢复合成数据。不要假设服务已经运行，也不要用测试库替代演示库。

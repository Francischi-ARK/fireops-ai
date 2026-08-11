# FireOps 开发交接文档（fable5 → Grok）

> **读者**：接手继续开发的 Agent / 工程师  
> **仓库**：`/Users/francischi/.cursor/Hackathon`（由政府端 FireGuard 原型 fork）  
> **赛题**：GOAI「无界应用」· AI+工业制造 · 设备故障诊断与运维协同  
> **产品名**：FireOps AI — 新能源汽车工厂消防设备运维 Agent  
> **日期基准**：2026-08-09  

快速入口：运行与约定见根目录 [AGENTS.md](../AGENTS.md)；参赛材料见 [docs/submission/](submission/)。

---

## 0. 给接手 Agent 的一句话

把工厂火警主机 **Modbus 事件**、**维保逾期**、**巡查隐患**汇入**同一工单中枢**；Copilot 只做证据与草稿，**核实 / 派发 / 完工 / 复查**必须人工确认；**不控制真实设备、不自动启动灭火、不自动拨打 119**。

---

## 1. 产品定位（相对原 FireGuard）

| 维度 | 原 FireGuard（政府） | FireOps（本仓库） |
| --- | --- | --- |
| 用户 | 119 / 指挥 / 消防队 | 消控室值班、维保组、网格责任人、EHS |
| 主价值 | 警情调派 | 报警响应 + 故障诊断工单 + 维保/巡查闭环 |
| 数据 | 合成企业风险评分 | 同上 + 点位表 + Modbus 帧 + 说明书知识库 |
| 表名保留 | `enterprises` / `fire_stations` | 语义改为厂区单元 / 处置班组，**勿改回政府叙事** |

合规红线（不可破）：

- 合成数据演示；不接真实主机控制回路  
- AI 只起草，不执行；高风险动作保留审批闸  
- 对外报警（119）由人执行；气体灭火仅咨询，不远程启停  

---

## 2. fable5 原规划（应然架构）

出处：对话 [改造规划](3c8c4078-aaf4-45d3-993f-5732a37863d7)；计划稿  
`~/.cursor/plans/复盘并补齐流程_f8b57674.plan.md`。

### 2.1 一句话结构

**一个事件中枢 + 三条任务链 + 企业内三角色**

```mermaid
flowchart TB
  subgraph ingest [接入层]
    Host[火警主机_Modbus] --> Gateway[ARK网关仿真]
    Gateway --> DB[(企业库_点位编码表)]
  end
  subgraph hub [事件中枢]
    DB --> EventBus[统一事件_工单总线]
  end
  subgraph chain1 [任务链1_报警故障响应_主打]
    EventBus --> FirePath[火警_核实分级响应]
    EventBus --> FaultPath[故障_手册诊断_维修工单]
    FirePath --> Approve1[人工审批闸]
    FaultPath --> Approve1
  end
  subgraph chain2 [任务链2_维保]
    EventBus --> Maint[逾期计划_保养工单]
    Maint --> Approve2[人工确认派发]
  end
  subgraph chain3 [任务链3_防火巡查]
    Photo[拍照_语音] --> Finding[隐患草稿]
    Finding --> Approve3[派网格责任人]
  end
  Approve1 --> Workorders[统一工单中枢]
  Approve2 --> Workorders
  Approve3 --> Workorders
  Workorders --> Duty[消控室值班台]
  Workorders --> Crew[班组_维保工单视图]
  Workorders --> Grid[网格责任人待办]
```

### 2.2 三角色

| 角色 | 页面 | 职责 |
| --- | --- | --- |
| 消控室值班员 | `#/monitoring` `#/incidents` `#/copilot` | 看态势、核实火警、确认派发、跑 Agent |
| 处置班组 / 维保组 | `#/station` | 处置签收；维修/维保开工与完成核验 |
| 网格责任人 | `#/owner`（+ 巡查派发） | 整改待办；完成后交巡查复查 |

### 2.3 三条链的验收语义

1. **报警/故障响应**：Modbus 帧 → 点位 → 核实或诊断 → 工单 → 班组  
2. **预防性维保**：逾期扫描 → 保养草稿 → 人工派发 → 完成核验  
3. **防火巡查**：拍照/语音 → 隐患草稿 → 派网格 → 整改 → **复查闭环**  

火警 / 故障 / 维保 / 巡查最终都必须进**同一套工单与责任人闭环**；Copilot 是中枢上的理解层，不是旁路 Demo。

---

## 3. 演进时间线（做了什么）

### 3.1 fable5 主改造（从政府原型 → FireOps）

已落地（摘要）：

- Postgres 隔离：`fireops-postgres`，端口 **54330**（勿与原 FireGuard 共用）  
- Modbus RTU：`modbus.py`、`POST /gateway/modbus/frames`、`scripts/modbus_simulator.py`  
- 点位表 `device_points.csv`、知识库 `knowledge.csv`、工厂向 demo 数据  
- Copilot 场景 A–D、工具白名单、审批闸、三端简报、审计包  
- 巡查 analyze / findings / dispatch；维保逾期扫描  
- 前端 FireOps 品牌与监测/核实/巡查/Copilot 页面  

### 3.2 fable5「复盘补齐」计划（中枢串联）

计划文件：`复盘并补齐流程_f8b57674.plan.md` — **todos 均已 completed**：

| Todo | 内容 | 结果 |
| --- | --- | --- |
| inbox-api | `GET /workbench/inbox?role=crew\|duty\|owner` | 聚合处置派单 + ops 工单 |
| monitor-to-verify | 监测注入火警跳转核实台 | `#/monitoring` → `#/incidents` |
| fault-to-workorder | 故障进维修草稿/维保组 | 跳 `#/station` + `crew-wb-01` |
| copilot-bind | Copilot 绑定中枢信号；派发后跳班组 | 中枢信号模式 + 跳转 |
| e2e-crosspage | 跨页 E2E + demo 叙事 | `scripts/crosspage_flow_e2e.cjs` |

### 3.3 后续 Grok 补齐（闭环 + 材料 + UX）

在复盘计划「明确后置」项上继续完成：

| 项 | 状态 | 关键落点 |
| --- | --- | --- |
| 参赛材料 FireOps 化 | 完成 | `docs/submission/*` |
| 维保/运维工单 start→complete | 完成 | `POST /workorders/{id}/start\|complete`；班组 UI |
| 巡查复查闭环 | 完成 | `POST /inspection/findings/{id}/recheck` |
| 网格责任人独立待办 | 完成 | `#/owner` + inbox `role=owner` |
| 气体灭火延时场景 E | 完成 | `E-gas-release-delay-advisory`，intent `gas_release_advisory`，kb-008 |
| 监测两按钮空转 / 档案占位 / 空收件箱难懂 | 完成 | 核实=注入火警并跳转；档案=`#/enterprises/:id`；空态引导；首页串联条 |

前端缓存版本（以 `index.html` 为准）：`app.js?v=2.1`，`styles.css?v=1.7`。

---

## 4. 当前能力矩阵（实然）

| 规划节点 | 现状 | 备注 |
| --- | --- | --- |
| Modbus 解析入库 | ✅ | CRC / 事件池 / 点位映射 |
| 火警核实→派单→班组 | ✅ | 监测可一键灌数并跳转 |
| 故障→维修草稿→维保组 | ✅ | 班组下拉切 `crew-wb-01` |
| Copilot 绑定中枢 | ✅ | 亦可跑独立五场景 |
| 统一 inbox | ✅ | duty / crew / owner |
| 维保扫描→草稿→派发→完成 | ✅ | 完成需人工点「完成核验」 |
| 巡查→派发→网格→复查 | ✅ | `#/owner` + recheck |
| 车间档案 | ✅ 摘要级 | 风险/设备/隐患摘要 + 跳转，非完整台账系统 |
| 场景 E 气体延时咨询 | ✅ | **不起草控制类工单** |
| 向量 RAG / 真 VLM / 云 ASR | ❌ 刻意不做 | 见 `ponytail:` 与下文「不做」 |
| 身份认证 / 多租户 | ❌ | 本地演示 |

---

## 5. 路由与演示主路径

| Hash | 用途 |
| --- | --- |
| `#/home` | 工作台 + 串联条 |
| `#/monitoring` | 3D 态势；模拟火警/故障；核实/档案 CTA |
| `#/incidents` | 报警核实与处置派单 |
| `#/station` | 班组统一收件箱（处置 / 维修 / 维保） |
| `#/owner` | 网格整改待办 |
| `#/inspections` | 巡查识别、派发、复查入口 |
| `#/enterprises/:id` | 车间档案摘要 |
| `#/copilot` | Agent 五场景 / 中枢信号 |

**推荐手测顺序（给评委/接手人）：**

1. `#/monitoring` 电池车间 →「发起人工核实」或「模拟火警帧」→ `#/incidents` 确认 → 派发 → `#/station`（微型站）签收  
2. 监测「模拟主机故障」→ `#/station` 切维保组 → 确认派发 → 开始处理 → 完成核验  
3. `#/inspections` 新建巡查 → 派发 → `#/owner`（核对责任人姓名）→ 整改完成 → 巡查复查闭环  
4. `#/copilot` 五场景；E 仅咨询、无派发按钮  
5. `#/enterprises/ent-001` 看摘要并跳转继续处理  

Demo 旁白：[demo-script.md](demo-script.md)。

---

## 6. 关键 API（接手时优先读）

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| POST | `/gateway/modbus/frames` | 解析帧并落 `monitoring_events` |
| GET | `/workbench/inbox` | `role=crew\|duty\|owner` 聚合待办 |
| POST | `/workorders` | 创建 ops 工单 |
| POST | `/workorders/{id}/approve` | draft → approved |
| POST | `/workorders/{id}/start` | approved → in_progress |
| POST | `/workorders/{id}/complete` | approved\|in_progress → done |
| POST | `/inspection/analyze` | 演示级识别草稿 |
| POST | `/inspection/findings` | 建隐患 |
| POST | `/inspection/findings/{id}/dispatch` | 派发整改工单 |
| POST | `/inspection/findings/{id}/recheck` | `passed\|failed` 复查 |
| POST | `/maintenance/overdue-scan` | 维保逾期建议/草稿 |
| POST | `/copilot/runs` | Agent 运行 |
| POST | `/copilot/runs/{id}/approve` | `verification_result` / `workorder_dispatch` |
| GET | `/enterprises/{id}` | 单元详情（后端） |

表：`monitoring_events`、`signal_verifications`、`fire_incidents`、`incident_dispatches`、`ops_workorders`、`inspection_findings`、`device_points`、`copilot_runs`。  
中枢是**视图聚合**（inbox），不是已物理合并成一张表——**不要轻易做大翻车合并**，除非有明确迁移方案。

---

## 7. Copilot 五场景

夹具：`demo-data/copilot_scenarios.json`  
模板引擎：`backend/fireguard_backend/copilot.py`（Scenario 确定性计划）  
意图枚举：`copilot_schema.py`（含 `gas_release_advisory`）

| ID | 意图 | 要点 |
| --- | --- | --- |
| A-false-alarm-paint-shop | signal_verification | 维保相邻 → 误报倾向 |
| B-confirmed-fire-battery-workorder | incident_response_support | 确认后草稿+三端简报；派发需审批 |
| C-controller-fault-diagnosis | fault_diagnosis | 手册 kb-002 + 维修工单 |
| D-insufficient-data-safe-abstention | signal_verification | 拒答，不起草 |
| E-gas-release-delay-advisory | gas_release_advisory | 检索 kb-008；**无工单派发** |

---

## 8. 工程约定（必须遵守）

1. 前端无构建：改 `app.js` / `monitoring-3d.js` / `styles.css` 后 **bump** `index.html` 的 `?v=`  
2. 密钥只走环境变量（`backend/.env.example`），永不入库  
3. 注释里的 `ponytail:` = 刻意简化 + 升级路径，**勿当 TODO 删除**  
4. 勿改原 FireGuard 仓库；本仓 Postgres **54330**  
5. file:// 打开会导致 3D ES module 失败；用 `python3 -m http.server 4173`  
6. 用户未要求时不要 git commit / push  

验证：

```bash
cd backend && FIREGUARD_TEST_DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard \
  PYTHONPATH=. uv run python -m unittest discover -s tests

# 需 4173 + 8000；E2E 前建议清库（脚本内 docker truncate）
node scripts/copilot_e2e.cjs
node scripts/crosspage_flow_e2e.cjs
SMOKE_APP_ROOT="http://127.0.0.1:4173/" node scripts/smoke_test.cjs
```

---

## 9. 建议后续工作包（给下一任 Agent）

按优先级排列；每项应可独立验收。

### P0 — 演示与叙事（若临近提交）

1. **刷新参赛 PPT/PDF**（`docs/submission/FireGuard-Copilot-GOAI.*` 仍可能偏旧名）与 90 秒口播一致  
2. **README「四个场景」等残留文案**扫一遍改为五场景 / 中枢三链  
3. 录一条按 §5 手测顺序的演示视频脚本核对  

### P1 — 产品完整度（仍贴规划）

4. **值班台 duty inbox UI**：API 已有 `role=duty`，前端尚无独立「值班待办」聚合页（现散落在核实台）  
5. **档案页接真数据**：`GET /enterprises/{id}` + 点位列表 + 该单元 `ops_workorders` / findings，替代本地 `equipment`/`issues` 摘要  
6. **工单时间线**：ops 工单目前无与处置单同级的 timeline 事件；可写轻量 `ops_workorder_events` 或复用 activity  
7. **巡查列表与后端 findings 同步**：静态 `issues` 与 DB findings 仍有双轨，复查后列表刷新可再加固  
8. **Live 模式契约测**：Scenario 已绿；Live 仅回退可用，缺质量集  

### P2 — 加分 / 升级路径（ponytail）

9. 知识库：关键词 CSV → 向量检索（接口 `search_knowledge` 可替换）  
10. 巡查：规则图 → 真 VLM；Web Speech → 云 ASR（需披露与失败降级）  
11. 气体场景：监测注入 `GAS-START` 帧后一键绑定 Copilot E（模拟器已有 `GAS-START`）  
12. 粗粒度鉴权（演示账号角色切换持久化）  

### 明确不做（除非产品负责人改口）

- 真实设备控制 / 自动喷洒 / 自动拨打 119  
- 重做 3D 引擎或回改政府端 FireGuard 仓  
- 为「看起来高级」引入无关大重构（合并全部表、上 React 重写等）  

---

## 10. 已知体验坑（用户已反馈过）

| 现象 | 原因 / 处理 |
| --- | --- |
| 班组/网格「一片空白」 | 收件箱无工单时本为空；已加 guided empty。演示前先灌数 |
| 切错班组看不到单 | 处置看 `crew-wx-*`，维修/维保看 `crew-wb-01` |
| 网格列表空 | 责任人下拉须与派发时 `owner` 一致（如李强） |
| 「档案没用」 | 曾是占位；现为摘要跳板。完整台账见 P1-5 |
| 缓存旧 JS | 硬刷新；确认 `index.html` 的 `?v=` |

---

## 11. 关键文件索引

```
AGENTS.md                          运行拓扑与修改约定（先读）
README.md                          对外说明
docs/HANDOFF.md                    本文
docs/demo-script.md                90 秒演示
docs/submission/                   报名材料（简介/架构/评测/run-guide）
demo-data/copilot_scenarios.json   五场景夹具
demo-data/device_points.csv        点位
demo-data/knowledge.csv            手册条目（含 kb-008 紧急停动）
app.js                             前端路由与中枢串联（主改文件）
backend/fireguard_backend/app.py   HTTP 路由
backend/fireguard_backend/repository.py  DB + inbox + 工单/复查状态机
backend/fireguard_backend/copilot.py    Scenario 计划（含 E）
scripts/copilot_e2e.cjs            五场景 E2E
scripts/crosspage_flow_e2e.cjs     跨页中枢 E2E
scripts/modbus_simulator.py        GAS-START 等帧
~/.cursor/plans/复盘并补齐流程_f8b57674.plan.md  fable5 复盘计划原文
```

历史对话（规划与实现细节）：  
[改造与复盘会话](3c8c4078-aaf4-45d3-993f-5732a37863d7)

---

## 12. 接手检查清单（开干前 15 分钟）

- [ ] `docker compose up -d` 在 `backend/`，54330 可连  
- [ ] 后端 8000、前端 4173 已起；`/health` 正常  
- [ ] `unittest discover` 绿  
- [ ] 手测 §5 三条链各走通一次  
- [ ] 读完本文 §8 约定与 §9 工作包，再改代码  
- [ ] 改前端后 bump `?v=`；保持合规红线  

---

## 13. 文档维护

- 完成一个工作包后：更新本文 §4 矩阵与 §9 对应项状态  
- 新增 API/场景：同步 `AGENTS.md` 与 `docs/submission/architecture.md`  
- 勿把旅行项目计划（`三块能力深化_b1b5dc8f.plan.md`）误并入本仓——那是无关仓库  

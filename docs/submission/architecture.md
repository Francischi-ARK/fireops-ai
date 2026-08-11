# 技术架构说明

> FireOps AI · 工厂消防设备运维 Agent。

## 1. 系统架构

```text
响应式浏览器工作台（监测 / 核实派单 / 班组收件箱 / 网格待办 / 巡查 / Copilot）
  │  fetch / SSE
  ▼
FastAPI（fireguard_backend）
  ├─ 接入：POST /gateway/modbus/frames（ARK 网关仿真入口，只解析不上控）
  ├─ 领域：监测事件、信号核实、处置派单、站端状态
  ├─ 中枢：GET /workbench/inbox（duty/crew/owner 聚合）
  ├─ 运维：/workorders（approve/start/complete）、/inspection/*（dispatch/recheck）
  └─ Copilot：/copilot/runs（Scenario/Live）+ ToolGuard 白名单工具
        │
        ▼
PostgreSQL（enterprises / monitoring_events / device_points /
            fire_incidents / incident_dispatches /
            inspection_findings / ops_workorders / copilot_runs）
  +
demo-data（点位表、维保、知识库 CSV、场景夹具）
```

## 2. 模型选择与披露

- 默认：OpenAI 兼容 API（魔搭 Qwen 等），JSON 计划输出；失败自动回退确定性模板；
- 边界：模型只做理解与草稿；状态机、证据编号、派发生效由确定性代码负责；
- Scenario 模式与全部核心测试可不依赖外部模型离线复现。

## 3. Agent 与工具

- 单 Agent + 服务端 ToolGuard（白名单 / schema / 状态 / 审批）；
- 关键工具：信号上下文、点位、场地包、维保、手册检索、核实草稿、班组推荐、工单草稿、角色简报；
- 意图：信号核实、火警响应支持、故障诊断、气体灭火延时咨询（advisory，不执行控制）。

## 4. 知识增强

- 策展知识库 `knowledge.csv`（说明书故障表、误报/火警流程、气体灭火紧急停动、管理制度）；
- 检索：关键词命中排序；ponytail：可替换为向量检索，接口不变。

## 5. 多轮与中枢串联

- 业务多轮：监测注入 → 核实台/Copilot 绑定同一 `event_id` → 审批 → 班组收件箱；
- 故障自动生成维修草稿；巡查派发写入整改工单；维保逾期扫描写入保养草稿；
- 维保/整改工单经 approve → start → complete；巡查隐患经 recheck 关闭；
- 高风险动作（核实结果、工单派发、完成核验、复查闭环）必须人工确认。

## 6. 合规边界

- 合成数据；不控制真实设备；不自动启动灭火装置；对外报警（119）由人执行；
- 接口返回 `is_simulation: true`；可导出 `fireops-audit-pack` JSON。

## 7. 工程边界

- 无身份认证（本地演示）；SSE 单进程内存广播；
- 与政府端 FireGuard 原型隔离（Postgres 54330）。

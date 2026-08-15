# 技术架构说明

> FireOps AI · 工厂消防设备运维 Agent。

## 1. 系统架构

```text
响应式浏览器工作台（3D/2D 态势 / 核实派单 / 班组收件箱 / 网格待办 / 巡查 / 单元档案 / Copilot）
  │  fetch / SSE
  ▼
FastAPI（fireguard_backend）
  ├─ 接入：POST /gateway/modbus/frames（ARK 网关仿真入口，只解析不上控）
  ├─ 领域：监测事件、信号核实、处置派单、站端状态
  ├─ 中枢：GET /workbench/inbox（duty/crew/owner 聚合）
  ├─ 档案：/enterprises/{id}（点位、事件、维保、隐患、工单与下一步编号）
  ├─ 运维：/workorders（approve/start/complete）、/inspection/*（analyze/dispatch/recheck）
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

- 默认：Scenario 确定性计划；可选 Live 使用 OpenAI 兼容 API（默认配置为魔搭 Qwen），输出结构化 JSON；
- 回退：缺少密钥、超时、非法输出或证据不匹配时，记录明确原因并回退 Scenario；
- 边界：模型只做理解与草稿；状态机、证据编号、派发生效由确定性代码负责；高风险 API 由服务端演示 RBAC 校验，错误角色返回 403；
- Scenario 模式与全部核心测试可不依赖外部模型离线复现。

## 3. Agent 与工具

- 单 Agent + 服务端 ToolGuard（白名单 / schema / 证据 / 状态 / 审批）；
- 关键工具：信号上下文、点位、场地包、维保、手册检索、核实草稿、班组推荐、工单草稿、角色简报；
- 意图：信号核实、火警响应支持、故障诊断、气体灭火延时咨询（advisory，不执行控制）。

## 4. 知识增强

- 策展知识库 `knowledge.csv`（说明书故障表、误报/火警流程、气体灭火紧急停动、管理制度）；
- 检索：设备型号/文档类型精确过滤 + 消防领域同义词归一化 + 关键词加权重排；返回文档、章节、页码、证据编号和匹配理由。30 题评测 Top-1 召回 96.4%、Top-3 召回 100%、无依据拒答率 100%。知识规模扩大后可在保持接口不变的前提下加入向量召回。

## 5. 多轮与中枢串联

- 业务多轮：监测注入 → 核实台/Copilot 绑定同一 `event_id` → 审批 → 班组收件箱；
- 故障帧接入后生成维修草稿；Copilot 可绑定同一事件补充诊断证据，若尚无草稿则起草一份；巡查派发写入整改工单；维保逾期扫描写入保养草稿；
- 维保/整改工单经 approve → start → complete；巡查隐患经 recheck 关闭；
- 高风险动作（核实结果、工单派发、开始处理、完成核验、复查闭环）必须人工确认；Agent 工具不包含直接写入状态的能力。

## 6. 合规边界

- 合成数据；不控制真实设备；不自动启动灭火装置；对外报警（119）由人执行；
- Scenario 接口返回 `is_simulation: true` 与 `external_system: "none"`；Live 会披露 provider、model 和回退原因；可导出 `fireops-audit-pack/v1` JSON。

## 7. 工程边界

- 当前为固定演示身份与服务端 RBAC，不包含密码登录、SSO 和多租户；SSE 使用单进程内存广播；
- 3D 为态势表达层，业务事实以 PostgreSQL 和证据编号为准；WebGL 失败保留二维档案入口。

# 评测报告

> 对应评审维度「Agent 能力与任务闭环」与手册「验证与反馈」。
> 指标可由 `backend/tests/`、`scripts/copilot_e2e.cjs`、`scripts/crosspage_flow_e2e.cjs` 复现。

## 1. 评测对象与方法

- 对象：FireOps AI（工厂消防设备运维 Agent；Scenario + Live 回退）；
- 方法：后端 unittest（含 Modbus/网关/巡查/收件箱）+ 五场景 Copilot E2E + 跨页中枢 E2E；
- 数据：全部合成，夹具见 `demo-data/copilot_scenarios.json` 与 `device_points.csv`。

## 2. 指标定义与结果

| 指标 | 定义 | 目标 | 实测 |
| --- | --- | --- | --- |
| 证据覆盖率 | 场景 expected_evidence 被工具产出的比例 | 100% | 100%（集成测试断言） |
| 缺项召回 | 数据不足场景必填缺失字段全部列出 | 100% | 100%（场景 D） |
| 安全拒答正确率 | 证据不足时不起草处置/维修工单 | 100% | 100%（abstained） |
| 越权拦截率 | 未确认状态/未知工具/非法参数被拦截 | 100% | 100%（守门用例） |
| 虚构证据拦截 | 模型引用不存在证据被过滤 | 100% | 100% |
| 回退可用率 | 模型失败仍可完成演示 | 100% | 100% |
| 协议解析正确率 | Modbus CRC/事件帧编解码往返 | 100% | 100%（test_modbus） |
| 中枢串联可用 | 监测火警→核实→派单→班组收件箱 | 是 | 是（crosspage_flow_e2e） |
| 离线可复现 | Scenario 模式无外网可跑五场景 | 是 | 是（copilot_e2e） |
| 审计包完整性 | 含输入、轨迹、证据、人工决定、边界声明 | 是 | 是（fireops-audit-pack） |

## 3. 已知缺口（诚实声明）

- Live 模式未做大规模质量评测，仅覆盖契约与回退；
- 巡查识别为演示级规则（证据图资产 + 关键词），非生产级 VLM；语音优先浏览器 Web Speech；
- 知识检索为关键词匹配 CSV，非向量 RAG（规模适合 Demo，升级路径已标明）；
- 合成数据规模有限，不代表真实工厂泛化能力。

## 4. 复现步骤

见 `run-guide.md` 第 7 节。关键命令：`unittest discover`、`scripts/copilot_e2e.cjs`、`scripts/crosspage_flow_e2e.cjs`。

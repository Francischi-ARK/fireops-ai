# 评测报告

> 对应评审维度「Agent 能力与任务闭环」与手册 8.2.6「验证与反馈」。
> 所有指标可由评审用 `backend/tests/` 与 `scripts/copilot_e2e.cjs` 复现。

## 1. 评测对象与方法

- 对象：FireGuard Copilot（Scenario 模式 + Live 模式回退路径）；
- 方法：44 个后端自动化测试 + 三场景浏览器 E2E + 手工演示核对（2026-08-06 实测）；
- 数据：全部合成，夹具见 `demo-data/copilot_scenarios.json`。

## 2. 指标定义与结果

| 指标 | 定义 | 目标 | 实测 |
| --- | --- | --- | --- |
| 证据覆盖率 | 三个场景 expected_evidence 中实际被工具产出的比例 | 100% | 100%（test_copilot_integration 三场景断言通过） |
| 缺项召回 | 场景 C 五个必填缺失字段被全部列出的比例 | 100% | 100%（集成测试与 E2E 双重断言） |
| 安全拒答正确率 | 数据不足场景中未生成任何草稿或调派建议的比例 | 100% | 100%（场景 C 无草稿、abstained=true） |
| 越权拦截率 | 未确认状态下调派草稿、无审批写时间线、未知工具被拦截的比例 | 100% | 100%（test_copilot.py 12 个守门用例） |
| 虚构证据拦截 | 模型引用不存在证据被过滤的比例 | 100% | 100%（test_model_invented_evidence_is_dropped） |
| 回退可用率 | 模型超时、无效输出或不可用时仍可完成演示流程的比例 | 100% | 100%（超时/无效 JSON/schema 错误三类回退用例） |
| 离线可复现 | Scenario 模式无外部网络可完成三场景 | 是 | 是（scripts/copilot_e2e.cjs 三场景全过） |
| 手机端处置可用 | 390×844 视口可完成场景选择、人工确认和审计包导出，无横向溢出 | 是 | 是（scripts/copilot_e2e.cjs 自动断言） |
| 审计包完整性 | 下载包包含输入、工具轨迹、证据、人工决定、角色简报和边界声明 | 是 | 是（JSON schema 版本与人工决定自动断言） |

## 3. 已知缺口（诚实声明）

- Live 模式的输出质量未做大规模评测，仅覆盖契约与回退路径；
- 三个场景为策展夹具，不代表开放场景泛化能力；手机端为响应式 Web，不是原生 App；
- 多模态仅支持图片 + 文本输入，语音识别未接入；
- 五家企业合成数据规模小，证据检索未经历真实数据量考验。

## 4. 复现步骤

见 `run-guide.md` 第 7 节。测试清单：`test_copilot.py`（守门）、`test_copilot_engine.py`（双模式）、`test_copilot_api.py`（运行持久化）、`test_copilot_integration.py`（真实数据库证据链）、`scripts/copilot_e2e.cjs`（浏览器全流程）。

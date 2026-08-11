# AGENTS.md — FireOps AI 项目导读

> 供 AI 编码助手（Cursor / Codex 等）快速理解本仓库。人工阅读请从 [README.md](README.md) 开始。
> **继续开发请先读** [docs/HANDOFF.md](docs/HANDOFF.md)（fable5 规划 + 复盘串联 + Grok 闭环补齐与待办）。

## 项目一句话

GOAI 人工智能开源大赛「无界应用」赛道（AI+工业制造）作品：新能源汽车工厂消防设备运维 Agent（FireOps）。
全部数据为合成演示数据（合规底线：不控制真实设备、不自动启动灭火装置、AI 只起草不执行；对外报警由人工执行；高风险动作需人工审批）。

本仓库由政府端 FireGuard 原型 fork 改造而来；表名/API 路径大量保留（`enterprises`≈厂区单元、`fire_stations`≈处置班组），语义已企业化。

## 运行拓扑（三个进程）

| 组件 | 启动 | 端口 |
| --- | --- | --- |
| Postgres | `cd backend && docker compose up -d`（容器 `fireops-postgres`） | 54330 |
| 后端 FastAPI | `cd backend && uv run uvicorn fireguard_backend.app:app --host 127.0.0.1 --port 8000` | 8000 |
| 前端静态服务 | 仓库根 `python3 -m http.server 4173` | 4173 |

入口页：`http://127.0.0.1:4173/#/monitoring`（3D 态势）、`#/copilot`（Agent 演示）。
注意：file:// 直开 index.html 会被浏览器拦截 ES module，3D 场景不加载。
与原 FireGuard 并行时勿共用 Postgres 端口（本仓库固定 54330）。

## 目录地图

```
index.html / app.js / styles.css   前端 SPA（原生 JS，hash 路由，无构建步骤）
engine.cjs                         前端领域引擎：CSV 解析、评分、事件状态机
monitoring-3d.js                   3D 厂区态势（three.js ES module）
assets/                            three.js 本地依赖 + 演示图片
backend/fireguard_backend/         FastAPI 后端
  app.py                           路由（含 /workbench/inbox、/workorders、/inspection、/gateway/modbus）
  modbus.py                        海湾控制器 Modbus RTU 帧解析（CRC16、事件池）
  inspection.py                    巡查多模态草稿（演示级图片规则+语音文本）与维保逾期扫描
  domain.py + repository.py        领域逻辑 + Postgres（device_points / inspection_findings / ops_workorders）
  copilot.py + copilot_tools.py    Agent：核实草稿 / 手册检索 / 班组推荐 / 工单草稿 / 三端简报
  copilot_provider.py              Scenario / Live 双模式，失败自动回退
  copilot_schema.py + streaming.py 运行 schema + SSE
backend/tests/                     unittest（含 test_modbus、test_gateway_api）
scripts/
  modbus_simulator.py              向网关注入合成 Modbus 帧
  smoke_test.cjs / copilot_e2e.cjs 前端冒烟与五场景 E2E
demo-data/                         合成 CSV + knowledge.csv + device_points.csv + 五场景夹具
docs/                              HANDOFF.md（接手必读）、PRD、demo 脚本；docs/submission/ 报名材料
refs/                              规约文本摘录（海湾 / 高能 Modbus）
```

## 数据流（Copilot 一次运行）

前端 `#/copilot` → `POST /monitoring/events`（或 `POST /gateway/modbus/frames`）→ `POST /copilot/runs`
→ Agent 调用白名单工具（`search_manual` / `recommend_crew` / `create_workorder_draft` 等）
→ 高风险动作 `pending_approval` → `POST /copilot/runs/{id}/approve`（`verification_result` / `workorder_dispatch`）
→ 三端交付（消控室 / 处置班组 / 网格责任人）+ 时间线 + `fireops-audit-pack` JSON 导出。

五场景：A 误报核实 · B 确认火警工单 · C 主机故障诊断工单 · D 数据不足拒答 · E 气体灭火延时咨询（不控制设备）。

## 常用验证命令

```bash
# 后端测试
cd backend && FIREGUARD_TEST_DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard \
  PYTHONPATH=. uv run python -m unittest discover -s tests

# 前端冒烟与 E2E（需 4173 与 8000；E2E 重跑前建议清库）
SMOKE_APP_ROOT="http://127.0.0.1:4173/" node scripts/smoke_test.cjs
node scripts/copilot_e2e.cjs
node scripts/engine.test.cjs
```

## 修改时的约定

- 前端无构建：改 `app.js` / `monitoring-3d.js` / `styles.css` 后，必须 bump `index.html` 里的 `?v=` 查询串。
- 合规红线不可破：不得出现「AI 自动拨打 119 / 自动联动真实设备 / 自动启动灭火装置」；高风险动作必须保留人工审批闸。
- 后端配置走环境变量，模板在 `backend/.env.example`；密钥永不入库。
- 代码注释中的 `ponytail:` 是刻意简化标记，附升级路径，勿当 TODO 误删。

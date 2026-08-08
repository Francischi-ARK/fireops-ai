# AGENTS.md — FireGuard Copilot 项目导读

> 供 AI 编码助手（Cursor / Codex 等）快速理解本仓库。人工阅读请从 [README.md](README.md) 开始。

## 项目一句话

GOAI 人工智能开源大赛「无界应用」赛道作品：工业园区消防风险与警情协同 Agent。
全部数据为合成演示数据（合规底线：不连 119、不控真实设备、AI 只起草不执行，高风险动作需人工审批）。

## 运行拓扑（三个进程）

| 组件 | 启动 | 端口 |
| --- | --- | --- |
| Postgres | `docker start fireguard-postgres`（容器已建，勿 `compose up` 重建） | 54329 |
| 后端 FastAPI | `cd backend && uv run uvicorn fireguard_backend.app:app --host 127.0.0.1 --port 8000` | 8000 |
| 前端静态服务 | 仓库根 `python3 -m http.server 4173` | 4173 |

macOS 可双击 `start-demo.command` 一键拉起并打开浏览器。
入口页：`http://127.0.0.1:4173/#/monitoring`（3D 态势）、`#/copilot`（Agent 演示）。
注意：file:// 直开 index.html 会被浏览器拦截 ES module，3D 场景不加载。

## 目录地图

```
index.html / app.js / styles.css   前端 SPA（原生 JS，hash 路由，无构建步骤）
engine.cjs                         前端领域引擎：CSV 解析、评分、事件状态机（浏览器与 Node 双端复用）
monitoring-3d.js                   3D 园区态势（three.js ES module）：GLB 建筑、能量信标、点击选中
assets/                            three.js r185 本地依赖 + 演示图片（完全离线可用）
assets/buildings/                  建筑 GLB + generate_buildings.py（Blender 脚本，资产可复现）
backend/fireguard_backend/         FastAPI 后端
  app.py                           路由（/monitoring /incidents /stations /copilot 等）
  domain.py + repository.py        领域逻辑 + Postgres 持久化（启动时若空库自动播种 demo-data/）
  copilot.py + copilot_tools.py    Agent 核心：任务理解→追问→证据检索→步骤规划；工具白名单守门
  copilot_provider.py              Scenario（离线模板）/ Live（真实模型）双模式，失败自动回退
  copilot_schema.py + streaming.py 运行 schema 校验 + SSE 实时推送
backend/tests/                     44 个 unittest（守门、双模式、证据链、持久化）
scripts/                           Node 验证脚本（Playwright）：
  smoke_test.cjs                   前端冒烟（SMOKE_APP_ROOT 指定 http 根）
  copilot_e2e.cjs                  三场景 E2E + 390px 手机确认链（需后端运行）
  engine.test.cjs                  前端引擎单测（Node 直接跑）
  copilot_shots.cjs / copilot_demo_video.cjs  截图与演示录制
demo-data/                         合成数据 CSV + copilot_scenarios.json（三个演示场景夹具）
docs/                              PRD、demo 脚本；docs/submission/ 为报名材料（含 run-guide、eval-report）
specs/                             调派状态机规范
```

## 数据流（Copilot 一次运行）

前端 `#/copilot` → `POST /copilot/runs`（scenario 或自由输入）→ Agent 规划并调用白名单工具
→ 高风险动作进入 `pending_approval` → `POST /copilot/runs/{id}/approve` 人工确认
→ 生成三端交付物（指挥台简报/救援站首战信息/企业整改待办）+ 时间线 + JSON 审计包导出。

## 常用验证命令

```bash
# 后端测试（需先建 fireguard_test 库，见 run-guide 第 7 节）
cd backend && FIREGUARD_TEST_DATABASE_URL=... PYTHONPATH=. uv run python -m unittest discover -s tests
# 前端冒烟与 E2E（需 4173 与 8000 运行中；E2E 重跑前须按 run-guide 清库）
SMOKE_APP_ROOT="http://127.0.0.1:4173/" node scripts/smoke_test.cjs
node scripts/copilot_e2e.cjs
node scripts/engine.test.cjs
```

Playwright 依赖外部 Node 运行时：`NODE_PATH=<node_modules>`，Chrome 路径可用 `PLAYWRIGHT_CHROME` 覆盖。

## 修改时的约定

- 前端无构建：改 `app.js` / `monitoring-3d.js` / `styles.css` 后，必须 bump `index.html` 里的 `?v=` 查询串，否则浏览器吃缓存。
- 建筑模型不要手改 GLB：改 `assets/buildings/generate_buildings.py` 后在 Blender 里重跑导出（脚本内有 MCP 执行示例）。
- 合规红线不可破：任何"AI 自动拨打 119 / 自动联动真实设备"的表述或行为都不能出现；高风险动作必须保留人工审批闸。
- 后端配置走环境变量，模板在 `backend/.env.example`；密钥永不入库。
- 代码注释中的 `ponytail:` 是刻意简化标记，附升级路径，勿当 TODO 误删。

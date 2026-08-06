# 使用说明（运行指南）

> 对应手册附录「使用说明」：运行环境、部署方式、操作流程、输入样例、输出说明、注意事项。

## 1. 环境要求

- macOS / Linux，Docker（PostgreSQL 16 容器，或用任意本地 PostgreSQL 15+ 替代）
- Python 3.12 + `uv`（后端依赖：FastAPI、psycopg、uvicorn）
- Node.js 18+（仅前端静态服务与 Playwright 验证需要）
- Chrome（Playwright 冒烟与 E2E 使用本机 Chrome）

## 2. 启动（从零到 Demo 约 2 分钟）

```bash
cd fireguard-ai-prototype/backend
docker compose up -d --wait postgres      # 端口 54329，账号库名均为 fireguard
uv sync
DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54329/fireguard \
  uv run uvicorn fireguard_backend.app:app --host 127.0.0.1 --port 8000
```

另开一个终端：

```bash
cd fireguard-ai-prototype
python3 -m http.server 4173
```

打开 `http://127.0.0.1:4173/#/copilot` 进入 Copilot 演示页。

重置演示数据：`docker compose down -v` 后重新执行启动步骤。

## 3. 操作流程（三幕 Demo）

1. 选择一个演示场景（A 疑似误报 / B 真实警情 / C 数据不足），默认「场景回放」模式离线可跑；
2. 点击「运行 Copilot」：系统先写入一条合成设备火警信号，再执行一次 Agent 运行；
3. 查看任务理解、缺失字段、工具调用轨迹和证据面板；
4. 场景 B：点「确认属实，建立警情」→ 查看调派草稿与三端交付 → 点「下达调派（人工确认）」→ 可跳转指挥台与救援站终端继续签收、出动、到场、首报；
5. 场景 A：点「确认误报，不建警情」，信号闭环为误报；场景 C：查看安全拒答与缺失字段。

## 4. 输入样例

- 文本：场景卡内置合成上报文本（如「2 层涂布车间冒烟并见明火，现场 3 人已疏散，1 人失联」）；
- 图片：合成控制室记录、厂房平面图（`assets/`）；
- 设备信号：场景卡内置合成信号载荷，运行时写入演示数据库。

## 5. 输出说明

- 结构化计划：意图、步骤、缺失字段、风险提示；
- 工具轨迹：每次调用的名称、参数、成败与证据编号；
- 草稿：待核实任务、调派建议（均不自动生效）；
- 三端交付：指挥台简报、救援站首战信息、企业整改待办；
- 运行记录：`GET /copilot/runs/{id}` 可复查完整轨迹、模型信息与人工审批。

## 6. Live 模型模式（可选）

```bash
export COPILOT_MODEL_API_KEY=<你的魔搭 API Key>
# 可选覆盖：COPILOT_MODEL_BASE_URL / COPILOT_MODEL_NAME
```

未配置或调用失败时自动回退确定性模板，Demo 流程不中断；界面会显示回退原因。

## 7. 验证与测试

```bash
createdb -h 127.0.0.1 -p 54329 -U fireguard fireguard_test
FIREGUARD_TEST_DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54329/fireguard_test \
  PYTHONPATH=. uv run python tests/reset_test_database.py
FIREGUARD_TEST_DATABASE_URL=... PYTHONPATH=. uv run python -m unittest discover -s tests
node smoke_test.cjs        # 前端冒烟
node copilot_e2e.cjs       # 三场景 E2E（需后端运行中）
```

重复运行 E2E 前先清空演示库状态（否则场景 B 会撞上站点已被占用）：

```bash
docker exec fireguard-postgres psql -U fireguard -d fireguard -c \
  "TRUNCATE incident_timeline, dispatch_reports, incident_dispatches, fire_incidents, signal_verifications, monitoring_events, copilot_runs; UPDATE fire_stations SET status='available';"
```

冒烟脚本在 file:// 下会被浏览器拦截 ES module，走本地服务：`SMOKE_APP_ROOT="http://127.0.0.1:4173/" node smoke_test.cjs`。

## 8. 注意事项

- 全部数据为合成演示数据，未连接 119、消防物联网或任何真实系统；
- 接口无身份认证，仅供本地演示与评审复现；
- SSE 广播为单进程内存实现，多 worker 部署需改为 PostgreSQL LISTEN/NOTIFY。

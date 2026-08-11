# 使用说明（运行指南）

> FireOps AI · 工厂消防设备运维 Agent。对应手册附录「使用说明」。

## 1. 环境要求

- macOS / Linux，Docker（PostgreSQL 16 容器）
- Python 3.12 + `uv`（后端依赖：FastAPI、psycopg、uvicorn）
- Node.js 18+（前端静态服务与 Playwright 验证）
- Chrome（Playwright 冒烟与 E2E）

## 2. 启动（从零到 Demo 约 2 分钟）

```bash
cd Hackathon/backend
docker compose up -d --wait postgres      # 容器 fireops-postgres，端口 54330
uv sync
DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard \
  uv run uvicorn fireguard_backend.app:app --host 127.0.0.1 --port 8000
```

另开一个终端：

```bash
cd Hackathon
python3 -m http.server 4173
```

打开 `http://127.0.0.1:4173/#/copilot` 进入 Copilot 演示页。

重置演示数据：`cd backend && docker compose down -v` 后重新执行启动步骤。

## 3. 操作流程

### 3A. 工作台中枢串联（推荐主演示）

1. `#/monitoring` 选电池车间 →「模拟火警帧」→ 自动跳转 `#/incidents` 同一条待核实信号；
2. 「确认火警」→「派发工单」→ `#/station` 选择「微型消防站·西区」→ 收件箱可见处置工单并签收；
3. 监测页「模拟主机故障」→ 跳转维保组收件箱，确认维修草稿或用 Copilot 诊断后派发；
4. `#/inspections`「新建巡查识别」→ 派发网格责任人整改（写入同一 `ops_workorders` 中枢）。

### 3B. Copilot 四幕（可绑定中枢信号）

1. 选择场景 A/B/C/D；或切换「中枢信号」绑定监测/核实台已有事件（不再新建旁路信号）；
2. 运行后按场景完成核实/工单人工确认；派发成功会跳转班组终端。

可选：`python3 scripts/modbus_simulator.py` 向 `POST /gateway/modbus/frames` 注入合成报警帧。

## 4. 输入样例

- 文本：场景卡内置合成上报文本（涂装误报、PACK 区火警、主机备电故障等）；
- 图片：合成控制室记录、厂房平面图（`assets/`）；
- 设备信号：Modbus RTU 十六进制帧 + 点位编码表（`demo-data/device_points.csv`）。

## 5. 输出说明

- 结构化计划：意图、步骤、缺失字段、风险提示；
- 工具轨迹：每次调用的名称、成败与证据编号（含 `search_manual`、`recommend_crew`）；
- 草稿：待核实任务、处置/维修工单（均不自动生效）；
- 三端交付：消控室值班简报、处置班组任务卡、网格责任人待办；
- 审计包：导出 `fireops-audit-pack/v1` JSON。

## 6. Live 模型模式（可选）

```bash
export COPILOT_MODEL_API_KEY=<你的魔搭 API Key>
# 可选覆盖：COPILOT_MODEL_BASE_URL / COPILOT_MODEL_NAME
```

未配置或调用失败时自动回退确定性模板；界面会显示回退原因。

## 7. 验证与测试

```bash
cd backend
FIREGUARD_TEST_DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard \
  PYTHONPATH=. uv run python -m unittest discover -s tests
# 项目根目录
SMOKE_APP_ROOT="http://127.0.0.1:4173/" node scripts/smoke_test.cjs
node scripts/copilot_e2e.cjs       # 五场景 E2E（需后端运行中）
node scripts/crosspage_flow_e2e.cjs  # 监测→核实→派单→班组 / 故障收件箱
```

重复运行 E2E 前先清空演示库状态（否则场景 B 会撞上班组已被占用）：

```bash
docker exec fireops-postgres psql -U fireguard -d fireguard -c \
  "TRUNCATE incident_timeline, dispatch_reports, incident_dispatches, fire_incidents, signal_verifications, monitoring_events, copilot_runs; UPDATE fire_stations SET status='available';"
```

## 8. 注意事项

- 全部数据为合成演示数据；不控制真实设备、不自动启动灭火装置；对外报警（119）由人工执行；
- 接口无身份认证，仅供本地演示与评审复现；
- SSE 广播为单进程内存实现，多 worker 部署需改为 PostgreSQL LISTEN/NOTIFY；
- 与原 FireGuard 政府端原型并行时，本仓库 Postgres 使用 54330，勿共用 54329。

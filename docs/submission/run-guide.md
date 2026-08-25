# 使用说明（运行指南）

> FireOps AI · 工厂消防设备运维 Agent。对应手册附录「使用说明」。

## 1. 环境要求

- macOS / Linux，Docker（PostgreSQL 16 容器）
- Python 3.12 + `uv`（后端依赖：FastAPI、psycopg、uvicorn）
- Node.js 18+（前端静态服务与 Playwright 验证）
- Chrome（Playwright 冒烟与 E2E）

## 2. 启动

首次获取代码后安装后端依赖：

```bash
cd fireops-ai/backend
uv sync
cd ..
```

启动 Demo：

```bash
cd fireops-ai
./start-demo.command
```

脚本兼容 `docker compose` 和 `docker-compose`，会等待 PostgreSQL、API 与前端健康后打开 `http://127.0.0.1:4173/#/monitoring`。

浏览器 E2E 额外需要 Node.js 18+、本机 Chrome 和 `playwright`，它们不影响核心 Demo。服务启动后执行：

```bash
npm install --no-save playwright
cd backend
FIREGUARD_TEST_DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard_test \
  PYTHONPATH=. .venv/bin/python tests/reset_test_database.py
cd ..
```

重置演示数据：

```bash
FIREGUARD_DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard \
  PYTHONPATH=backend backend/.venv/bin/python backend/tests/reset_demo_database.py
```

## 3. 操作流程

### 3A. 公开评委演示（无需后端）

1. 打开 `#/monitoring`，从工厂总览进入电池车间，使用状态、楼层和四个证据页签查看固定合成事件；
2. “模拟火警帧”和“模拟故障”只把合成事件加入队列，不自动代表人工确认，也不依赖数据库；
3. 选择“待核实”中的火警，点击“进入 Copilot 核实处置”，再运行“开始评委演示”；误报可在监测页登记并关闭；
4. Copilot 完成后先看五段式运行记录，需要技术复核时再下载原始 JSON；
5. `#/owner` 无整改任务时点击“去防火巡查新建任务”；`#/analysis/ent-004` 可载入固定演示数据查看消防健康报告。

### 3B. 本地完整服务工作流

1. `#/monitoring` 注入火警帧后，进入 `#/incidents` 对同一条待核实信号人工确认或排除；
2. 确认火警后派发工单，进入 `#/station` 完成签收、出动、到场、首报和人工归档；
3. 故障进入维修/维保链，不进入火警处置链；
4. `#/inspections` 新建巡查识别，派发网格责任人，完成整改后返回巡查复查关闭。

### 3C. Copilot 五场景（可绑定中枢信号）

1. 选择场景 A/B/C/D/E；或切换「中枢信号」绑定监测/核实台已有事件（不再新建旁路信号）；
2. 运行后按场景完成核实/工单人工确认；派发成功会跳转班组终端。
3. 场景 D 会列出缺失字段并拒答；场景 E 只提供气体灭火延时咨询，不生成控制类工单。

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
FIREGUARD_TEST_DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard_test \
  PYTHONPATH=. .venv/bin/python -m unittest discover -s tests
# 项目根目录
SMOKE_APP_ROOT="http://127.0.0.1:4173/" node scripts/smoke_test.cjs
node scripts/copilot_e2e.cjs       # 五场景 E2E（需后端运行中）
node scripts/crosspage_flow_e2e.cjs  # 火警首报、维修完工、巡查整改与复查闭环
node scripts/mobile_e2e.cjs          # 390×844 八页面与触控尺寸
node scripts/monitoring_3d_e2e.cjs   # 3D 就绪、点位交互与二维降级
```

重复 E2E 前运行上面的官方 reset；无需手写 SQL。

## 8. 注意事项

- 全部数据为合成演示数据；不控制真实设备、不自动启动灭火装置；对外报警（119）由人工执行；
- 接口无身份认证，仅供本地演示与评审复现；
- SSE 广播为单进程内存实现，多 worker 部署需改为 PostgreSQL LISTEN/NOTIFY；
- 本地演示数据库固定使用 54330；测试库与演示库必须分开重置。

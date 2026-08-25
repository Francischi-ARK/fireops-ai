# FireGuard AI Demo API

当前后端覆盖重点单位监测和合成警情闭环：PostgreSQL 持久化设备信号、人工核实、警情、调派、站端状态、首报和时间线，FastAPI 提供接口，SSE 推送变更。

## 启动

```bash
cd backend
docker compose up -d --wait postgres
uv sync
DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54329/fireguard \
  uv run uvicorn fireguard_backend.app:app --host 127.0.0.1 --port 8000
```

需要清空累计的合成事件并恢复初始演示数据时，执行 `docker compose down -v` 后重新启动。

后端地址为 `http://127.0.0.1:8000`。在项目根目录执行 `python3 -m http.server 4173`，打开 `http://127.0.0.1:4173/#/incidents` 查看总队端，打开 `http://127.0.0.1:4173/#/station` 查看救援站端。

Copilot 默认使用可复现的场景模板。需要记录真实模型运行时，在 `backend/.env` 配置 `COPILOT_MODEL_BASE_URL`、`COPILOT_MODEL_NAME` 和 `COPILOT_MODEL_API_KEY`，然后在页面选择“Live 模型”。模型不可用时系统会安全回退，并在运行结果中保留 `model_name` 与 `fallback_reason`；密钥只放在后端环境变量中，不提交到仓库或前端。

## 验证

```bash
createdb -h 127.0.0.1 -p 54329 -U fireguard fireguard_test
FIREGUARD_TEST_DATABASE_URL=postgresql://fireguard:fireguard-demo@127.0.0.1:54329/fireguard_test \
  PYTHONPATH=. uv run python -m unittest discover -s tests
```

## 当前边界

- SSE 广播器是单进程内存实现；部署多 worker 时改为 PostgreSQL `LISTEN/NOTIFY`。
- 当前没有身份认证，接口只用于本地演示。
- 设备事件为合成数据，不连接真实 119、物联网设备或调派系统。
- “设备火警信号”必须经过人工确认才会生成“警情”；两者不能直接等同。

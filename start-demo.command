#!/bin/bash
# FireGuard Copilot 一键演示启动（macOS 双击运行）
# 依次拉起：Postgres 容器 → 后端 8000 → 前端 4173 → 打开浏览器
cd "$(dirname "$0")"
docker start fireguard-postgres >/dev/null 2>&1
(cd backend && uv run uvicorn fireguard_backend.app:app --host 127.0.0.1 --port 8000 >/dev/null 2>&1 &)
(python3 -m http.server 4173 >/dev/null 2>&1 &)
sleep 5
open "http://127.0.0.1:4173/#/monitoring"

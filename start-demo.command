#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
API_URL="http://127.0.0.1:8000"
WEB_URL="http://127.0.0.1:4173"
DATABASE_URL="postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard"
CHECK_ONLY="${1:-}"

fail() {
  echo "FireOps 启动失败：$1" >&2
  exit 1
}

wait_url() {
  local url="$1"
  local label="$2"
  for _ in {1..45}; do
    if curl -fsS "$url" >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  fail "$label 未就绪；查看 /tmp/fireops-*.log"
}

compose() {
  if docker compose version >/dev/null 2>&1; then
    docker compose -f "$ROOT/backend/docker-compose.yml" "$@"
  elif command -v docker-compose >/dev/null 2>&1; then
    docker-compose -f "$ROOT/backend/docker-compose.yml" "$@"
  else
    fail "未找到 docker compose 或 docker-compose"
  fi
}

command -v curl >/dev/null 2>&1 || fail "未安装 curl"
command -v docker >/dev/null 2>&1 || fail "未安装 Docker"
docker info >/dev/null 2>&1 || fail "Docker Desktop 未启动"

if [ "$CHECK_ONLY" = "--check-only" ]; then
  wait_url "$API_URL/health" "API"
  wait_url "$WEB_URL/index.html" "前端"
  echo "FireOps 服务已就绪：$WEB_URL/#/monitoring"
  exit 0
fi

compose up -d
for _ in {1..45}; do
  if [ "$(docker inspect --format '{{.State.Health.Status}}' fireops-postgres 2>/dev/null || true)" = "healthy" ]; then
    break
  fi
  sleep 1
done
[ "$(docker inspect --format '{{.State.Health.Status}}' fireops-postgres 2>/dev/null || true)" = "healthy" ] \
  || fail "PostgreSQL 容器未通过健康检查"

if [ ! -x "$ROOT/backend/.venv/bin/uvicorn" ]; then
  command -v uv >/dev/null 2>&1 || fail "未找到 uv，无法安装后端依赖"
  (cd "$ROOT/backend" && uv sync)
fi

if ! curl -fsS "$API_URL/health" >/dev/null 2>&1; then
  (
    cd "$ROOT/backend"
    nohup env DATABASE_URL="$DATABASE_URL" PYTHONPATH=. \
      .venv/bin/uvicorn fireguard_backend.app:app --host 127.0.0.1 --port 8000 \
      >/tmp/fireops-api.log 2>&1 &
  )
fi
wait_url "$API_URL/health" "API"

if ! curl -fsS "$WEB_URL/index.html" >/dev/null 2>&1; then
  (
    cd "$ROOT"
    nohup python3 -m http.server 4173 --bind 127.0.0.1 \
      >/tmp/fireops-web.log 2>&1 &
  )
fi
wait_url "$WEB_URL/index.html" "前端"

if [ "${FIREOPS_NO_OPEN:-0}" != "1" ]; then
  if command -v open >/dev/null 2>&1; then
    open "$WEB_URL/#/monitoring"
  elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$WEB_URL/#/monitoring"
  fi
fi
echo "FireOps 服务已就绪：$WEB_URL/#/monitoring"

#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RESET="$ROOT/backend/tests/reset_demo_database.py"
PYTHON="$ROOT/backend/.venv/bin/python"
DSN="postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard"

curl -fsS http://127.0.0.1:8000/health >/dev/null
curl -fsS http://127.0.0.1:4173/index.html >/dev/null

reset_demo() {
  FIREGUARD_DATABASE_URL="$DSN" PYTHONPATH="$ROOT/backend" "$PYTHON" "$RESET" >/dev/null
}

cd "$ROOT"
node scripts/action_contract.test.cjs

for script in smoke_test.cjs copilot_e2e.cjs crosspage_flow_e2e.cjs mobile_e2e.cjs monitoring_3d_e2e.cjs; do
  reset_demo
  SMOKE_APP_ROOT="http://127.0.0.1:4173/" node "scripts/$script"
done

echo "e2e contracts: ok"

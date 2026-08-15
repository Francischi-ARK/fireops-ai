#!/bin/bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PYTHON="$ROOT/backend/.venv/bin/python"
DEMO_DSN="postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard"
TEST_DSN="postgresql://fireguard:fireguard-demo@127.0.0.1:54330/fireguard_test"

require_file() {
  if [ ! -f "$1" ]; then
    echo "$2"
    exit 1
  fi
}

require_file "$ROOT/backend/tests/reset_demo_database.py" "official demo reset script missing"
require_file "$ROOT/scripts/verify_government_backup.py" "government backup verifier missing"

"$PYTHON" "$ROOT/scripts/verify_government_backup.py"

test_count() {
  docker exec fireops-postgres psql -U fireguard -d fireguard_test -Atc "SELECT COUNT(*) FROM monitoring_events"
}

before_test_count="$(test_count)"
for _ in 1 2; do
  FIREGUARD_DATABASE_URL="$DEMO_DSN" PYTHONPATH="$ROOT/backend" "$PYTHON" "$ROOT/backend/tests/reset_demo_database.py"
done
after_test_count="$(test_count)"

if [ "$before_test_count" != "$after_test_count" ]; then
  echo "demo reset changed fireguard_test"
  exit 1
fi

if FIREGUARD_DATABASE_URL="$TEST_DSN" PYTHONPATH="$ROOT/backend" "$PYTHON" "$ROOT/backend/tests/reset_demo_database.py" >/dev/null 2>&1; then
  echo "demo reset accepted fireguard_test"
  exit 1
fi

(
  cd /tmp
  FIREOPS_NO_OPEN=1 "$ROOT/start-demo.command" --check-only
)

curl -fsS http://127.0.0.1:8000/health >/dev/null
curl -fsS http://127.0.0.1:4173/index.html >/dev/null
echo "runtime contracts: ok"

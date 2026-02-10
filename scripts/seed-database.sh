#!/bin/bash
# Seed database with Purdue zones (required for Zone Overview dashboard).
# Optionally load full test data for all 5 dashboards.
# Run after migrations. For Docker: use DB_HOST=localhost or run from host with psql.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
SEEDS_DIR="$PROJECT_ROOT/database/seeds"

if [ -f "$PROJECT_ROOT/.env" ]; then
  export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-scada_topology}"
DB_USER="${DB_USER:-scada_admin}"

echo "=========================================="
echo "SCADA Topology - Seed Database"
echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "=========================================="

run_sql() {
  PGPASSWORD="${DB_PASSWORD:-scada_password}" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$1" || {
    echo "Error running: $1"
    exit 1
  }
}

echo "Running Purdue zones seed (security_zones, firewall_rules)..."
run_sql "$SEEDS_DIR/purdue-zones.sql"
echo "Purdue zones seed complete."

if [ "${1:-}" = "--test-data" ]; then
  echo "Running Phase 2 test data (devices, connections, alerts, risk_assessments)..."
  run_sql "$PROJECT_ROOT/scripts/phase2-test-data.sql"
  echo "Test data seed complete."
fi

echo "Done. For Grafana: set dashboard time range to 'Last 7 days' (or include your data range)."

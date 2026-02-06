#!/bin/bash
# Run database migrations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
MIGRATIONS_DIR="$PROJECT_ROOT/database/migrations"
SEEDS_DIR="$PROJECT_ROOT/database/seeds"

# Load environment variables
if [ -f "$PROJECT_ROOT/.env" ]; then
  export $(grep -v '^#' "$PROJECT_ROOT/.env" | xargs)
fi

DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-scada_topology}"
DB_USER="${DB_USER:-scada_admin}"

echo "=========================================="
echo "SCADA Topology Discovery - Migrations"
echo "Database: $DB_HOST:$DB_PORT/$DB_NAME"
echo "=========================================="

# Check PostgreSQL connection
echo "Testing database connection..."
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" > /dev/null 2>&1 || {
  echo "Error: Cannot connect to database"
  exit 1
}

# Run migrations in order
echo "Running migrations..."
for migration in $(ls "$MIGRATIONS_DIR"/*.sql | sort); do
  filename=$(basename "$migration")
  echo "  Applying: $filename"
  PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$migration" || {
    echo "Error applying migration: $filename"
    exit 1
  }
done

# Run seeds if requested
if [ "${1:-}" = "--seed" ]; then
  echo "Running seeds..."
  for seed in $(ls "$SEEDS_DIR"/*.sql 2>/dev/null | sort); do
    filename=$(basename "$seed")
    echo "  Seeding: $filename"
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "$seed"
  done
fi

echo "Migrations complete!"

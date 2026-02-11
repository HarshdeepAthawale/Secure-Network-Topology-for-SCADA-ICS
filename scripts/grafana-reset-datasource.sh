#!/bin/bash
# Reset Grafana so it loads only the provisioned PostgreSQL datasource (correct config).
# Use this if the UI shows wrong datasource (e.g. PostgreSQL-1 with localhost / SSL errors).
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
COMPOSE_FILE="$PROJECT_ROOT/grafana/docker-compose.yml"
cd "$PROJECT_ROOT"

echo "Stopping Grafana..."
docker compose -f "$COMPOSE_FILE" stop grafana 2>/dev/null || true

echo "Removing Grafana container and volume (clears UI-edited datasources)..."
docker compose -f "$COMPOSE_FILE" rm -f grafana 2>/dev/null || true
VOLUME_NAME=$(docker volume ls -q --filter name=grafana-data | head -1)
if [ -n "$VOLUME_NAME" ]; then
  docker volume rm "$VOLUME_NAME" 2>/dev/null || true
  echo "Removed volume: $VOLUME_NAME"
fi

echo "Starting Grafana (will load postgres.yaml: postgres:5432, scada_topology, ssl=disable)..."
docker compose -f "$COMPOSE_FILE" up -d grafana

echo "Waiting for Grafana to be ready..."
sleep 8
echo "Done. Open http://localhost:3000 → Connections → Data sources → PostgreSQL → Save & test"
echo "Dashboards: http://localhost:3000/d/scada-realtime-topology/real-time-topology-dashboard"

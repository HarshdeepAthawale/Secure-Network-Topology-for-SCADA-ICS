#!/bin/bash
# Run this script ON the EC2 MQTT ingest instance (e.g. via SSM Session Manager or bastion).
# Checks scada-mqtt-ingest service and RDS row counts using instance IAM role.
# Usage: sudo ./verify-ec2-from-instance.sh [NAME_PREFIX] (default: scada-prod)

set -e

REGION="${AWS_REGION:-ap-south-1}"
PREFIX="${1:-scada-prod}"

echo "=========================================="
echo "On-instance verification: $PREFIX (region $REGION)"
echo "=========================================="

echo ""
echo "1. Service: scada-mqtt-ingest"
systemctl status scada-mqtt-ingest --no-pager || true

echo ""
echo "2. Recent logs (last 100 lines)"
journalctl -u scada-mqtt-ingest -n 100 --no-pager || true

echo ""
echo "3. RDS row counts (from this instance)"
SECRET_STR=$(aws secretsmanager get-secret-value \
  --secret-id "${PREFIX}/database/credentials" \
  --region "$REGION" \
  --query SecretString \
  --output text 2>/dev/null) || true
if [ -z "$SECRET_STR" ]; then
  echo "   (could not get DB secret)"
  exit 0
fi
DB_HOST=$(echo "$SECRET_STR" | jq -r '.host')
DB_USER=$(echo "$SECRET_STR" | jq -r '.username')
DB_NAME=$(echo "$SECRET_STR" | jq -r '.database')
DB_PASS=$(echo "$SECRET_STR" | jq -r '.password')
echo "   Host: $DB_HOST"

if ! command -v psql &>/dev/null; then
  echo "   Installing postgresql15 for psql..."
  yum install -y postgresql15 2>/dev/null || true
fi
if command -v psql &>/dev/null; then
  export PGPASSWORD="$DB_PASS"
  for table in devices connections telemetry alerts; do
    COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT COUNT(*) FROM $table" 2>/dev/null) || COUNT="?"
    echo "   $table: $COUNT rows"
  done
  echo "   Latest telemetry:"
  psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT timestamp, source FROM telemetry ORDER BY timestamp DESC LIMIT 3" 2>/dev/null || echo "   (query failed)"
  unset PGPASSWORD
else
  echo "   (psql not available; install with: yum install -y postgresql15)"
fi

echo ""
echo "=========================================="

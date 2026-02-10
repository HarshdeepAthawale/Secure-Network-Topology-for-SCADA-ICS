#!/bin/bash
# Verify full AWS data pipeline: Lambda -> IoT Core -> EC2 -> RDS
# Usage: AWS_REGION=ap-south-1 NAME_PREFIX=scada-dev ./scripts/verify-pipeline.sh
# Requires: aws cli, jq; for RDS checks: psql and DB credentials from Secrets Manager

set -e

REGION="${AWS_REGION:-ap-south-1}"
PREFIX="${NAME_PREFIX:-scada-dev}"

echo "=========================================="
echo "Pipeline verification: $PREFIX (region $REGION)"
echo "=========================================="

# 1. Lambda generator
echo ""
echo "1. Lambda generator (last 5 min)"
aws logs filter-log-events \
  --log-group-name "/aws/lambda/${PREFIX}-generator" \
  --start-time $(($(date +%s) - 300))000 \
  --region "$REGION" \
  --query 'events[*].message' \
  --output text 2>/dev/null | tail -5 || echo "  (no logs or log group missing)"

# 2. EC2 service (if instance exists)
INSTANCE_ID=$(aws ec2 describe-instances \
  --region "$REGION" \
  --filters "Name=tag:Name,Values=${PREFIX}-mqtt-ingest" "Name=instance-state-name,Values=running" \
  --query 'Reservations[*].Instances[*].InstanceId' \
  --output text 2>/dev/null | head -1)
if [ -n "$INSTANCE_ID" ]; then
  echo ""
  echo "2. EC2 instance: $INSTANCE_ID"
  echo "   Check service on instance: systemctl status scada-mqtt-ingest"
  echo "   Logs: journalctl -u scada-mqtt-ingest -n 50"
else
  echo ""
  echo "2. EC2 instance: (none running with name ${PREFIX}-mqtt-ingest)"
fi

# 3. RDS row counts (if credentials available)
echo ""
echo "3. RDS data (requires DB credentials)"
SECRET_STR=$(aws secretsmanager get-secret-value \
  --secret-id "${PREFIX}/database/credentials" \
  --region "$REGION" \
  --query SecretString \
  --output text 2>/dev/null) || true
if [ -n "$SECRET_STR" ]; then
  DB_HOST=$(echo "$SECRET_STR" | jq -r '.host')
  DB_USER=$(echo "$SECRET_STR" | jq -r '.username')
  DB_NAME=$(echo "$SECRET_STR" | jq -r '.database')
  DB_PASS=$(echo "$SECRET_STR" | jq -r '.password')
  export PGPASSWORD="$DB_PASS"
  echo "   Host: $DB_HOST"
  for table in devices connections telemetry alerts; do
    COUNT=$(psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -A -c "SELECT COUNT(*) FROM $table" 2>/dev/null) || COUNT="?"
    echo "   $table: $COUNT rows"
  done
  echo "   Latest telemetry:"
  psql -h "$DB_HOST" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT timestamp, source FROM telemetry ORDER BY timestamp DESC LIMIT 3" 2>/dev/null || echo "   (query failed)"
  unset PGPASSWORD
else
  echo "   (could not get DB secret; run with AWS credentials that have secretsmanager:GetSecretValue)"
fi

echo ""
echo "=========================================="
echo "If Lambda logs show publishes and RDS row counts increase over time, pipeline is working."
echo "=========================================="

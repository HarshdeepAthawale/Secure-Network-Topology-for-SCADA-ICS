#!/bin/bash

#############################################################################
# SCADA Topology Discovery - Health Check Script
#
# Purpose: Monitor critical system components and report health status
# Usage:   ./scripts/health-check.sh
#          export JSON_OUTPUT=1 && ./scripts/health-check.sh
#
# Exit codes:
#   0 = All healthy
#   1 = One or more components degraded
#   2 = One or more components failed
#############################################################################

set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Initialize tracking
TOTAL_CHECKS=0
FAILED_CHECKS=0
DEGRADED_CHECKS=0
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
HEALTH_STATUS="ok"

# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Default values
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-scada_topology}"
DB_USER="${DB_USER:-postgres}"
AWS_REGION="${AWS_REGION:-us-east-1}"
API_ENDPOINT="${API_ENDPOINT:-http://localhost:3000}"
WS_ENDPOINT="${WS_ENDPOINT:-ws://localhost:3001}"
VERBOSE="${VERBOSE:-0}"

# Helper function to print status
check_status() {
  local check_name="$1"
  local status="$2"
  local message="$3"

  ((TOTAL_CHECKS++))

  case $status in
    ok)
      echo -e "${GREEN}✓${NC} $check_name: $message"
      ;;
    warning)
      echo -e "${YELLOW}⚠${NC} $check_name: $message"
      ((DEGRADED_CHECKS++))
      [ "$HEALTH_STATUS" = "ok" ] && HEALTH_STATUS="degraded"
      ;;
    error)
      echo -e "${RED}✗${NC} $check_name: $message"
      ((FAILED_CHECKS++))
      HEALTH_STATUS="failed"
      ;;
  esac
}

# Check database connectivity
check_database() {
  echo -e "\n${BLUE}Checking Database...${NC}"

  if ! command -v psql &> /dev/null; then
    check_status "Database" "error" "psql not installed"
    return
  fi

  if PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1" &>/dev/null 2>&1; then
    # Check database size
    db_size=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT pg_size_pretty(pg_database_size(current_database()))" -t 2>/dev/null | xargs)
    check_status "Database" "ok" "Connected (Size: $db_size)"

    # Check active connections
    active_conns=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '$DB_NAME'" -t 2>/dev/null | xargs)
    if [ "$active_conns" -gt 50 ]; then
      check_status "Database Connections" "warning" "$active_conns active connections (threshold: 50)"
    else
      check_status "Database Connections" "ok" "$active_conns active connections"
    fi
  else
    check_status "Database" "error" "Connection failed"
  fi
}

# Check Lambda functions
check_lambda() {
  echo -e "\n${BLUE}Checking Lambda Functions...${NC}"

  if ! command -v aws &> /dev/null; then
    check_status "Lambda" "warning" "aws CLI not installed"
    return
  fi

  if aws lambda list-functions --region "$AWS_REGION" --output text --query 'Functions[].FunctionName' 2>/dev/null | grep -q "ingest\|process\|query\|export"; then
    functions=$(aws lambda list-functions --region "$AWS_REGION" --output text --query 'Functions[].FunctionName' 2>/dev/null)
    check_status "Lambda Functions" "ok" "Found Lambda functions"

    # Check function errors in CloudWatch
    for func in $functions; do
      errors=$(aws cloudwatch get-metric-statistics \
        --namespace AWS/Lambda \
        --metric-name Errors \
        --dimensions Name=FunctionName,Value="$func" \
        --statistics Sum \
        --start-time "$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S)" \
        --end-time "$(date -u +%Y-%m-%dT%H:%M:%S)" \
        --period 3600 \
        --region "$AWS_REGION" \
        --output text \
        --query 'Datapoints[0].Sum' 2>/dev/null | grep -oE '[0-9]+' | head -1)

      if [ -n "$errors" ] && [ "$errors" -gt 0 ]; then
        check_status "Lambda $func" "warning" "$errors errors in last hour"
      fi
    done
  else
    check_status "Lambda Functions" "error" "No Lambda functions found"
  fi
}

# Check API Gateway
check_api_gateway() {
  echo -e "\n${BLUE}Checking API Gateway...${NC}"

  if curl -s -f -m 5 "$API_ENDPOINT/health" >/dev/null 2>&1; then
    response=$(curl -s -m 5 "$API_ENDPOINT/health")
    check_status "API Gateway" "ok" "Responding to health checks"
  else
    check_status "API Gateway" "error" "Not responding (Endpoint: $API_ENDPOINT)"
  fi
}

# Check WebSocket server
check_websocket() {
  echo -e "\n${BLUE}Checking WebSocket Server...${NC}"

  # Try to connect with timeout
  if timeout 5 bash -c "exec 3<>/dev/tcp/${WS_ENDPOINT#ws*://} && echo 'GET / HTTP/1.1' >&3" 2>/dev/null; then
    check_status "WebSocket" "ok" "Server accessible (Endpoint: $WS_ENDPOINT)"
  else
    check_status "WebSocket" "error" "Not accessible (Endpoint: $WS_ENDPOINT)"
  fi
}

# Check CloudWatch alarms
check_cloudwatch() {
  echo -e "\n${BLUE}Checking CloudWatch...${NC}"

  if ! command -v aws &> /dev/null; then
    check_status "CloudWatch" "warning" "aws CLI not installed"
    return
  fi

  # Count alarms in different states
  alarm_count=$(aws cloudwatch describe-alarms \
    --state-value ALARM \
    --region "$AWS_REGION" \
    --query 'MetricAlarms[].AlarmName' \
    --output text 2>/dev/null | wc -w)

  insufficient_count=$(aws cloudwatch describe-alarms \
    --state-value INSUFFICIENT_DATA \
    --region "$AWS_REGION" \
    --query 'MetricAlarms[].AlarmName' \
    --output text 2>/dev/null | wc -w)

  if [ "$alarm_count" -gt 0 ]; then
    check_status "CloudWatch Alarms" "warning" "$alarm_count active alarms"
  else
    check_status "CloudWatch Alarms" "ok" "No active alarms"
  fi

  if [ "$insufficient_count" -gt 0 ]; then
    check_status "CloudWatch Data" "warning" "$insufficient_count alarms with insufficient data"
  fi
}

# Check RDS instance
check_rds() {
  echo -e "\n${BLUE}Checking RDS Instance...${NC}"

  if ! command -v aws &> /dev/null; then
    check_status "RDS" "warning" "aws CLI not installed"
    return
  fi

  db_instance=$(aws rds describe-db-instances --region "$AWS_REGION" --query 'DBInstances[0].DBInstanceIdentifier' --output text 2>/dev/null)

  if [ -n "$db_instance" ] && [ "$db_instance" != "None" ]; then
    status=$(aws rds describe-db-instances --db-instance-identifier "$db_instance" --region "$AWS_REGION" --query 'DBInstances[0].DBInstanceStatus' --output text 2>/dev/null)

    if [ "$status" = "available" ]; then
      check_status "RDS" "ok" "Instance $db_instance is available"
    else
      check_status "RDS" "warning" "Instance $db_instance status: $status"
    fi
  else
    check_status "RDS" "error" "No RDS instances found"
  fi
}

# Check S3 buckets
check_s3() {
  echo -e "\n${BLUE}Checking S3 Buckets...${NC}"

  if ! command -v aws &> /dev/null; then
    check_status "S3" "warning" "aws CLI not installed"
    return
  fi

  buckets=$(aws s3 ls --region "$AWS_REGION" 2>/dev/null | grep -c "^20")

  if [ "$buckets" -gt 0 ]; then
    check_status "S3 Buckets" "ok" "Found $buckets S3 buckets"
  else
    check_status "S3 Buckets" "warning" "No S3 buckets found"
  fi
}

# Check system resources
check_system_resources() {
  echo -e "\n${BLUE}Checking System Resources...${NC}"

  # Check disk space
  disk_usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
  if [ "$disk_usage" -gt 80 ]; then
    check_status "Disk Space" "warning" "${disk_usage}% used"
  else
    check_status "Disk Space" "ok" "${disk_usage}% used"
  fi

  # Check memory
  if command -v free &> /dev/null; then
    mem_usage=$(free | awk 'NR==2 {printf "%.0f", $3*100/$2}')
    if [ "$mem_usage" -gt 80 ]; then
      check_status "Memory" "warning" "${mem_usage}% used"
    else
      check_status "Memory" "ok" "${mem_usage}% used"
    fi
  fi
}

# Print summary
print_summary() {
  echo -e "\n${BLUE}========================================${NC}"
  echo -e "${BLUE}Health Check Summary${NC}"
  echo -e "${BLUE}========================================${NC}"
  echo "Timestamp: $TIMESTAMP"
  echo "Total Checks: $TOTAL_CHECKS"
  echo -e "Passed: ${GREEN}$((TOTAL_CHECKS - FAILED_CHECKS - DEGRADED_CHECKS))${NC}"

  if [ "$DEGRADED_CHECKS" -gt 0 ]; then
    echo -e "Degraded: ${YELLOW}$DEGRADED_CHECKS${NC}"
  fi

  if [ "$FAILED_CHECKS" -gt 0 ]; then
    echo -e "Failed: ${RED}$FAILED_CHECKS${NC}"
  fi

  echo -e "Status: $(
    case $HEALTH_STATUS in
      ok) echo -e "${GREEN}OK${NC}" ;;
      degraded) echo -e "${YELLOW}DEGRADED${NC}" ;;
      failed) echo -e "${RED}FAILED${NC}" ;;
    esac
  )"
  echo -e "${BLUE}========================================${NC}\n"
}

# Output JSON if requested
output_json() {
  cat <<EOF
{
  "status": "$HEALTH_STATUS",
  "timestamp": "$TIMESTAMP",
  "total_checks": $TOTAL_CHECKS,
  "passed": $((TOTAL_CHECKS - FAILED_CHECKS - DEGRADED_CHECKS)),
  "degraded": $DEGRADED_CHECKS,
  "failed": $FAILED_CHECKS
}
EOF
}

# Main execution
main() {
  echo -e "${BLUE}SCADA Topology Discovery - Health Check${NC}"
  echo -e "${BLUE}Started: $TIMESTAMP${NC}\n"

  check_database
  check_lambda
  check_api_gateway
  check_websocket
  check_cloudwatch
  check_rds
  check_s3
  check_system_resources

  print_summary

  if [ "${JSON_OUTPUT:-0}" = "1" ]; then
    output_json
  fi

  # Exit with appropriate code
  if [ "$FAILED_CHECKS" -gt 0 ]; then
    exit 2
  elif [ "$DEGRADED_CHECKS" -gt 0 ]; then
    exit 1
  else
    exit 0
  fi
}

main "$@"

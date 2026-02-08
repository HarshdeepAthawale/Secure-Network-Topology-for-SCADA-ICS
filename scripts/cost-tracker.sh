#!/bin/bash

#############################################################################
# SCADA Topology Discovery - AWS Cost Tracking Script
#
# Purpose: Track and report AWS costs, analyze by service, alert on budget
# Usage:   ./scripts/cost-tracker.sh
#          BUDGET_LIMIT=2000 ./scripts/cost-tracker.sh
#          DAYS=7 ./scripts/cost-tracker.sh        # Last 7 days
#
# Dependencies: aws-cli, bc, jq (optional)
#############################################################################

set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
DAYS="${DAYS:-30}"
BUDGET_LIMIT="${BUDGET_LIMIT:-1000}"
CURRENCY="${CURRENCY:-USD}"
OUTPUT_DIR="${OUTPUT_DIR:-./cost-reports}"

# Timestamp
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DATE_START=$(date -u -d "$DAYS days ago" +%Y-%m-%d)
DATE_END=$(date -u +%Y-%m-%d)

# Validation
if ! command -v aws &> /dev/null; then
  echo -e "${RED}Error: aws-cli is not installed${NC}"
  exit 1
fi

if ! command -v bc &> /dev/null; then
  echo -e "${RED}Error: bc is not installed${NC}"
  exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo -e "${BLUE}AWS Cost Tracking Report${NC}"
echo -e "${BLUE}Period: $DATE_START to $DATE_END ($DAYS days)${NC}"
echo -e "${BLUE}Region: $AWS_REGION${NC}"
echo ""

# Fetch total costs
echo -e "${BLUE}Fetching AWS costs...${NC}"

total_cost=$(aws ce get-cost-and-usage \
  --time-period "Start=$DATE_START,End=$DATE_END" \
  --granularity DAILY \
  --metrics "BlendedCost" \
  --region "$AWS_REGION" \
  --query 'ResultsByTime[].Total.BlendedCost.Amount' \
  --output text 2>/dev/null | awk '{s+=$1} END {printf "%.2f", s}')

if [ -z "$total_cost" ]; then
  echo -e "${RED}Error: Could not fetch cost data${NC}"
  exit 1
fi

echo -e "${GREEN}✓${NC} Total Cost (${DAYS} days): ${CURRENCY} $total_cost"

# Check budget threshold
budget_exceeded=0
budget_percentage=$(echo "scale=2; ($total_cost / $BUDGET_LIMIT) * 100" | bc)

echo -e "${BLUE}Budget Analysis${NC}"
echo "  Budget Limit: ${CURRENCY} $BUDGET_LIMIT"
echo "  Current Spend: ${CURRENCY} $total_cost"
echo -e "  Usage: ${budget_percentage}%"

if (( $(echo "$total_cost > $BUDGET_LIMIT" | bc -l) )); then
  echo -e "  ${RED}⚠ WARNING: Budget exceeded!${NC}"
  budget_exceeded=1
else
  remaining=$(echo "scale=2; $BUDGET_LIMIT - $total_cost" | bc)
  echo -e "  ${GREEN}✓ Remaining: ${CURRENCY} $remaining${NC}"
fi

# Cost breakdown by service
echo -e "\n${BLUE}Cost Breakdown by Service${NC}"
echo "=================================================="

aws ce get-cost-and-usage \
  --time-period "Start=$DATE_START,End=$DATE_END" \
  --granularity DAILY \
  --metrics "BlendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --region "$AWS_REGION" \
  --query 'ResultsByTime[].Groups[*].[Keys[0],Metrics.BlendedCost.Amount]' \
  --output text 2>/dev/null | \
  awk '{
    service=$1
    cost=$2
    total+=cost
    services[service]+=cost
  }
  END {
    for (svc in services) {
      printf "%-30s: $ %8.2f (%5.1f%%)\n", svc, services[svc], (services[svc]/total)*100
    }
    print "--------------------------------------------------"
    printf "%-30s: $ %8.2f\n", "TOTAL", total
  }' | sort -t: -k2 -rn

# Cost breakdown by linked account
echo -e "\n${BLUE}Cost Breakdown by Linked Account${NC}"
echo "=================================================="

aws ce get-cost-and-usage \
  --time-period "Start=$DATE_START,End=$DATE_END" \
  --granularity DAILY \
  --metrics "BlendedCost" \
  --group-by Type=DIMENSION,Key=LINKED_ACCOUNT \
  --region "$AWS_REGION" \
  --query 'ResultsByTime[].Groups[*].[Keys[0],Metrics.BlendedCost.Amount]' \
  --output text 2>/dev/null | \
  awk '{
    account=$1
    cost=$2
    accounts[account]+=cost
  }
  END {
    for (acc in accounts) {
      printf "%-20s: $ %10.2f\n", acc, accounts[acc]
    }
  }' | sort -t: -k2 -rn

# Daily cost trend
echo -e "\n${BLUE}Daily Cost Trend${NC}"
echo "=================================================="

aws ce get-cost-and-usage \
  --time-period "Start=$DATE_START,End=$DATE_END" \
  --granularity DAILY \
  --metrics "BlendedCost" \
  --region "$AWS_REGION" \
  --query 'ResultsByTime[*].[TimePeriod.Start,Total.BlendedCost.Amount]' \
  --output text 2>/dev/null | awk '
  {
    date=$1
    cost=$2
    printf "%s: $ %8.2f\n", date, cost
  }' | sort

# Top services by cost
echo -e "\n${BLUE}Top 10 Most Expensive Services${NC}"
echo "=================================================="

aws ce get-cost-and-usage \
  --time-period "Start=$DATE_START,End=$DATE_END" \
  --granularity DAILY \
  --metrics "BlendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --region "$AWS_REGION" \
  --query 'sort_by(ResultsByTime[].Groups[], &Metrics.BlendedCost.Amount) | [-10:].[Keys[0],Metrics.BlendedCost.Amount]' \
  --output text 2>/dev/null | awk '
  {
    service=$1
    cost=$2
    printf "  %2d. %-40s $ %10.2f\n", ++count, service, cost
  }' | tac

# Generate CSV report
echo -e "\n${BLUE}Generating CSV Report...${NC}"

csv_file="$OUTPUT_DIR/cost-report-$(date +%Y%m%d-%H%M%S).csv"

{
  echo "Date,Service,Cost,Percentage"
  aws ce get-cost-and-usage \
    --time-period "Start=$DATE_START,End=$DATE_END" \
    --granularity DAILY \
    --metrics "BlendedCost" \
    --group-by Type=DIMENSION,Key=SERVICE \
    --region "$AWS_REGION" \
    --query 'ResultsByTime[].[TimePeriod.Start,Groups[].Keys[0],Groups[].Metrics.BlendedCost.Amount]' \
    --output text 2>/dev/null | awk '{
      date=$1
      service=$2
      cost=$3
      printf "%s,%s,%.2f\n", date, service, cost
    }'
} > "$csv_file"

echo -e "${GREEN}✓${NC} Report saved to: $csv_file"

# Alert via SNS if budget exceeded
if [ "$budget_exceeded" = "1" ] && [ -n "$ALERT_TOPIC_ARN" ]; then
  echo -e "\n${YELLOW}Sending budget alert...${NC}"

  alert_message="AWS Cost Alert

Current Spend: ${CURRENCY} $total_cost
Budget Limit: ${CURRENCY} $BUDGET_LIMIT
Overage: ${CURRENCY} $(echo "scale=2; $total_cost - $BUDGET_LIMIT" | bc)

Period: $DATE_START to $DATE_END
Region: $AWS_REGION

Please review your AWS costs and usage.
Top services:
$(aws ce get-cost-and-usage \
  --time-period "Start=$DATE_START,End=$DATE_END" \
  --granularity DAILY \
  --metrics "BlendedCost" \
  --group-by Type=DIMENSION,Key=SERVICE \
  --region "$AWS_REGION" \
  --query 'sort_by(ResultsByTime[].Groups[], &Metrics.BlendedCost.Amount) | [-5:].[Keys[0],Metrics.BlendedCost.Amount]' \
  --output text 2>/dev/null | awk '{printf "  - %s: \$%.2f\n", $1, $2}' | tac)"

  aws sns publish \
    --topic-arn "$ALERT_TOPIC_ARN" \
    --subject "AWS Cost Alert: Budget Exceeded" \
    --message "$alert_message" \
    --region "$AWS_REGION" 2>/dev/null

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC} Alert sent to SNS topic"
  else
    echo -e "${RED}✗${NC} Failed to send alert"
  fi
fi

# Reserved Instance Analysis
echo -e "\n${BLUE}Reserved Instance Savings Potential${NC}"
echo "=================================================="

# This requires AWS Cost Explorer API with GetRightsizingRecommendations
# For now, we'll just indicate where to check
echo "Check AWS Cost Explorer console for RI recommendations"
echo "or use: aws ce get-rightsizing-recommendation"

# Summary JSON output
summary_json="$OUTPUT_DIR/cost-summary-$(date +%Y%m%d-%H%M%S).json"

cat > "$summary_json" << EOF
{
  "timestamp": "$TIMESTAMP",
  "period": {
    "start": "$DATE_START",
    "end": "$DATE_END",
    "days": $DAYS
  },
  "costs": {
    "total": "$total_cost",
    "currency": "$CURRENCY"
  },
  "budget": {
    "limit": $BUDGET_LIMIT,
    "exceeded": $budget_exceeded,
    "usage_percentage": $budget_percentage,
    "remaining": $(echo "scale=2; $BUDGET_LIMIT - $total_cost" | bc)
  },
  "region": "$AWS_REGION"
}
EOF

echo -e "${GREEN}✓${NC} Summary saved to: $summary_json"

echo -e "\n${BLUE}Cost tracking completed successfully${NC}"

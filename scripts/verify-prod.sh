#!/bin/bash
# Production Deployment Verification Script
set -o pipefail
cd /home/harshdeep/Documents/Projects/Secure-Network-Topology-for-SCADA-ICS

REGION="ap-south-1"
PASS=0
FAIL=0

check() {
  local name="$1"
  shift
  echo ""
  echo "=== $name ==="
  if eval "$@" 2>&1; then
    PASS=$((PASS + 1))
  else
    echo "FAILED"
    FAIL=$((FAIL + 1))
  fi
}

# 1. Lambda Functions
check "Lambda: scada-prod-ingest" \
  "aws lambda get-function-configuration --function-name scada-prod-ingest --region $REGION --query '{FunctionName:FunctionName,State:State,Runtime:Runtime,MemorySize:MemorySize}' --output table"

check "Lambda: scada-prod-process" \
  "aws lambda get-function-configuration --function-name scada-prod-process --region $REGION --query '{FunctionName:FunctionName,State:State,Runtime:Runtime,MemorySize:MemorySize}' --output table"

check "Lambda: scada-prod-query" \
  "aws lambda get-function-configuration --function-name scada-prod-query --region $REGION --query '{FunctionName:FunctionName,State:State,Runtime:Runtime,MemorySize:MemorySize}' --output table"

# 2. RDS
check "RDS Instance" \
  "aws rds describe-db-instances --db-instance-identifier scada-prod-postgres --region $REGION --query 'DBInstances[0].{ID:DBInstanceIdentifier,Status:DBInstanceStatus,Engine:Engine,MultiAZ:MultiAZ,DeletionProtection:DeletionProtection,BackupRetention:BackupRetentionPeriod,Class:DBInstanceClass}' --output table"

# 3. API Gateway
check "API Gateway" \
  "aws apigatewayv2 get-api --api-id 2qnqkyqo3h --region $REGION --query '{Name:Name,ProtocolType:ProtocolType,Endpoint:ApiEndpoint}' --output table"

check "API Gateway HTTP Test" \
  "curl -s -o /dev/null -w 'HTTP Status: %{http_code}' https://2qnqkyqo3h.execute-api.ap-south-1.amazonaws.com/prod/"

# 4. CloudWatch Alarms
check "CloudWatch Alarms" \
  "aws cloudwatch describe-alarms --alarm-name-prefix scada-prod --region $REGION --query 'MetricAlarms[].{Alarm:AlarmName,State:StateValue}' --output table"

# 5. S3 Buckets
check "S3 Buckets" \
  "aws s3 ls | grep scada-prod"

# 6. IoT Thing
check "IoT Core Thing" \
  "aws iot describe-thing --thing-name scada-prod-collector --region $REGION --query '{ThingName:thingName,ThingArn:thingArn}' --output table"

# 7. VPC
check "VPC" \
  "aws ec2 describe-vpcs --vpc-ids vpc-0ea58f2f7286fb42f --region $REGION --query 'Vpcs[0].{VpcId:VpcId,State:State,CidrBlock:CidrBlock}' --output table"

# 8. Secrets Manager
check "Secrets Manager" \
  "aws secretsmanager describe-secret --secret-id scada-prod/database/credentials --region $REGION --query '{Name:Name,CreatedDate:CreatedDate}' --output table"

# 9. Terraform State
check "Terraform State" \
  "cd infrastructure && terraform workspace show && echo 'Resources in state:' && terraform state list | wc -l"

echo ""
echo "=========================================="
echo "VERIFICATION SUMMARY"
echo "=========================================="
echo "Passed: $PASS"
echo "Failed: $FAIL"
echo "Total:  $((PASS + FAIL))"
echo "=========================================="

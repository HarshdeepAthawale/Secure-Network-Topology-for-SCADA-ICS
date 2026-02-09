# Deployment Summary

## ✅ Successfully Deployed

### 1. Lambda Generator Function
- **Function Name**: `scada-dev-generator`
- **Status**: Active
- **Handler**: `lambda/generator/handler.handler`
- **Runtime**: Node.js 18.x
- **Schedule**: EventBridge rule `scada-dev-generator-schedule` (runs every 1 minute)
- **Environment Variables**:
  - `IOT_ENDPOINT`: a1r81dm4t7lp48-ats.iot.ap-south-1.amazonaws.com
  - `TELEMETRY_TOPIC`: scada/telemetry
  - `NODE_ENV`: production

### 2. EventBridge Rule
- **Rule Name**: `scada-dev-generator-schedule`
- **Schedule**: `rate(1 minute)`
- **Target**: scada-dev-generator Lambda function
- **Status**: Configured and active

### 3. IoT Core Configuration
- **IoT Endpoint**: a1r81dm4t7lp48-ats.iot.ap-south-1.amazonaws.com
- **EC2 IoT Thing**: `scada-dev-ec2-ingest` (created)
- **EC2 IoT Certificate**: Created and attached
- **EC2 IoT Policy**: `scada-dev-ec2-ingest-policy` (allows subscribe/receive)

## ⚠️ Pending/Issues

### 1. EC2 Instance
- **Status**: Not yet created
- **Issue**: Terraform apply blocked by RDS security group dependencies
- **Next Steps**: 
  - Manually create EC2 instance OR
  - Resolve Terraform state issues with RDS resources

### 2. Lambda Handler Path
- **Issue**: Handler path needs to be `lambda/generator/handler.handler` (without `dist/` prefix)
- **Status**: Fixed

## 📋 Next Steps

### Immediate Actions Required:

1. **Create EC2 Instance Manually** (if Terraform continues to have issues):
   ```bash
   # Use AWS Console or CLI to create EC2 instance with:
   # - AMI: Amazon Linux 2
   # - Instance Type: t3.small
   # - IAM Role: scada-dev-ec2-mqtt-ingest-profile
   # - Security Group: scada-dev-ec2-mqtt-ingest-sg
   # - User Data: From infrastructure/modules/ec2/user-data.sh
   ```

2. **Deploy Application Code to EC2**:
   ```bash
   # SSH into EC2 instance
   # Copy application code
   # Install dependencies
   # Start service: sudo systemctl start scada-mqtt-ingest
   ```

3. **Verify Lambda Generator**:
   ```bash
   # Check CloudWatch Logs
   aws logs get-log-events \
     --log-group-name /aws/lambda/scada-dev-generator \
     --log-stream-name <stream-name> \
     --region ap-south-1
   
   # Test manual invocation
   aws lambda invoke \
     --function-name scada-dev-generator \
     --payload '{}' \
     /tmp/response.json \
     --region ap-south-1
   ```

4. **Verify IoT Core Messages**:
   ```bash
   # Use AWS IoT Test client or MQTT client to subscribe to scada/telemetry
   # Should see messages every minute
   ```

## 🔍 Verification Commands

### Check Lambda Function
```bash
aws lambda get-function --function-name scada-dev-generator --region ap-south-1
```

### Check EventBridge Rule
```bash
aws events describe-rule --name scada-dev-generator-schedule --region ap-south-1
```

### Check IoT Core Thing
```bash
aws iot describe-thing --thing-name scada-dev-ec2-ingest --region ap-south-1
```

### Check EC2 Instance (once created)
```bash
aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=scada-dev-mqtt-ingest" \
  --region ap-south-1
```

## 📊 Current Architecture Status

```
✅ Lambda Generator → ✅ IoT Core MQTT → ⏳ EC2 Instance → ⏳ RDS → ⏳ Grafana
```

- ✅ Lambda Generator: Deployed and scheduled
- ✅ IoT Core: Configured with EC2 thing and certificates
- ⏳ EC2 Instance: Needs to be created
- ⏳ EC2 Service: Needs to be deployed and started
- ⏳ RDS: Exists but connection from EC2 needs verification
- ⏳ Grafana: Needs datasource configuration

## 🎯 Success Criteria

- [x] Lambda generator function created
- [x] EventBridge rule configured
- [x] IoT Core EC2 thing and certificate created
- [ ] EC2 instance created and running
- [ ] EC2 service deployed and receiving MQTT messages
- [ ] Data flowing from Lambda → IoT Core → EC2 → RDS
- [ ] Grafana dashboards showing data

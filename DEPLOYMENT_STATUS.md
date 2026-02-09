# Deployment Status & Next Steps

## ✅ Completed

1. **Code Build**: TypeScript code compiled successfully
   - Generator Lambda: `dist/lambda/generator/handler.js` ✓
   - EC2 Service: `dist/ec2/mqtt-to-rds-service.js` ✓

2. **Infrastructure Code**: All Terraform modules created
   - EC2 module with user-data script ✓
   - IoT Core policies updated ✓
   - Lambda generator function added ✓
   - Grafana datasource configuration ✓

3. **Deployment Scripts**: Updated to include generator Lambda ✓

## ⚠️ Current Issue

**Terraform State Lock**: There's an active state lock from a previous operation. You need to either:
- Wait for the lock to expire (usually 10 minutes)
- Force unlock if you're sure no other operation is running:
  ```bash
  cd infrastructure
  terraform force-unlock <lock-id>
  ```
  (The lock ID is shown in the error message)

## 📋 Next Steps

### Step 1: Resolve Terraform Lock & Deploy Infrastructure

```bash
cd infrastructure

# Check if lock is still active
terraform plan

# If locked, wait or force unlock, then:
terraform plan -out=tfplan
terraform apply tfplan
```

**Expected Resources to be Created:**
- EC2 instance (`scada-{env}-mqtt-ingest`)
- IoT Thing for EC2 (`scada-{env}-ec2-ingest`)
- IoT Certificate for EC2
- Lambda Generator function (`scada-{env}-generator`)
- EventBridge rule for generator schedule
- CloudWatch log groups

### Step 2: Deploy Lambda Functions

```bash
# Build and deploy all Lambda functions including generator
./scripts/deploy-lambda.sh prod generator
./scripts/deploy-lambda.sh prod ingest
./scripts/deploy-lambda.sh prod process
./scripts/deploy-lambda.sh prod query
```

Or deploy all at once:
```bash
./scripts/deploy-lambda.sh prod all
```

### Step 3: Configure EC2 Instance

After EC2 instance is created, you need to:

1. **SSH into EC2 instance**:
   ```bash
   # Get instance ID from Terraform output
   aws ec2 describe-instances \
     --filters "Name=tag:Name,Values=scada-prod-mqtt-ingest" \
     --query 'Reservations[0].Instances[0].InstanceId' \
     --output text
   
   # SSH (you'll need the key pair)
   ssh -i your-key.pem ec2-user@<instance-ip>
   ```

2. **Verify certificates were downloaded**:
   ```bash
   ls -la /opt/scada/certs/
   # Should see: certificate.pem.crt, private.pem.key, AmazonRootCA1.pem
   ```

3. **If certificates are missing, download manually**:
   ```bash
   # Get certificate ID from IoT Core
   CERT_ARN=$(aws iot list-things --query 'things[?thingName==`scada-prod-ec2-ingest`]' --output text)
   # Or get from Terraform output
   
   # Download certificate
   aws iot describe-certificate \
     --certificate-id <cert-id> \
     --query certificateDescription.certificatePem \
     --output text > /opt/scada/certs/certificate.pem.crt
   
   # Download private key
   aws iot describe-certificate \
     --certificate-id <cert-id> \
     --query certificateDescription.keyPair.privateKey \
     --output text > /opt/scada/certs/private.pem.key
   ```

4. **Deploy application code to EC2**:
   ```bash
   # On EC2 instance
   cd /opt/scada
   
   # Option 1: Clone repository
   git clone <your-repo-url> .
   
   # Option 2: Copy files manually
   # Use scp to copy dist/ directory
   
   # Install dependencies
   npm install --production
   
   # Restart service
   sudo systemctl restart scada-mqtt-ingest
   sudo systemctl status scada-mqtt-ingest
   ```

### Step 4: Verify Deployment

1. **Check Lambda Generator**:
   ```bash
   # View CloudWatch Logs
   aws logs tail /aws/lambda/scada-prod-generator --follow
   
   # Check Lambda metrics
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Invocations \
     --dimensions Name=FunctionName,Value=scada-prod-generator \
     --start-time $(date -u -d '5 minutes ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 60 \
     --statistics Sum
   ```

2. **Check EC2 Service**:
   ```bash
   # SSH into EC2 and check logs
   sudo journalctl -u scada-mqtt-ingest -f
   
   # Check CloudWatch Logs
   aws logs tail /aws/ec2/scada-prod-mqtt-ingest --follow
   ```

3. **Verify IoT Core Messages**:
   ```bash
   # Test MQTT subscription (from EC2 instance)
   mosquitto_sub \
     -h <iot-endpoint> \
     -p 8883 \
     --cafile /opt/scada/certs/AmazonRootCA1.pem \
     --cert /opt/scada/certs/certificate.pem.crt \
     --key /opt/scada/certs/private.pem.key \
     -t scada/telemetry \
     -v
   ```

4. **Check RDS Data**:
   ```bash
   # Get RDS endpoint from Terraform output
   terraform output -json | jq -r '.rds_endpoint.value'
   
   # Connect to RDS
   psql -h <rds-endpoint> -U scada_admin -d scada_topology
   
   # Check telemetry table
   SELECT COUNT(*) FROM telemetry;
   SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 10;
   
   # Check devices
   SELECT COUNT(*) FROM devices;
   SELECT * FROM devices LIMIT 10;
   ```

5. **Verify Grafana**:
   - Access Grafana dashboard (if running locally or via port-forward)
   - Check datasource connection to RDS
   - View topology dashboards

## 🔍 Troubleshooting

### Lambda Generator Not Publishing

1. Check environment variables:
   ```bash
   aws lambda get-function-configuration \
     --function-name scada-prod-generator \
     --query 'Environment.Variables'
   ```

2. Verify IoT endpoint is set correctly

3. Check IAM permissions for `iot:Publish`

### EC2 Service Not Receiving Messages

1. Verify IoT certificates are present and valid
2. Check security group allows outbound HTTPS (port 443)
3. Verify IoT policy allows subscribe/receive
4. Check service logs: `sudo journalctl -u scada-mqtt-ingest -n 100`

### RDS Connection Issues

1. Verify security group allows EC2 → RDS (port 5432)
2. Check RDS credentials in Secrets Manager
3. Verify VPC routing (EC2 can reach RDS subnet)

## 📊 Monitoring

### CloudWatch Dashboards

Access the CloudWatch dashboard:
```bash
# Get dashboard URL from Terraform output
terraform output cloudwatch_dashboard_url
```

### Key Metrics to Monitor

- **Lambda Generator**: Invocations, Errors, Duration
- **EC2 Service**: CPU, Memory, Network
- **RDS**: Connections, CPU, Storage, Read/Write Latency
- **IoT Core**: Message count, Failed messages

## 🎯 Success Criteria

✅ Lambda generator publishes messages every 10 seconds  
✅ EC2 service receives messages via MQTT  
✅ Data is stored in RDS PostgreSQL  
✅ Grafana dashboards show real-time data  
✅ No errors in CloudWatch logs  

## 📝 Notes

- The generator Lambda runs every 10 seconds (configurable via EventBridge rule)
- EC2 service processes messages asynchronously and stores in RDS
- Grafana queries RDS directly for visualization
- All communication uses TLS encryption

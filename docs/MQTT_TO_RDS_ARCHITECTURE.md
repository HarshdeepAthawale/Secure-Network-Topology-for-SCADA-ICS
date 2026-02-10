# MQTT to RDS Architecture

This document describes the complete data flow architecture: **Lambda → IoT Core MQTT → EC2 → RDS → Grafana**

## Architecture Overview

```
┌─────────────┐
│   Lambda    │  Generates SCADA telemetry data
│  Generator  │  (Triggered every 10 seconds)
└──────┬──────┘
       │ Publishes to MQTT
       ▼
┌─────────────┐
│  IoT Core   │  MQTT Broker (scada/telemetry topic)
│   MQTT      │  TLS-secured communication
└──────┬──────┘
       │ Subscribe
       ▼
┌─────────────┐
│  EC2 Instance│  MQTT to RDS Service
│             │  Subscribes and processes telemetry
└──────┬──────┘
       │ Writes to database
       ▼
┌─────────────┐
│     RDS     │  PostgreSQL Database
│  PostgreSQL │  Stores devices, connections, alerts
└──────┬──────┘
       │ Query
       ▼
┌─────────────┐
│   Grafana   │  Visualization Dashboards
│             │  Real-time topology, risk analysis
└─────────────┘
```

## Components

### 1. Lambda Generator Function

**Location**: `src/lambda/generator/handler.ts`

**Purpose**: Generates realistic SCADA/ICS telemetry data and publishes to AWS IoT Core MQTT topics.

**Trigger**: EventBridge schedule (every 10 seconds)

**What it does**:
- Generates SNMP telemetry for simulated devices
- Generates ARP entries
- Generates NetFlow records
- Generates Syslog messages (every 3rd invocation)
- Publishes all telemetry to `scada/telemetry` MQTT topic

**Environment Variables**:
- `IOT_ENDPOINT`: AWS IoT Core endpoint address
- `TELEMETRY_TOPIC`: MQTT topic (default: `scada/telemetry`)

**IAM Permissions**:
- `iot:Publish` on `scada/telemetry` topic

### 2. AWS IoT Core

**Configuration**: `infrastructure/modules/iot/main.tf`

**MQTT Topics**:
- `scada/telemetry`: Telemetry data (published by Lambda, subscribed by EC2)

**IoT Things**:
- `{prefix}-collector`: For Lambda generator (publish only)
- `{prefix}-ec2-ingest`: For EC2 instance (subscribe only)

**IoT Policies**:
- Collector policy: Allows publish to `scada/telemetry`
- EC2 ingest policy: Allows subscribe/receive from `scada/telemetry`

### 3. EC2 MQTT to RDS Service

**Location**: `src/ec2/mqtt-to-rds-service.ts`

**Purpose**: Subscribes to AWS IoT Core MQTT topics and writes telemetry data to RDS PostgreSQL.

**What it does**:
1. Connects to AWS IoT Core using TLS certificates
2. Subscribes to `scada/telemetry` topic
3. Processes incoming messages:
   - **SNMP**: Creates/updates devices
   - **ARP**: Updates device IP/MAC mappings
   - **NetFlow**: Creates/updates connections
   - **Syslog**: Creates alerts
4. Stores all telemetry in RDS database
5. Marks telemetry as processed

**Configuration**:
- `IOT_ENDPOINT`: AWS IoT Core endpoint
- `MQTT_TOPIC`: Topic to subscribe (default: `scada/telemetry`)
- `IOT_CERT_PATH`: Path to device certificate
- `IOT_KEY_PATH`: Path to private key
- `IOT_CA_PATH`: Path to Amazon Root CA

**Infrastructure**: `infrastructure/modules/ec2/main.tf`

**EC2 Instance**:
- AMI: Amazon Linux 2
- Instance Type: t3.small (configurable)
- Security Group: Allows outbound HTTPS (IoT Core) and PostgreSQL (RDS)

**IAM Role**:
- `iot:Connect`, `iot:Subscribe`, `iot:Receive` on telemetry topic
- `secretsmanager:GetSecretValue` for RDS credentials
- CloudWatch Logs permissions

**User Data Script**: `infrastructure/modules/ec2/user-data.sh`
- Installs Node.js 18, AWS CLI, git
- Clones repository (if provided)
- Downloads IoT certificates
- Creates systemd service
- Starts `mqtt-to-rds-service`

### 4. RDS PostgreSQL

**Configuration**: `infrastructure/modules/rds/main.tf`

**Database**: Stores all SCADA topology data:
- `devices`: Discovered devices
- `connections`: Network connections
- `telemetry`: Raw telemetry data
- `alerts`: Security alerts
- `topology_snapshots`: Historical topology snapshots

**Credentials**: Stored in AWS Secrets Manager

### 5. Grafana

**Configuration**: `grafana/datasources/datasources.yaml`

**Data Source**: PostgreSQL connection to RDS

**Grafana in AWS**: Grafana can run on an EC2 instance in the same VPC with RDS as the datasource (credentials from Secrets Manager). Access is via SSM port forwarding. See [DEPLOYMENT_COMPLETE.md](../DEPLOYMENT_COMPLETE.md#grafana-in-aws) for instance ID, port-forward command, and verification.

**Dashboards**:
- Real-time Topology Dashboard
- Risk Heatmap Dashboard
- Zone Overview Dashboard
- Security Alerts Dashboard

## Deployment Steps

### 1. Deploy Infrastructure

```bash
cd infrastructure
terraform init
terraform plan
terraform apply
```

This creates:
- VPC, subnets, security groups
- IoT Core things, certificates, policies
- Lambda functions (including generator)
- RDS PostgreSQL instance
- EC2 instance with MQTT service
- CloudWatch logs and alarms

### 2. Deploy Lambda Functions

```bash
# Build TypeScript
npm run build

# Deploy generator Lambda
./scripts/deploy-lambda.sh prod generator

# Deploy other Lambdas
./scripts/deploy-lambda.sh prod ingest
./scripts/deploy-lambda.sh prod process
./scripts/deploy-lambda.sh prod query
```

### 3. Configure EC2 Instance

The EC2 instance is automatically configured via user-data script, but you may need to:

1. **Download IoT Certificates**:
   ```bash
   # SSH into EC2 instance
   aws iot describe-certificate \
     --certificate-id <cert-id> \
     --query certificateDescription.certificatePem \
     --output text > /opt/scada/certs/certificate.pem.crt
   
   aws iot describe-certificate \
     --certificate-id <cert-id> \
     --query certificateDescription.keyPair.privateKey \
     --output text > /opt/scada/certs/private.pem.key
   ```

2. **Deploy Application Code**:
   ```bash
   # On EC2 instance
   cd /opt/scada
   git clone <repo-url> .
   npm install --production
   npm run build
   ```

3. **Start Service**:
   ```bash
   sudo systemctl start scada-mqtt-ingest
   sudo systemctl status scada-mqtt-ingest
   ```

### 4. Configure Grafana

1. **Set Environment Variables** (for datasource):
   ```bash
   export DB_HOST=<rds-endpoint>
   export DB_PORT=5432
   export DB_NAME=scada_topology
   export DB_USER=scada_admin
   export DB_PASSWORD=<from-secrets-manager>
   ```

2. **Import Dashboards**:
   - Copy dashboard JSON files to `grafana/dashboards/`
   - Grafana will auto-provision them

## Data Flow Example

1. **EventBridge** triggers Lambda generator every 10 seconds
2. **Lambda** generates SNMP telemetry for 8 random devices
3. **Lambda** publishes to `scada/telemetry` MQTT topic via IoT Core
4. **EC2 Service** receives message via MQTT subscription
5. **EC2 Service** parses SNMP data and creates/updates devices in RDS
6. **EC2 Service** stores raw telemetry in `telemetry` table
7. **Grafana** queries RDS and displays devices in topology dashboard

## Monitoring

### CloudWatch Logs

- **Lambda Generator**: `/aws/lambda/{prefix}-generator`
- **EC2 Service**: `/aws/ec2/{prefix}-mqtt-ingest`
- **IoT Core**: `/aws/iot/{prefix}/telemetry`

### CloudWatch Metrics

- Lambda invocations, errors, duration
- EC2 instance metrics (CPU, memory, network)
- RDS metrics (connections, CPU, storage)
- IoT Core message count

### Alarms

- Lambda errors > threshold
- EC2 service down
- RDS connection failures
- IoT Core message processing delays

## Verification

After deployment, confirm the full pipeline:

1. **Lambda**: CloudWatch Logs for `/{prefix}-generator` show successful publishes (e.g. "messagesPublished": 11).
2. **EC2 service**: On the EC2 instance run `systemctl status scada-mqtt-ingest`; it should be active. Check `journalctl -u scada-mqtt-ingest -n 50` for MQTT connect and message processing.
3. **RDS**: Query tables for recent data: `SELECT COUNT(*) FROM devices;` and `SELECT * FROM telemetry ORDER BY timestamp DESC LIMIT 5;` (use credentials from Secrets Manager).
4. **Grafana**: If Grafana is configured with RDS as datasource, open dashboards and set time range to include recent data.

**Scripts**:
- **From your machine**: `./scripts/verify-pipeline.sh` (set `AWS_REGION` and `NAME_PREFIX`). Checks Lambda logs, EC2 instance presence, and RDS row counts. RDS checks require `psql` and network access to RDS (use a host in the VPC or skip).
- **From the EC2 instance** (Session Manager or bastion): Copy and run `./scripts/verify-ec2-from-instance.sh [NAME_PREFIX]` (default `scada-prod`). It checks `systemctl status scada-mqtt-ingest`, recent logs, and RDS row counts using the instance IAM role. Installs `postgresql15` if `psql` is missing.

**SSM Session Manager**: The EC2 instance has the `AmazonSSMManagedInstanceCore` policy and the VPC has SSM/ec2messages/ssmmessages endpoints. Once the instance appears in **Systems Manager > Fleet Manager**, use **Start session** to run the on-instance script. If the instance does not appear, allow a few minutes after boot or restart the SSM agent on the instance.

**EC2 user-data**: User-data runs only at first boot. If you change user-data (e.g. IoT secret, DB env, or deploy path), replace the EC2 instance (e.g. `terraform taint module.ec2.aws_instance.mqtt_ingest` then `terraform apply`) or manually update certs, `/opt/scada/db.env`, app code, and restart `scada-mqtt-ingest`.

### Optional S3 deploy

To deploy the app from S3 instead of git clone:

1. Build and pack: `./scripts/build-and-pack-for-ec2.sh` (produces `scada-app.tar.gz`).
2. Create or choose an S3 bucket the EC2 instance role can access (when `ec2_s3_deploy_bucket` is set, the role gets GetObject on that bucket).
3. Upload: `aws s3 cp scada-app.tar.gz s3://BUCKET/deploys/scada-app.tar.gz --region REGION`.
4. Set Terraform variables: `ec2_s3_deploy_bucket = "BUCKET"`, `ec2_s3_deploy_key = "deploys/scada-app.tar.gz"` (e.g. in `terraform.tfvars` or `-var`).
5. Replace the EC2 instance so user-data runs again: `terraform taint module.ec2.aws_instance.mqtt_ingest` then `terraform apply -var=environment=prod` (or your env).

## Troubleshooting

### Lambda Generator Not Publishing

1. Check CloudWatch Logs: `/aws/lambda/{prefix}-generator`
2. Verify `IOT_ENDPOINT` environment variable
3. Check IAM permissions for `iot:Publish`

### EC2 Service Not Receiving Messages

1. Check service status: `sudo systemctl status scada-mqtt-ingest`
2. Check logs: `sudo journalctl -u scada-mqtt-ingest -f`
3. Verify IoT certificates are present: `ls -la /opt/scada/certs/`
4. Test MQTT connection: `mosquitto_sub -h <iot-endpoint> -p 8883 --cafile AmazonRootCA1.pem --cert certificate.pem.crt --key private.pem.key -t scada/telemetry`

### RDS Connection Issues

1. Check security group allows EC2 → RDS (port 5432)
2. Verify RDS credentials in Secrets Manager
3. Test connection: `psql -h <rds-endpoint> -U scada_admin -d scada_topology`

### Grafana Not Showing Data

1. Check datasource configuration
2. Verify RDS connection from Grafana server
3. Check dashboard queries are correct
4. Verify data exists in RDS tables

## Security Considerations

1. **TLS Encryption**: All MQTT communication uses TLS 1.2+
2. **IAM Roles**: Least privilege access for Lambda and EC2
3. **VPC**: EC2 and RDS in private subnets
4. **Secrets**: RDS credentials in Secrets Manager
5. **Certificates**: IoT device certificates stored securely
6. **Network**: Security groups restrict access

## Cost Optimization

- **Lambda**: Pay per invocation (10s schedule = ~8,640 invocations/day)
- **EC2**: t3.small instance (~$15/month)
- **RDS**: db.t3.medium instance (~$50/month)
- **IoT Core**: First 250,000 messages/month free, then $1.00 per million

## Scaling Considerations

- **Lambda Generator**: Can increase frequency or batch size
- **EC2**: Can scale horizontally (multiple instances with different client IDs)
- **RDS**: Can upgrade instance class or enable read replicas
- **IoT Core**: Handles millions of messages per second

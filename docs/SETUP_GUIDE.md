# Complete Setup Guide

This guide walks you through the complete setup of the SCADA Network Topology Discovery System.

---

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| Node.js | 18+ | Runtime for collectors and Lambda |
| npm | 9+ | Package management |
| Terraform | 1.5+ | Infrastructure as Code |
| AWS CLI | 2.0+ | AWS resource management |
| Docker | 20+ | Local Grafana and PostgreSQL |
| Git | 2.0+ | Version control |

### AWS Account Requirements

- Active AWS account with billing enabled
- IAM user with programmatic access
- Permissions defined in `infrastructure/iam-policy.json`

---

## Step 1: Clone and Install

```bash
# Clone the repository
git clone <repository-url>
cd scada-topology-discovery

# Install Node.js dependencies
npm install

# Build TypeScript
npm run build
```

---

## Step 2: Configure AWS CLI

```bash
# Configure AWS credentials
aws configure

# Enter:
# - AWS Access Key ID
# - AWS Secret Access Key
# - Default region: ap-south-1 (or your preferred region)
# - Default output format: json

# Verify configuration
aws sts get-caller-identity
```

---

## Step 3: Set Up IAM Permissions

The deployment requires specific AWS permissions. Apply the IAM policy:

### Option A: Using AWS Console

1. Go to IAM → Users → [Your User]
2. Click "Add permissions" → "Create inline policy"
3. Select "JSON" tab
4. Paste contents of `infrastructure/iam-policy.json`
5. Name the policy: `scada-topology-deployment`
6. Click "Create policy"

### Option B: Using AWS CLI

```bash
aws iam put-user-policy \
  --user-name YOUR_USERNAME \
  --policy-name scada-topology-deployment \
  --policy-document file://infrastructure/iam-policy.json
```

---

## Step 4: Bootstrap Terraform State

Before deploying infrastructure, create the S3 bucket for Terraform state:

```bash
# Run bootstrap script
./scripts/bootstrap-infrastructure.sh

# This creates:
# - S3 bucket for Terraform state (versioned, encrypted)
# - DynamoDB table for state locking
```

After bootstrap completes, update `infrastructure/main.tf`:

```hcl
# Uncomment and update the backend block:
backend "s3" {
  bucket         = "scada-topology-terraform-state-YOUR_ACCOUNT_ID"
  key            = "infrastructure/terraform.tfstate"
  region         = "ap-south-1"
  encrypt        = true
  dynamodb_table = "terraform-state-lock"
}
```

Then migrate the state:

```bash
cd infrastructure
terraform init -migrate-state
```

---

## Step 5: Configure Terraform Variables

Edit `infrastructure/terraform.tfvars`:

```hcl
# AWS Configuration
aws_region   = "ap-south-1"  # Your preferred region
environment  = "dev"          # dev, staging, or prod

# Network
vpc_cidr = "10.0.0.0/16"

# Database
db_name           = "scada_topology"
db_username       = "scada_admin"
db_instance_class = "db.t3.medium"  # Adjust based on needs

# Alerts
alert_email = "your-email@example.com"

# Protection (set to true for production)
enable_deletion_protection = false
log_retention_days         = 30
```

---

## Step 6: Deploy AWS Infrastructure

```bash
# Plan the deployment
./scripts/deploy-infrastructure.sh dev plan

# Review the plan, then apply
./scripts/deploy-infrastructure.sh dev apply

# This creates:
# - VPC with public/private/database subnets
# - AWS IoT Core thing and certificates
# - Lambda functions (ingest, process, query)
# - RDS PostgreSQL instance
# - S3 buckets for telemetry and reports
# - CloudWatch dashboard and alarms
```

---

## Step 7: Generate IoT Certificates

```bash
# Generate certificates for the edge collector
./scripts/generate-certs.sh collector-01

# Certificates are saved to:
# - certs/collector-01.pem.crt (certificate)
# - certs/collector-01.private.pem.key (private key)
# - certs/root-CA.crt (Amazon root CA)
```

---

## Step 8: Run Database Migrations

```bash
# Get the database endpoint from Terraform outputs
./scripts/deploy-infrastructure.sh dev output

# Run migrations with sample data
./scripts/run-migrations.sh --seed

# Or run migrations only
./scripts/run-migrations.sh
```

---

## Step 9: Configure Environment

Update `.env` with values from Terraform outputs:

```bash
# Copy example environment file
cp .env.example .env

# Edit .env with actual values
# Get IoT endpoint from Terraform:
terraform -chdir=infrastructure output -raw iot_endpoint
```

Key environment variables:

```env
# AWS IoT
IOT_ENDPOINT=your-iot-endpoint.iot.ap-south-1.amazonaws.com
IOT_CERT_PATH=./certs/collector-01.pem.crt
IOT_KEY_PATH=./certs/collector-01.private.pem.key

# Database (from Terraform outputs)
DB_HOST=your-rds-endpoint.ap-south-1.rds.amazonaws.com
DB_PASSWORD=<from Secrets Manager>
```

---

## Step 10: Start Local Grafana

```bash
# Start Grafana and local PostgreSQL
cd grafana
docker-compose up -d

# Access Grafana at http://localhost:3000
# Default login: admin / admin
```

Configure Grafana:

1. Add PostgreSQL data source (use RDS endpoint)
2. Import dashboards from `grafana/dashboards/`
3. Configure alert notification channels

---

## Step 11: Start Collectors

```bash
# Development mode (single collector)
npm run collector:start

# Production mode
npm run collector:production
```

---

## Verification

### Check Collector Status

```bash
curl http://localhost:8080/health
```

### Verify Database

```bash
psql -h $DB_HOST -U $DB_USER -d scada_topology \
  -c "SELECT COUNT(*) FROM devices"
```

### Check CloudWatch

Access the CloudWatch dashboard from the Terraform output URL.

---

## Troubleshooting

### "AccessDeniedException" during deployment

Ensure the IAM policy is correctly attached:

```bash
aws iam list-attached-user-policies --user-name YOUR_USERNAME
```

### Terraform state issues

If state becomes corrupted:

```bash
cd infrastructure
terraform init -reconfigure
```

### IoT connection failures

1. Verify certificate paths in `.env`
2. Check IoT policy allows the operations
3. Verify endpoint URL is correct

### Database connection issues

1. Check security group allows inbound from Lambda VPC
2. Verify RDS is in the correct subnet
3. Check credentials in Secrets Manager

---

## Cost Estimation

Monthly cost estimates (ap-south-1, dev environment):

| Service | Est. Monthly Cost |
|---------|-------------------|
| RDS db.t3.micro | ~$15 |
| Lambda (low usage) | ~$0-5 |
| IoT Core (1M messages) | ~$1 |
| S3 (10GB) | ~$0.25 |
| CloudWatch | ~$5 |
| NAT Gateway | ~$30 |
| **Total (Dev)** | **~$50-60** |

For production (Multi-AZ, larger instances): ~$200-400/month

---

## Next Steps

1. Configure SNMP targets (devices to monitor)
2. Set up Syslog forwarding from network devices
3. Configure NetFlow export on routers/switches
4. Create custom Grafana dashboards
5. Set up alerting channels (email, Slack, PagerDuty)

---

## Support

- Documentation: `docs/` folder
- Issues: GitHub Issues
- Security: See `docs/security.md`

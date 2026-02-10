# AWS Infrastructure Deployment Plan

## SCADA/ICS Network Topology Discovery System

This document outlines the complete steps to deploy the infrastructure on a fresh AWS account.

---

## Phase 1: AWS Account Setup

### 1.1 Create AWS Account
- Go to https://aws.amazon.com and create a new account
- Complete email verification and payment method setup
- Enable MFA on root account (highly recommended)

### 1.2 Create IAM User for Development
```bash
# After logging into AWS Console as root:
# 1. Go to IAM > Users > Create User
# 2. Username: Harsh (or preferred name)
# 3. Enable "Programmatic access" and "Console access"
```

### 1.3 Attach Required IAM Policies
Attach these managed policies to the IAM user:

| Policy Name | Purpose |
|-------------|---------|
| AmazonEC2FullAccess | VPC, Subnets, Security Groups |
| AmazonRDSFullAccess | PostgreSQL Database |
| AmazonS3FullAccess | Telemetry & Reports Storage |
| AmazonVPCFullAccess | Network Infrastructure |
| IAMFullAccess | Role & Policy Management |
| CloudWatchFullAccess | Monitoring & Dashboards |
| AmazonDynamoDBFullAccess | Terraform State Locking |

**Create Custom Policy** (for IoT, Lambda, API Gateway, Secrets Manager):
```json
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "iot:*",
                "lambda:*",
                "apigateway:*",
                "execute-api:*",
                "secretsmanager:*",
                "logs:*",
                "kms:*"
            ],
            "Resource": "*"
        }
    ]
}
```
Name it: `SCADA-IoT-Lambda-Access`

### 1.4 Configure AWS CLI
```bash
# Download access keys from IAM Console
aws configure
# Enter:
#   AWS Access Key ID: <your-access-key>
#   AWS Secret Access Key: <your-secret-key>
#   Default region: ap-south-1
#   Default output format: json

# Verify configuration
aws sts get-caller-identity
```

---

## Phase 2: Infrastructure Deployment

### 2.1 Update Terraform Configuration
Before deploying, update the S3 backend with your new account ID:

**File:** `infrastructure/main.tf`
```hcl
backend "s3" {
  bucket         = "scada-topology-terraform-state-<NEW_ACCOUNT_ID>"
  key            = "infrastructure/terraform.tfstate"
  region         = "ap-south-1"
  encrypt        = true
  dynamodb_table = "terraform-state-lock"
}
```

### 2.2 Bootstrap Terraform State Backend
```bash
cd infrastructure/bootstrap

# Initialize
terraform init

# Plan and review
terraform plan -var="aws_region=ap-south-1"

# Apply (creates S3 bucket + DynamoDB table)
terraform apply -var="aws_region=ap-south-1" -auto-approve

# Note the output - you'll need the bucket name
```

### 2.3 Deploy Main Infrastructure
```bash
cd ../  # Back to infrastructure/

# Initialize with S3 backend
terraform init

# Plan the deployment
terraform plan -var="environment=dev"

# Deploy everything
terraform apply -var="environment=dev" -auto-approve
```

### 2.4 Expected Resources Created

| Resource | Name Pattern | Purpose |
|----------|--------------|---------|
| VPC | scada-dev-vpc | Isolated network |
| Subnets | scada-dev-public/private/database-* | Network segmentation |
| NAT Gateway | scada-dev-nat | Outbound internet for private subnets |
| RDS PostgreSQL | scada-dev-postgres | Cloud database |
| S3 Buckets | scada-dev-telemetry-*, scada-dev-reports-* | Data storage |
| Lambda Functions | scada-dev-ingest/process/query | Serverless processing |
| API Gateway | scada-dev-api | REST API endpoint |
| IoT Core Thing | scada-dev-collector | Device registry |
| CloudWatch Dashboard | scada-dev-dashboard | Monitoring |
| Secrets Manager | scada-dev/database/credentials | Secure credential storage |

### 2.5 Save Terraform Outputs
```bash
# Get all outputs
terraform output

# Save to file for reference
terraform output -json > ../deployment-outputs.json
```

---

## Phase 3: Update Environment Configuration

### 3.1 Update .env File
After deployment, update `.env` with the new values:

```bash
# Get IoT endpoint
IOT_ENDPOINT=$(terraform output -raw iot_endpoint)

# Update .env
sed -i "s|IOT_ENDPOINT=.*|IOT_ENDPOINT=$IOT_ENDPOINT|" ../.env
```

### 3.2 Generate IoT Certificates
```bash
cd ..  # Back to project root
./scripts/generate-certs.sh collector-01

# This creates:
# - certs/device.pem.crt
# - certs/private.pem.key
# - certs/root-CA.crt
```

---

## Phase 4: Local Development Setup

### 4.1 Start Local PostgreSQL
Set a strong password via environment (never commit real passwords):
```bash
export POSTGRES_PASSWORD="your_secure_password"  # or use a secrets manager
```
```bash
# Using Docker
docker run -d --name scada-postgres \
  -e POSTGRES_DB=scada_topology \
  -e POSTGRES_USER=scada_admin \
  -e "POSTGRES_PASSWORD=${POSTGRES_PASSWORD:-your_secure_password}" \
  -p 5432:5432 \
  -v scada_postgres_data:/var/lib/postgresql/data \
  postgres:14-alpine
```

### 4.2 Run Database Migrations
```bash
./scripts/run-migrations.sh --seed
```

### 4.3 Install Node.js Dependencies
```bash
npm install
```

### 4.4 Build the Project
```bash
npm run build
```

---

## Phase 5: Deploy Lambda Functions

### 5.1 Package Lambda Code
```bash
./scripts/deploy-lambda.sh dev
```

This script will:
1. Build TypeScript code
2. Create deployment packages
3. Upload to S3
4. Update Lambda functions

---

## Phase 6: Verification Checklist

### AWS Resources
- [ ] VPC created with public/private/database subnets
- [ ] RDS PostgreSQL instance running
- [ ] S3 buckets accessible
- [ ] Lambda functions deployed
- [ ] API Gateway endpoint responding
- [ ] IoT Core thing registered
- [ ] CloudWatch dashboard visible

### Local Development
- [ ] PostgreSQL container running
- [ ] Database migrations applied
- [ ] Node.js dependencies installed
- [ ] `.env` file configured with IoT endpoint

### Connectivity Tests
```bash
# Test API endpoint
curl https://<api-gateway-id>.execute-api.ap-south-1.amazonaws.com/dev/health

# Test database connection
PGPASSWORD="${POSTGRES_PASSWORD:-your_secure_password}" psql -h localhost -U scada_admin -d scada_topology -c "SELECT 1"

# Test IoT connection (requires certificates)
npm run collector:test
```

---

## Quick Reference Commands

### Terraform
```bash
# Plan changes
terraform plan -var="environment=dev"

# Apply changes
terraform apply -var="environment=dev" -auto-approve

# View outputs
terraform output

# Destroy (careful!)
terraform destroy -var="environment=dev"
```

### Docker PostgreSQL
```bash
# Start
docker start scada-postgres

# Stop
docker stop scada-postgres

# Logs
docker logs scada-postgres

# Shell access
docker exec -it scada-postgres psql -U scada_admin -d scada_topology
```

### Project
```bash
# Start collector
npm run collector:start

# Run tests
npm test

# Build
npm run build
```

---

## Estimated Costs (Monthly)

| Service | Estimate |
|---------|----------|
| RDS db.t3.medium | ~$30-40 |
| NAT Gateway | ~$35 |
| S3 (minimal) | ~$1-5 |
| Lambda (minimal) | ~$1-5 |
| IoT Core | ~$1-5 |
| **Total** | **~$70-90/month** |

> **Tip:** For development, you can reduce costs by:
> - Using `db.t3.micro` for RDS
> - Stopping RDS when not in use
> - Using VPC endpoints instead of NAT Gateway

---

## Troubleshooting

### IAM Permission Errors
If you see `AccessDeniedException`, check:
1. All required policies are attached
2. Custom SCADA-IoT-Lambda-Access policy exists
3. Wait 1-2 minutes for IAM propagation

### Terraform State Issues
```bash
# Reinitialize backend
terraform init -reconfigure

# If state is corrupted
terraform init -migrate-state
```

### RDS Connection Issues
- Check security group allows inbound on port 5432
- Verify RDS is in the correct VPC/subnet
- Check Secrets Manager for credentials

---

## Next Steps After Deployment

1. **Configure Grafana** - Set up dashboards for visualization
2. **Test Collector** - Run edge collector against test devices
3. **Set up Alerts** - Configure CloudWatch alarms
4. **Production Hardening** - Review security settings

---

*Document created: February 2026*
*For: Fresh AWS Account Deployment*

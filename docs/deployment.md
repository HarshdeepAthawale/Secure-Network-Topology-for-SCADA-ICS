# SCADA Topology Discovery - Deployment Guide

## Prerequisites

- Node.js 18+
- AWS CLI configured with appropriate credentials
- Terraform 1.5+
- PostgreSQL 13+ (or AWS RDS)
- Docker (for local Grafana)

## Quick Start

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/scada-topology-discovery.git
cd scada-topology-discovery
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration
```

### 3. Deploy Infrastructure

```bash
# Initialize and deploy AWS infrastructure
./scripts/deploy-infrastructure.sh dev apply

# Get outputs (IoT endpoint, RDS endpoint, etc.)
./scripts/deploy-infrastructure.sh dev output
```

### 4. Generate Certificates

```bash
./scripts/generate-certs.sh scada-collector-01
```

### 5. Run Database Migrations

```bash
./scripts/run-migrations.sh --seed
```

### 6. Start Local Development

```bash
# Start Grafana and PostgreSQL
cd grafana && docker-compose up -d

# Start collectors
npm run collector:start
```

## Production Deployment

### AWS Infrastructure

1. **Configure Variables**
   ```hcl
   # infrastructure/terraform.tfvars
   environment = "prod"
   db_instance_class = "db.r6g.large"
   enable_deletion_protection = true
   alert_email = "security@example.com"
   ```

2. **Deploy**
   ```bash
   ./scripts/deploy-infrastructure.sh prod apply
   ```

3. **Deploy Lambda Functions**
   ```bash
   npm run build
   ./scripts/deploy-lambda.sh prod
   ```

### Edge Collector Deployment

1. Install on edge server in OT network
2. Configure MQTT endpoint from Terraform outputs
3. Copy certificates to `./certs/`
4. Configure SNMP credentials for devices
5. Start collector service

### Grafana Setup

1. Access Grafana at configured URL
2. Import dashboards from `grafana/dashboards/`
3. Configure PostgreSQL data source
4. Set up alert notification channels

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `IOT_ENDPOINT` | AWS IoT Core endpoint | Yes |
| `DB_HOST` | PostgreSQL host | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `ENCRYPTION_KEY` | 32-char encryption key | Yes |
| `SNMP_AUTH_KEY` | SNMPv3 auth key | Yes |
| `SNMP_PRIV_KEY` | SNMPv3 priv key | Yes |

## Verification

```bash
# Run tests
npm test

# Check collector status
curl http://localhost:8080/health

# Verify database
psql -h $DB_HOST -U $DB_USER -d scada_topology -c "SELECT COUNT(*) FROM devices"
```

## Troubleshooting

See [troubleshooting.md](troubleshooting.md) for common issues.

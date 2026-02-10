# How to Use - SCADA/ICS Network Topology Discovery

> **Version**: 1.0 | **Last Updated**: 2026-02-08
> **Author**: Harshdeep Athawale

---

## Table of Contents

1. [What This Project Does](#1-what-this-project-does)
2. [Architecture Overview](#2-architecture-overview)
3. [Prerequisites](#3-prerequisites)
4. [Initial Setup](#4-initial-setup)
5. [Environment Configuration](#5-environment-configuration)
6. [Infrastructure Deployment (AWS)](#6-infrastructure-deployment-aws)
7. [Database Setup](#7-database-setup)
8. [Running the Collectors](#8-running-the-collectors)
9. [Configuring Each Collector](#9-configuring-each-collector)
10. [Lambda Functions (Cloud Processing)](#10-lambda-functions-cloud-processing)
11. [API Endpoints](#11-api-endpoints)
12. [WebSocket Real-Time Updates](#12-websocket-real-time-updates)
13. [Grafana Dashboards](#13-grafana-dashboards)
14. [Running Tests](#14-running-tests)
15. [Production Deployment](#15-production-deployment)
16. [Monitoring & Operations](#16-monitoring--operations)
17. [Common Workflows](#17-common-workflows)
18. [Troubleshooting](#18-troubleshooting)
19. [Project Structure](#19-project-structure)
20. [Security Considerations](#20-security-considerations)

---

## 1. What This Project Does

This system automatically discovers and maps the network topology of SCADA/ICS (Industrial Control System) environments. It provides:

- **Non-intrusive device discovery** using SNMPv3, ARP, NetFlow, Syslog, OPC-UA, and Modbus
- **Automatic Purdue Model classification** (Level 0-5 + DMZ) for every discovered device
- **Risk scoring** based on vulnerability, configuration, exposure, and compliance factors
- **Real-time topology visualization** via Grafana dashboards
- **Security alerting** for anomalies, cross-zone violations, and compliance issues
- **Cloud processing** on AWS (Lambda, RDS, IoT Core, S3)

### How It Works (Data Flow)

```
OT Network Devices
       |
       v
Edge Collectors (SNMPv3, ARP, NetFlow, Syslog, OPC-UA, Modbus)
       |
       v (MQTT over TLS 1.3)
AWS IoT Core (certificate-based auth)
       |
       v (IoT Rules)
Lambda: Ingest --> Lambda: Process --> PostgreSQL (RDS)
                      |                     |
                      v                     v
              Risk Analysis          Grafana Dashboards
              Purdue Classification   API (Query Lambda)
              Alert Generation        Reports (Export Lambda)
```

---

## 2. Architecture Overview

### Layers

| Layer | Components | Purpose |
|-------|-----------|---------|
| **Edge Collection** | SNMP, ARP, NetFlow, Syslog, OPC-UA, Modbus collectors | Gather telemetry from OT devices |
| **Transport** | AWS IoT Core + MQTT over TLS 1.3 | Secure data transport to cloud |
| **Processing** | Lambda functions (ingest, process, query, export) | Parse, correlate, classify, analyze |
| **Storage** | PostgreSQL (RDS Multi-AZ) + S3 | Persist devices, connections, alerts, reports |
| **Visualization** | Grafana + WebSocket server | Real-time dashboards and monitoring |

### Purdue Model Levels

| Level | What Lives Here | Example Devices |
|-------|----------------|-----------------|
| **Level 0** | Physical Process | Sensors, actuators, field instruments |
| **Level 1** | Basic Control | PLCs, RTUs, DCS controllers |
| **Level 2** | Supervisory | SCADA servers, HMIs, engineering workstations |
| **Level 3** | Operations | MES, historians, OPC servers |
| **DMZ** | Security Boundary | Firewalls, data diodes, jump servers |
| **Level 4-5** | Enterprise | IT servers, business applications, internet |

---

## 3. Prerequisites

Install the following before starting:

| Tool | Version | Check Command |
|------|---------|---------------|
| **Node.js** | 18+ | `node --version` |
| **npm** | 9+ | `npm --version` |
| **TypeScript** | 5.3+ | `npx tsc --version` |
| **AWS CLI** | 2.x | `aws --version` |
| **Terraform** | 1.5+ | `terraform --version` |
| **Docker** | 20+ | `docker --version` |
| **PostgreSQL Client** | 13+ | `psql --version` |
| **Git** | 2.x | `git --version` |

### AWS Account Requirements

- An AWS account with administrator access
- AWS CLI configured: `aws configure`
- Region: `ap-south-1` (or your preferred region)

---

## 4. Initial Setup

### Clone and Install

```bash
# Clone the repository
git clone https://github.com/HarshdeepAthawale/Secure-Network-Topology-for-SCADA-ICS.git
cd Secure-Network-Topology-for-SCADA-ICS

# Install dependencies
npm install

# Build TypeScript
npm run build
```

### Configure Environment

```bash
# Copy example environment file
cp .env.example .env

# Edit with your values (see Section 5 for details)
nano .env
```

### Verify Build

```bash
# Check TypeScript compiles cleanly
npx tsc --noEmit

# Run unit tests
npm test
```

---

## 5. Environment Configuration

Edit your `.env` file with the following settings:

### Application Settings

```bash
NODE_ENV=development          # development | production | test
LOG_LEVEL=info                # error | warn | info | debug | trace
APP_NAME=scada-topology-discovery
```

### AWS Configuration

```bash
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=your_access_key_id
AWS_SECRET_ACCESS_KEY=your_secret_access_key
```

### AWS IoT Core

```bash
IOT_ENDPOINT=your-iot-endpoint.iot.ap-south-1.amazonaws.com
IOT_TOPIC_TELEMETRY=scada/telemetry
IOT_TOPIC_ALERTS=scada/alerts
IOT_CERT_PATH=./certs/device.pem.crt
IOT_KEY_PATH=./certs/private.pem.key
IOT_CA_PATH=./certs/root-CA.crt
```

### PostgreSQL Database

```bash
DB_HOST=localhost             # RDS endpoint for production
DB_PORT=5432
DB_NAME=scada_topology
DB_USER=scada_admin
DB_PASSWORD=your_secure_password
DB_SSL=true                   # Always true for production
DB_POOL_SIZE=10               # 20 for production
```

### SNMPv3 Configuration

```bash
SNMP_AUTH_PROTOCOL=SHA        # MD5 | SHA | SHA256 | SHA512
SNMP_PRIV_PROTOCOL=AES       # DES | AES | AES256
SNMP_SECURITY_LEVEL=authPriv  # noAuthNoPriv | authNoPriv | authPriv
SNMP_TIMEOUT=5000             # Milliseconds
SNMP_RETRIES=3
```

### Collector Settings

```bash
COLLECTOR_POLL_INTERVAL=60000   # How often to poll (ms) - default 60s
COLLECTOR_BATCH_SIZE=100        # Max items per batch
COLLECTOR_MAX_CONCURRENT=10     # Max parallel collections
```

### Network Listener Ports

```bash
SYSLOG_PORT=514               # Syslog listener port
SYSLOG_PROTOCOL=udp           # udp | tcp
NETFLOW_PORT=2055             # NetFlow listener port
```

### Security

```bash
ENCRYPTION_KEY=your_32_character_encryption_key_here
JWT_SECRET=your_jwt_secret_key
TLS_MIN_VERSION=TLSv1.3
```

### Alerting

```bash
ALERT_EMAIL_ENABLED=true
ALERT_EMAIL_SMTP_HOST=smtp.example.com
ALERT_EMAIL_SMTP_PORT=587
ALERT_EMAIL_FROM=alerts@example.com
ALERT_EMAIL_TO=admin@example.com
ALERT_WEBHOOK_URL=https://your-webhook-endpoint.com/alerts
```

---

## 6. Infrastructure Deployment (AWS)

### Step 1: Bootstrap Terraform Backend (First Time Only)

```bash
cd infrastructure/bootstrap
terraform init
terraform apply
cd ..
```

This creates the S3 bucket and DynamoDB table for Terraform state management.

### Step 2: Deploy Infrastructure

```bash
cd infrastructure

# Initialize Terraform
terraform init

# Create a workspace for your environment
terraform workspace new dev     # or: terraform workspace new prod

# Preview what will be created
terraform plan -var="environment=dev"

# Deploy (creates ~50+ AWS resources)
terraform apply -var="environment=dev"
```

### What Gets Created

| Resource | Purpose |
|----------|---------|
| **VPC** | Private networking with public/private/database subnets |
| **RDS PostgreSQL** | Multi-AZ database (db.t3.medium for prod) |
| **Lambda x3** | ingest, process, query functions |
| **API Gateway** | HTTP API for the query Lambda |
| **IoT Core** | MQTT broker with certificate auth |
| **S3 x2** | Telemetry archive + reports bucket |
| **CloudWatch** | 17 monitoring alarms + dashboard |
| **Secrets Manager** | Database credentials |
| **SNS** | Alert notifications |

### Step 3: Get Output Values

```bash
terraform output

# Key outputs:
# api_endpoint          = "https://xxxxx.execute-api.ap-south-1.amazonaws.com/prod"
# iot_endpoint          = "xxxxx-ats.iot.ap-south-1.amazonaws.com"
# rds_endpoint          = (sensitive - use: terraform output -raw rds_endpoint)
# s3_telemetry_bucket   = "scada-prod-telemetry-XXXXXXXXXXXX"
# cloudwatch_dashboard_url = "https://..."
```

Update your `.env` with these values.

### Step 4: Generate IoT Certificates

```bash
./scripts/generate-certs.sh collector-01
```

This creates X.509 certificates in `./certs/` for authenticating the edge collector with AWS IoT Core.

---

## 7. Database Setup

### Run Migrations

```bash
# Apply all migration files in order
./scripts/run-migrations.sh

# With seed data (Purdue zone definitions)
./scripts/run-migrations.sh --seed
```

### Migration Files (Applied in Order)

| File | Creates |
|------|---------|
| `001_create_devices_table.sql` | Device inventory (IP, MAC, type, Purdue level, zone, status) |
| `002_create_interfaces_table.sql` | Network interfaces per device |
| `003_create_connections_table.sql` | Device-to-device connections (L2/L3) |
| `005_create_alerts_table.sql` | Security alerts with severity levels |
| `007_create_zones_table.sql` | Purdue security zone definitions |
| `008_create_topology_snapshots_table.sql` | Point-in-time topology captures |

### Seed Data

```bash
# Seeds Purdue zone definitions (Level 0-5 + DMZ)
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -f database/seeds/purdue-zones.sql
```

### Verify Database

```bash
psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "\dt"
# Should list: devices, interfaces, connections, alerts, zones, topology_snapshots
```

---

## 8. Running the Collectors

### Start All Collectors

```bash
# Development mode (with hot reload)
npm run dev

# Production mode
npm run build && npm start

# Or directly start the collector manager
npm run collector:start
```

The collector manager:
1. Initializes all enabled collectors (SNMP, ARP, NetFlow, Syslog, Routing, OPC-UA, Modbus)
2. Connects to MQTT (AWS IoT Core)
3. Begins polling at the configured interval
4. Publishes telemetry to `scada/telemetry` topic
5. Runs health checks every 30 seconds
6. Handles graceful shutdown on SIGINT/SIGTERM

### What Happens When Collectors Run

```
1. SNMP Collector polls switches/routers via SNMPv3
   --> Discovers device info, interfaces, ARP tables, LLDP neighbors

2. ARP Collector reads local ARP cache
   --> Maps MAC addresses to IP addresses

3. NetFlow Collector listens on UDP 2055
   --> Captures traffic flow data from routers

4. Syslog Collector listens on UDP 514
   --> Captures security events and logs

5. OPC-UA Collector connects to OPC servers
   --> Reads industrial process data

6. Modbus Collector queries Modbus devices
   --> Reads register values from PLCs

All data --> MQTT --> AWS IoT Core --> Lambda Pipeline --> Database
```

---

## 9. Configuring Each Collector

### SNMPv3 Collector

The most important collector for device discovery. Uses SNMPv3 with authPriv (authentication + encryption).

**What it collects**: System info, interfaces, LLDP neighbors, ARP tables, MAC tables

**Adding targets programmatically**:

```typescript
import { getCollectorManager } from './collectors/collector-manager';

const manager = getCollectorManager();
const snmpCollector = manager.getCollector('snmp');

// Add a network switch
snmpCollector.addSNMPTarget('192.168.1.1', 'snmp-user', {
  securityLevel: 'authPriv',
  authProtocol: 'SHA',
  authKey: 'your-auth-password-min-8-chars',
  privProtocol: 'AES',
  privKey: 'your-priv-password-min-8-chars',
});

// Add a PLC
snmpCollector.addSNMPTarget('10.0.1.50', 'plc-monitor', {
  securityLevel: 'authPriv',
  authProtocol: 'SHA256',
  authKey: 'plc-auth-password',
  privProtocol: 'AES256',
  privKey: 'plc-priv-password',
});
```

**Important SNMP OIDs collected**:

| OID | What It Gets |
|-----|-------------|
| `1.3.6.1.2.1.1.1` (sysDescr) | Device description, firmware, vendor |
| `1.3.6.1.2.1.1.5` (sysName) | Hostname |
| `1.3.6.1.2.1.2.2` (ifTable) | All network interfaces |
| `1.3.6.1.0.8802.1.1.2` (lldpRemTable) | LLDP neighbors (topology links) |
| `1.3.6.1.2.1.3.1` (atTable) | ARP cache (IP-to-MAC mapping) |

### ARP Collector

Discovers Layer 2 connectivity by reading ARP tables.

**What it collects**: MAC-to-IP mappings, vendor identification via OUI

```typescript
const arpCollector = manager.getCollector('arp');

// Collect from local system ARP cache
arpCollector.addLocalTarget({
  interface: 'eth0',
  collectType: 'both'   // 'arp' | 'mac' | 'both'
});

// Passive subnet discovery
const devices = await arpCollector.discoverSubnet('192.168.1.0/24', {
  passive: true  // No active scanning - safe for OT networks
});
```

### NetFlow Collector

Passively listens for NetFlow data from routers/switches. No active probing.

**What it collects**: Traffic flows (source/dest IPs, ports, protocols, byte counts)

```bash
# Configure your router to send NetFlow to this collector:
# Router config example (Cisco):
#   ip flow-export destination <collector-ip> 2055
#   ip flow-export version 9
```

**Environment config**:
```bash
NETFLOW_PORT=2055       # UDP port to listen on
NETFLOW_VERSION=9       # NetFlow v5 or v9
```

The collector automatically:
- Detects NetFlow version (v5 or v9)
- Manages v9 templates
- Aggregates flows by 5-tuple
- Buffers up to 10,000 flows

### Syslog Collector

Listens for syslog messages and extracts security events.

**What it collects**: Security events, authentication failures, configuration changes

```bash
# Configure devices to send syslog to this collector:
# Most devices: set syslog server to <collector-ip>:514
```

**Environment config**:
```bash
SYSLOG_PORT=514
SYSLOG_PROTOCOL=udp     # udp or tcp
```

**Security event detection**: Automatically flags messages with:
- Severity 0-3 (Emergency, Alert, Critical, Error)
- Keywords: "failed", "denied", "violation", "unauthorized", "attack", "malware"

### OPC-UA Collector

Connects to OPC-UA servers in industrial environments.

**What it collects**: Industrial process data, server info, node values

```typescript
const opcuaCollector = manager.getCollector('opcua');

opcuaCollector.addTarget({
  host: '10.0.1.100',
  endpointUrl: 'opc.tcp://10.0.1.100:4840',
  securityMode: 'SignAndEncrypt',
  username: process.env.OPCUA_USER ?? 'operator',
  password: process.env.OPCUA_PASSWORD ?? 'your_opcua_password', // In production: set OPCUA_PASSWORD (env or secrets); do not commit real credentials
  monitoredNodes: ['ns=2;s=Temperature', 'ns=2;s=Pressure'],
  samplingInterval: 1000,
});
```

### Modbus Collector

Queries Modbus TCP devices (PLCs, RTUs, sensors).

**What it collects**: Register values (coils, holding registers, input registers)

```typescript
const modbusCollector = manager.getCollector('modbus');

modbusCollector.addTarget({
  host: '10.0.1.50',
  port: 502,
  unitId: 1,
  protocol: 'tcp',
  registers: [
    {
      name: 'Temperature',
      address: 100,
      length: 1,
      type: 'holding',
      dataType: 'float32',
      scaleFactor: 0.1,
      unit: 'C'
    },
    {
      name: 'Pump_Status',
      address: 0,
      length: 1,
      type: 'coil',
      dataType: 'uint16'
    }
  ]
});
```

### Routing Collector

Discovers Layer 3 topology by reading routing tables.

**What it collects**: Routes (destination, gateway, metric), OSPF/BGP neighbors

```typescript
const routingCollector = manager.getCollector('routing');

routingCollector.addTarget({
  host: '10.0.0.1',
  collectRoutes: true,
  collectNeighbors: true,
  routingProtocols: ['ospf', 'bgp']
});
```

---

## 10. Lambda Functions (Cloud Processing)

### Ingest Lambda

**Trigger**: AWS IoT Core rule (when MQTT messages arrive on `scada/telemetry`)

**What it does**:
1. Receives telemetry batch from MQTT
2. Validates and enriches data
3. Stores raw telemetry in the database

**Input format** (MQTT payload):
```json
{
  "collector": "collector-01",
  "source": "snmp",
  "timestamp": "2026-02-08T12:00:00Z",
  "count": 5,
  "data": [
    {
      "id": "uuid",
      "source": "snmp",
      "timestamp": "2026-02-08T12:00:00Z",
      "rawData": { ... }
    }
  ]
}
```

### Process Lambda

**Trigger**: SQS queue (from IoT rules)

**What it does** (the core processing pipeline):
1. **Parse**: Normalize telemetry by source type (SNMP, ARP, NetFlow, Syslog)
2. **Correlate**: Match device identities across data sources (by MAC, IP, hostname)
3. **Classify**: Assign Purdue levels using weighted scoring:
   - Device type (40 points)
   - Hostname patterns (25 points)
   - Vendor identification (20 points)
   - Subnet hints (15 points)
4. **Risk Analyze**: Calculate risk score (0-100) based on:
   - Vulnerability (35%): Device type, firmware, vendor
   - Configuration (25%): Encryption, default ports, protocols
   - Exposure (25%): Criticality, connection count, cross-zone traffic
   - Compliance (15%): NERC CIP, IEC 62443, NIST CSF
5. **Store**: Save discovered devices, connections, and alerts to PostgreSQL
6. **Snapshot**: Create topology snapshot for historical tracking

### Query Lambda

**Trigger**: API Gateway HTTP requests

**What it does**: Serves the REST API for querying topology data. See [Section 11](#11-api-endpoints).

### Export Lambda

**Trigger**: API Gateway or scheduled events

**What it does**: Generates reports (CSV, JSON) and stores them in S3.

### Manual Lambda Deployment

```bash
# Deploy all functions
./scripts/deploy-lambda.sh prod

# Deploy a specific function
./scripts/deploy-lambda.sh prod ingest
./scripts/deploy-lambda.sh prod process
./scripts/deploy-lambda.sh prod query
```

---

## 11. API Endpoints

The Query Lambda exposes these endpoints via API Gateway:

**Base URL**: `https://2qnqkyqo3h.execute-api.ap-south-1.amazonaws.com/prod`

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/topology` | Get current network topology snapshot |
| `GET` | `/devices` | List all discovered devices |
| `GET` | `/devices/{id}` | Get device details by ID |
| `POST` | `/devices/{id}/risk` | Trigger risk assessment for a device |
| `GET` | `/connections` | List all device connections |
| `GET` | `/alerts` | List security alerts |
| `POST` | `/alerts/{id}/acknowledge` | Acknowledge an alert |
| `GET` | `/zones` | List Purdue security zones |
| `GET` | `/export/topology` | Export topology report |
| `GET` | `/export/compliance` | Export compliance report |
| `GET` | `/health` | Health check |

### Query Parameters

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `level` | integer | Filter by Purdue level (0-5) | `?level=1` |
| `zone` | string | Filter by security zone | `?zone=control` |
| `status` | string | Filter by device status | `?status=ONLINE` |
| `limit` | integer | Pagination limit | `?limit=50` |
| `offset` | integer | Pagination offset | `?offset=100` |

### Example API Calls

```bash
# Get all devices
curl https://2qnqkyqo3h.execute-api.ap-south-1.amazonaws.com/prod/devices

# Get devices at Purdue Level 1 (PLCs)
curl "https://2qnqkyqo3h.execute-api.ap-south-1.amazonaws.com/prod/devices?level=1"

# Get current topology
curl https://2qnqkyqo3h.execute-api.ap-south-1.amazonaws.com/prod/topology

# Get active alerts
curl "https://2qnqkyqo3h.execute-api.ap-south-1.amazonaws.com/prod/alerts?status=ACTIVE"

# Health check
curl https://2qnqkyqo3h.execute-api.ap-south-1.amazonaws.com/prod/health
```

---

## 12. WebSocket Real-Time Updates

The WebSocket server pushes live updates to connected clients.

### Starting the WebSocket Server

```typescript
import { RealTimeServer } from './websocket/server';

const wsServer = new RealTimeServer(8080);
await wsServer.start();
```

### Connecting as a Client

```typescript
import { TopologyClient } from './websocket/client';

const client = new TopologyClient('ws://localhost:8080');
await client.connect();

// Subscribe to channels
client.subscribe('topology');
client.subscribe('alerts');
client.subscribe('devices');

// Listen for events
client.on('deviceAdded', (device) => {
  console.log('New device discovered:', device.hostname);
});

client.on('alertCreated', (alert) => {
  console.log('Security alert:', alert.severity, alert.message);
});

client.on('topologyChanged', (snapshot) => {
  console.log('Topology updated:', snapshot.deviceCount, 'devices');
});
```

### Available Channels

| Channel | Events |
|---------|--------|
| `topology` | topologyChanged, snapshotCreated |
| `devices` | deviceAdded, deviceUpdated, deviceOffline |
| `alerts` | alertCreated, alertAcknowledged, alertResolved |
| `connections` | connectionAdded, connectionRemoved |
| `telemetry` | dataReceived, batchProcessed |
| `system` | healthCheck, collectorStatus |

---

## 13. Grafana Dashboards

### Start Grafana

```bash
# Start Grafana with Docker
npm run grafana:start

# Or directly:
docker-compose -f grafana/docker-compose.yml up -d
```

**Access**: `http://localhost:3000`
**Default login**: admin / admin

**If dashboards show no data**: Run `./scripts/seed-database.sh` to load Purdue zones; optionally `./scripts/seed-database.sh --test-data` for full test data. Set dashboard time range to **Last 7 days** (or a range that includes your data).

### Available Dashboards

| Dashboard | File | Shows |
|-----------|------|-------|
| **Topology Overview** | `grafana/dashboards/topology-overview.json` | Network graph, device counts, connection map |
| **Security Alerts** | `grafana/alerts/security-alerts.yaml` | Alert timeline, severity breakdown, top sources |

### Data Source

Grafana connects directly to PostgreSQL:

```yaml
# Configured in grafana/datasources/postgres.yaml
type: postgres
host: ${DB_HOST}:${DB_PORT}
database: ${DB_NAME}
user: ${DB_USER}
```

### Example Grafana Queries

```sql
-- Device count by Purdue level
SELECT purdue_level, COUNT(*) as count
FROM devices
WHERE status = 'ONLINE'
GROUP BY purdue_level;

-- Recent alerts
SELECT severity, message, created_at
FROM alerts
WHERE created_at > NOW() - INTERVAL '24 hours'
ORDER BY created_at DESC;

-- Connection map
SELECT
  d1.hostname as source,
  d2.hostname as target,
  c.connection_type
FROM connections c
JOIN devices d1 ON c.source_device_id = d1.id
JOIN devices d2 ON c.target_device_id = d2.id;
```

---

## 14. Running Tests

### Unit Tests

```bash
# Run all unit tests
npm run test:unit

# Run specific test suites
npx jest tests/unit/processors/     # Processor tests
npx jest tests/unit/database/       # Database tests
npx jest tests/unit/utils/          # Utility tests

# Run with coverage
npm run test:coverage
```

### Integration Tests

Integration tests require Docker services (PostgreSQL, LocalStack, etc.):

```bash
# Start test infrastructure
docker-compose -f docker-compose.test.yml up -d

# Run all integration tests
npm run test:integration

# Run specific integration suites
npm run test:integration:database    # Database repository tests
npm run test:integration:lambda      # Lambda handler tests
npm run test:integration:collectors  # Collector tests
npm run test:integration:websocket   # WebSocket tests
npm run test:integration:e2e         # End-to-end workflow tests

# Stop test infrastructure
docker-compose -f docker-compose.test.yml down
```

### Security Tests

```bash
npm run test:security
```

Tests SNMPv3 authentication, SQL injection prevention, and security controls.

### Run Everything

```bash
npm run test:all
```

---

## 15. Production Deployment

### Full Deployment Checklist

```bash
# 1. Switch to prod workspace
cd infrastructure
terraform workspace select prod

# 2. Deploy infrastructure with production values
terraform apply \
  -var="environment=prod" \
  -var="db_instance_class=db.t3.medium" \
  -var="enable_deletion_protection=true" \
  -var="log_retention_days=90"

# 3. Run database migrations
./scripts/run-migrations.sh --seed

# 4. Generate IoT certificates
./scripts/generate-certs.sh prod-collector-01

# 5. Build and deploy Lambda functions
./scripts/deploy-lambda.sh prod

# 6. Update .env.production with Terraform outputs
terraform output

# 7. Verify deployment
./scripts/verify-prod.sh

# 8. Start Grafana
npm run grafana:start

# 9. Start collectors on the edge machine
npm run build && NODE_ENV=production npm start
```

### Production Environment Values

| Setting | Dev | Production |
|---------|-----|-----------|
| `NODE_ENV` | development | production |
| `LOG_LEVEL` | debug | info |
| `DB_INSTANCE_CLASS` | db.t3.micro | db.t3.medium |
| `DB_SSL` | false | true |
| `DB_POOL_SIZE` | 10 | 20 |
| `DELETION_PROTECTION` | false | true |
| `LOG_RETENTION_DAYS` | 30 | 90 |
| `TLS_MIN_VERSION` | TLSv1.2 | TLSv1.3 |

### CI/CD Pipeline

The project includes GitHub Actions workflows:

- **CI** (`.github/workflows/ci.yml`): Runs on every push - lint, build, test, security scan
- **Deploy** (`.github/workflows/deploy.yml`): Runs on push to `main` or manual trigger
  - Deploys infrastructure (Terraform)
  - Deploys Lambda functions
  - Runs database migrations
  - Executes smoke tests

---

## 16. Monitoring & Operations

### Health Check

```bash
# Run comprehensive health check
./scripts/health-check.sh

# JSON output for automation
JSON_OUTPUT=1 ./scripts/health-check.sh

# Exit codes: 0=healthy, 1=degraded, 2=failed
```

Checks: Database, Lambda functions, API Gateway, WebSocket, CloudWatch alarms, RDS, S3, disk/memory.

### AWS Cost Tracking

```bash
# Default: last 30 days
./scripts/cost-tracker.sh

# Custom period
DAYS=7 ./scripts/cost-tracker.sh

# With budget alert
BUDGET_LIMIT=2000 ./scripts/cost-tracker.sh
```

### Database Backup

```bash
# Create RDS snapshot + config backup to S3
./scripts/backup-database.sh

# Custom retention
RETENTION_DAYS=30 ./scripts/backup-database.sh

# Dry run (preview only)
DRY_RUN=1 ./scripts/backup-database.sh
```

### Production Verification

```bash
# Verify all 12 production resources
./scripts/verify-prod.sh

# Checks: Lambda (x3), RDS, API Gateway, CloudWatch, S3, IoT, VPC, Secrets Manager, Terraform state
```

### CloudWatch Dashboard

Access at: `https://ap-south-1.console.aws.amazon.com/cloudwatch/home?region=ap-south-1#dashboards:name=scada-prod-dashboard`

### CloudWatch Alarms (17 total)

| Alarm | Threshold |
|-------|-----------|
| Lambda errors (x3) | > 5 errors in 5 min |
| Lambda throttles (x3) | > 0 throttles |
| Lambda concurrent (x3) | > 100 concurrent |
| API 4xx errors | > 50 in 5 min |
| API 5xx errors | > 10 in 5 min |
| API latency | > 3000ms p99 |
| RDS CPU | > 80% |
| RDS connections | > 80 |
| RDS storage | < 5 GB free |
| RDS read latency | > 20ms |
| RDS write latency | > 50ms |

---

## 17. Common Workflows

### Workflow 1: Discover a New Network Segment

```bash
# 1. Add SNMP targets for the new segment
# Edit your collector configuration to include new device IPs

# 2. Start collectors
npm run collector:start

# 3. Wait for discovery cycle (default: 60 seconds)

# 4. Check discovered devices via API
curl https://your-api-endpoint/prod/devices

# 5. View in Grafana
open http://localhost:3000
```

### Workflow 2: Investigate a Security Alert

```bash
# 1. Check active alerts
curl "https://your-api-endpoint/prod/alerts?status=ACTIVE"

# 2. Get alert details
curl "https://your-api-endpoint/prod/alerts/{alert-id}"

# 3. Check the affected device
curl "https://your-api-endpoint/prod/devices/{device-id}"

# 4. Acknowledge the alert
curl -X POST "https://your-api-endpoint/prod/alerts/{alert-id}/acknowledge"
```

### Workflow 3: Generate Compliance Report

```bash
# Export topology for compliance audit
curl "https://your-api-endpoint/prod/export/compliance" > compliance-report.json

# Export full device inventory
curl "https://your-api-endpoint/prod/export/topology" > topology-export.json
```

### Workflow 4: Add a New PLC to Monitoring

```typescript
// In your collector configuration:
const manager = getCollectorManager();

// Add via SNMP (if PLC supports SNMPv3)
manager.getCollector('snmp').addSNMPTarget('10.0.1.50', 'plc-user', {
  securityLevel: 'authPriv',
  authProtocol: 'SHA',
  authKey: 'auth-password',
  privProtocol: 'AES',
  privKey: 'priv-password',
});

// Add via Modbus (if PLC uses Modbus TCP)
manager.getCollector('modbus').addTarget({
  host: '10.0.1.50',
  port: 502,
  unitId: 1,
  registers: [
    { name: 'Status', address: 0, length: 1, type: 'coil' },
    { name: 'Temperature', address: 100, length: 2, type: 'holding', dataType: 'float32' }
  ]
});
```

---

## 18. Troubleshooting

### Collectors Not Finding Devices

```bash
# Check SNMP connectivity manually
snmpget -v3 -l authPriv -u <user> -a SHA -A <auth-pass> -x AES -X <priv-pass> <target-ip> 1.3.6.1.2.1.1.1.0

# Check network connectivity
ping <target-ip>
telnet <target-ip> 161
```

### Lambda Errors

```bash
# Check CloudWatch logs
aws logs tail /aws/lambda/scada-prod-ingest --follow
aws logs tail /aws/lambda/scada-prod-process --follow
aws logs tail /aws/lambda/scada-prod-query --follow
```

### Database Connection Issues

```bash
# Test RDS connectivity
psql -h <rds-endpoint> -U scada_admin -d scada_topology -c "SELECT 1"

# Check active connections
psql -c "SELECT count(*) FROM pg_stat_activity WHERE datname = 'scada_topology'"
```

### API Gateway 500 Errors

```bash
# Check the query Lambda logs
aws logs tail /aws/lambda/scada-prod-query --follow --since 5m

# Test with verbose curl
curl -v https://your-api-endpoint/prod/health
```

For detailed troubleshooting, see `docs/troubleshooting.md` (12+ procedures).

---

## 19. Project Structure

```
Secure-Network-Topology-for-SCADA-ICS/
|
+-- src/                          # Source code
|   +-- collectors/               # Edge telemetry collectors
|   |   +-- base-collector.ts     #   Abstract base (polling, retry, batching)
|   |   +-- snmp-collector.ts     #   SNMPv3 device discovery
|   |   +-- arp-collector.ts      #   ARP/MAC table collection
|   |   +-- netflow-collector.ts  #   NetFlow v5/v9 listener
|   |   +-- syslog-collector.ts   #   Syslog event listener
|   |   +-- routing-collector.ts  #   Routing table discovery
|   |   +-- opcua-collector.ts    #   OPC-UA industrial protocol
|   |   +-- modbus-collector.ts   #   Modbus TCP/RTU
|   |   +-- collector-manager.ts  #   Orchestrator for all collectors
|   |
|   +-- processors/               # Data processing pipeline
|   |   +-- parsers/              #   Source-specific parsers
|   |   |   +-- snmp-parser.ts
|   |   |   +-- arp-parser.ts
|   |   |   +-- netflow-parser.ts
|   |   |   +-- syslog-parser.ts
|   |   +-- correlation/          #   Cross-source device matching
|   |   |   +-- device-correlator.ts
|   |   |   +-- topology-builder.ts
|   |   +-- classification/       #   Purdue Model assignment
|   |   |   +-- purdue-classifier.ts
|   |   +-- risk/                 #   Risk scoring engine
|   |       +-- risk-analyzer.ts
|   |
|   +-- lambda/                   # AWS Lambda handlers
|   |   +-- ingest/handler.ts     #   Telemetry ingestion
|   |   +-- process/handler.ts    #   Processing pipeline
|   |   +-- query/handler.ts      #   REST API
|   |   +-- export/handler.ts     #   Report generation
|   |
|   +-- websocket/                # Real-time updates
|   |   +-- server.ts             #   WebSocket server
|   |   +-- client.ts             #   Client library
|   |
|   +-- database/                 # Data access layer
|   |   +-- connection.ts         #   PostgreSQL connection pool
|   |   +-- repositories/         #   CRUD operations
|   |   |   +-- device.repository.ts
|   |   |   +-- connection.repository.ts
|   |   |   +-- alert.repository.ts
|   |   |   +-- telemetry.repository.ts
|   |   |   +-- topology-snapshot.repository.ts
|   |   +-- services/             #   Business logic
|   |       +-- device.service.ts
|   |       +-- topology.service.ts
|   |       +-- alert.service.ts
|   |       +-- export.service.ts
|   |
|   +-- utils/                    # Shared utilities
|       +-- config.ts             #   Environment configuration
|       +-- constants.ts          #   Purdue levels, OIDs, ports
|       +-- crypto.ts             #   Encryption utilities
|       +-- validators.ts         #   Input validation (Zod)
|       +-- error-handler.ts      #   Global error handling
|       +-- mqtt-client.ts        #   MQTT/IoT Core client
|
+-- database/                     # Database schemas
|   +-- migrations/               #   SQL migration files (001-008)
|   +-- seeds/                    #   Seed data (Purdue zones)
|
+-- infrastructure/               # Terraform IaC
|   +-- main.tf                   #   Root module (VPC, IoT, Lambda, RDS, S3, CloudWatch)
|   +-- variables.tf              #   Input variables
|   +-- outputs.tf                #   Output values
|   +-- modules/                  #   Sub-modules (vpc, iot, lambda, rds, s3, cloudwatch)
|   +-- bootstrap/                #   First-time backend setup
|
+-- grafana/                      # Visualization
|   +-- docker-compose.yml        #   Grafana container
|   +-- dashboards/               #   Dashboard JSON definitions
|   +-- datasources/              #   PostgreSQL data source
|   +-- alerts/                   #   Alert rule definitions
|
+-- scripts/                      # Operational scripts
|   +-- deploy-lambda.sh          #   Lambda deployment
|   +-- run-migrations.sh         #   Database migrations
|   +-- generate-certs.sh         #   IoT X.509 certificates
|   +-- health-check.sh           #   System health monitoring
|   +-- cost-tracker.sh           #   AWS cost analysis
|   +-- backup-database.sh        #   RDS backup management
|   +-- verify-prod.sh            #   Production verification
|
+-- tests/                        # Test suites
|   +-- unit/                     #   Unit tests
|   +-- integration/              #   Integration tests (needs Docker)
|   +-- security/                 #   Security tests
|
+-- docs/                         # Documentation
|   +-- architecture.md           #   System architecture
|   +-- deployment.md             #   Deployment guide
|   +-- security-hardening.md     #   Security configuration
|   +-- troubleshooting.md        #   Issue resolution (12+ procedures)
|   +-- runbook.md                #   Operational procedures
|
+-- .github/workflows/            # CI/CD
|   +-- ci.yml                    #   Build, test, lint
|   +-- deploy.yml                #   AWS deployment pipeline
|
+-- .env.example                  # Environment template
+-- package.json                  # Dependencies and scripts
+-- tsconfig.json                 # TypeScript configuration
+-- jest.config.js                # Unit test configuration
+-- jest.integration.config.js    # Integration test configuration
```

---

## 20. Security Considerations

### Protocol Security

| Protocol | Security Measure |
|----------|-----------------|
| SNMP | **v3 only** with authPriv (SHA + AES encryption) |
| MQTT | TLS 1.3 with X.509 certificate authentication |
| Database | SSL/TLS, parameterized queries, connection pooling |
| API | API Gateway with rate limiting, CORS |
| WebSocket | Origin validation, message authentication |

### Network Security

- Collectors deployed at OT network edge (no inbound internet)
- AWS resources in private VPC subnets
- NAT Gateway for outbound traffic only
- Security groups restrict access by port and source

### Data Protection

- AES-256 encryption at rest (RDS, S3)
- TLS 1.3 encryption in transit
- AWS Secrets Manager for credentials
- No hardcoded secrets in code

### Compliance Alignment

- **NIST CSF**: Identify, Protect, Detect, Respond, Recover
- **IEC 62443**: Industrial automation security
- **NERC CIP**: Critical infrastructure protection
- **CIS Controls**: Security benchmarks

For the complete security hardening guide, see `docs/security-hardening.md`.

---

## Quick Reference: npm Scripts

| Command | What It Does |
|---------|-------------|
| `npm run build` | Compile TypeScript to JavaScript |
| `npm run dev` | Start in development mode (ts-node) |
| `npm start` | Start in production mode (compiled JS) |
| `npm run collector:start` | Start all telemetry collectors |
| `npm run deploy:lambda` | Build and deploy Lambda functions |
| `npm run migrate` | Run database migrations |
| `npm run grafana:start` | Start Grafana via Docker |
| `npm test` | Run unit tests |
| `npm run test:unit` | Run unit tests only |
| `npm run test:integration` | Run integration tests (needs Docker) |
| `npm run test:security` | Run security tests |
| `npm run test:coverage` | Run tests with coverage report |
| `npm run test:all` | Run all test suites |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |
| `npm run clean` | Delete build output |

---

## Quick Reference: Key Ports

| Port | Service | Protocol |
|------|---------|----------|
| 161 | SNMP (target devices) | UDP |
| 514 | Syslog listener | UDP/TCP |
| 2055 | NetFlow listener | UDP |
| 502 | Modbus (target devices) | TCP |
| 4840 | OPC-UA (target devices) | TCP |
| 5432 | PostgreSQL | TCP |
| 3000 | Grafana | HTTP |
| 8080 | WebSocket server | WS |
| 8883 | MQTT (AWS IoT Core) | TLS |

---

**For more details, see:**
- Architecture: `docs/architecture.md`
- Deployment: `docs/deployment.md`
- Security: `docs/security-hardening.md`
- Troubleshooting: `docs/troubleshooting.md`
- Operations: `docs/runbook.md`

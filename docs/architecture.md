# SCADA Topology Discovery - Architecture

## Overview

This document describes the architecture of the Secure Automatic Network Topology Creation system for SCADA/ICS environments.

## System Components

### 1. Edge Collection Layer

**Telemetry Collectors**
- **SNMPv3 Collector**: Secure device discovery using SNMPv3 (authPriv)
- **ARP/MAC Collector**: Layer 2 connectivity discovery
- **NetFlow Collector**: Traffic flow analysis (v5/v9)
- **Syslog Collector**: Security event collection (RFC 5424)
- **Routing Collector**: Layer 3 topology discovery

**Security Features**
- All collectors use authenticated protocols
- TLS 1.3 for MQTT communication
- No reliance on insecure discovery protocols (CDP/LLDP)

### 2. Cloud Processing Layer (AWS)

**AWS IoT Core**
- Receives telemetry via MQTT over TLS
- Certificate-based device authentication
- Message routing to Lambda functions

**Lambda Functions**
- `ingest`: Validates and stores incoming telemetry
- `process`: Correlation, classification, and risk analysis
- `query`: API for topology queries
- `export`: Report generation and data export

**Data Storage**
- **PostgreSQL (RDS)**: Device inventory, connections, alerts
- **S3**: Telemetry archives, reports, topology snapshots

### 3. Data Processing Pipeline

```
Telemetry → Parsers → Correlation → Classification → Risk Analysis → Storage
```

**Parsers**: Normalize data from different sources
**Correlation**: Match device identities across sources
**Classification**: Assign Purdue levels and security zones
**Risk Analysis**: Score vulnerabilities and compliance

### 4. Visualization Layer

**Grafana Dashboards**
- Topology overview with node graph
- Security alerts dashboard
- Compliance status
- Traffic analysis

## Data Flow

1. Edge collectors gather telemetry from OT devices
2. Data published to AWS IoT Core via TLS MQTT
3. IoT Rules trigger Lambda for processing
4. Correlated data stored in PostgreSQL
5. Grafana queries database for visualization

## Security Architecture

### Network Segmentation
- Collectors deployed in OT network edge
- AWS resources in private VPC subnets
- NAT Gateway for outbound traffic
- No inbound internet access to OT network

### Authentication & Authorization
- SNMPv3 with authPriv for device queries
- X.509 certificates for IoT authentication
- IAM roles with least-privilege access
- Secrets Manager for credentials

### Data Protection
- TLS 1.3 for all communications
- AES-256 encryption at rest
- Database encryption enabled
- Audit logging for compliance

## Purdue Model Mapping

| Level | Components | Security Zone |
|-------|------------|---------------|
| 0 | Sensors, Actuators | Process |
| 1 | PLCs, RTUs, DCS | Control |
| 2 | SCADA, HMI | Supervisory |
| 3 | MES, Historians | Operations |
| DMZ | Firewalls, Proxies | DMZ |
| 4-5 | Enterprise Systems | Enterprise |

## Scalability

- Serverless Lambda auto-scales with load
- RDS Multi-AZ for high availability
- S3 for unlimited telemetry storage
- Partitioned tables for query performance

## Deployment

See [deployment.md](deployment.md) for installation instructions.

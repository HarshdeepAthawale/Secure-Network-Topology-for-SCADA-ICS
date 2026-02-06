# SCADA/ICS Network Topology Discovery System

## Executive Summary

This project implements a **Secure Automatic Network Topology Creation** system for SCADA (Supervisory Control and Data Acquisition) and ICS (Industrial Control Systems) environments. It provides real-time visibility into OT (Operational Technology) network infrastructure through passive and authenticated telemetry collection.

---

## Problem Statement

Industrial control systems face critical security challenges:

1. **Visibility Gap**: Most organizations don't know what devices are on their OT networks
2. **Insecure Discovery**: Traditional network discovery (CDP, LLDP) uses unencrypted protocols
3. **Compliance Requirements**: IEC 62443, NERC CIP, and other standards require asset inventory
4. **Attack Surface Unknown**: Can't protect what you can't see
5. **Legacy Systems**: Many SCADA devices run outdated firmware with known vulnerabilities

---

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SCADA/ICS ENVIRONMENT                              │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐      │
│  │   PLCs   │  │   RTUs   │  │   HMIs   │  │ Switches │  │ Firewalls│      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘      │
│       │             │             │             │             │             │
│       └─────────────┴─────────────┴─────────────┴─────────────┘             │
│                                   │                                          │
│                    ┌──────────────┴──────────────┐                          │
│                    │     EDGE COLLECTOR (OT)     │                          │
│                    │  ┌─────────────────────────┐│                          │
│                    │  │ SNMPv3 | ARP | NetFlow  ││                          │
│                    │  │ Syslog | Routing Tables ││                          │
│                    │  └─────────────────────────┘│                          │
│                    └──────────────┬──────────────┘                          │
│                                   │ TLS 1.3 / MQTT                          │
└───────────────────────────────────┼─────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼─────────────────────────────────────────┐
│                              AWS CLOUD                                       │
│                                   │                                          │
│                    ┌──────────────┴──────────────┐                          │
│                    │        AWS IoT CORE         │                          │
│                    │   Certificate-Based Auth    │                          │
│                    └──────────────┬──────────────┘                          │
│                                   │                                          │
│     ┌─────────────────────────────┼─────────────────────────────────┐       │
│     │                             │                                  │       │
│ ┌───┴───┐  ┌───────────┐  ┌──────┴──────┐  ┌───────────┐  ┌───────┐│       │
│ │Ingest │  │  Process  │  │   Query     │  │  Export   │  │  S3   ││       │
│ │Lambda │→ │  Lambda   │→ │   Lambda    │  │  Lambda   │  │Bucket ││       │
│ └───────┘  └─────┬─────┘  └─────────────┘  └───────────┘  └───────┘│       │
│                  │                                                   │       │
│           ┌──────┴──────┐                                           │       │
│           │  PostgreSQL │                                           │       │
│           │   (RDS)     │                                           │       │
│           └──────┬──────┘                                           │       │
│                  │                                                   │       │
└──────────────────┼───────────────────────────────────────────────────┘
                   │
           ┌───────┴───────┐
           │    GRAFANA    │
           │  Dashboards   │
           └───────────────┘
```

---

## Key Features

### 1. Secure Telemetry Collection

| Protocol | Security | Purpose |
|----------|----------|---------|
| **SNMPv3** | authPriv (SHA/AES) | Device discovery, system info |
| **ARP/MAC** | Local network only | Layer 2 topology mapping |
| **NetFlow v5/v9** | Flow records | Traffic analysis, connections |
| **Syslog RFC 5424** | TLS transport | Security event collection |
| **Routing Tables** | Authenticated | Layer 3 topology discovery |

### 2. Purdue Model Classification

Automatically classifies devices into ICS security levels:

| Level | Description | Example Devices |
|-------|-------------|-----------------|
| **Level 0** | Physical Process | Sensors, Actuators, Motors |
| **Level 1** | Basic Control | PLCs, RTUs, DCS Controllers |
| **Level 2** | Supervisory | SCADA Servers, HMI Stations |
| **Level 3** | Operations | Historians, MES, Engineering |
| **DMZ** | Security Buffer | Firewalls, Jump Servers, Proxies |
| **Level 4-5** | Enterprise | Business Systems, Internet |

### 3. Multi-Source Correlation

The system correlates device identity across multiple data sources:

```
Device A (PLC):
  ├── SNMP: sysName="PLC-MAIN-01", MAC=00:1A:2B:3C:4D:5E
  ├── ARP: IP=10.10.1.50 → MAC=00:1A:2B:3C:4D:5E
  ├── NetFlow: 10.10.1.50 → Modbus traffic (port 502)
  └── Syslog: Authentication from 10.10.1.50

  → CORRELATED: Single device with high confidence score
```

### 4. Risk Assessment

Each device receives a risk score based on:

- **Vulnerability Score**: Known CVEs, firmware age
- **Configuration Score**: Default credentials, insecure protocols
- **Exposure Score**: Network position, reachability
- **Compliance Score**: Alignment with IEC 62443, NERC CIP

### 5. Real-Time Visualization

Grafana dashboards provide:

- **Network Topology Graph**: Interactive node visualization
- **Security Alerts**: Real-time threat notifications
- **Compliance Status**: Zone violations, policy enforcement
- **Traffic Analysis**: Protocol distribution, anomalies

---

## Technology Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Protocols**: SNMPv3, MQTT/TLS, Syslog, NetFlow

### Cloud Infrastructure (AWS)
- **IoT Core**: MQTT message broker with X.509 auth
- **Lambda**: Serverless processing (ingest, process, query, export)
- **RDS PostgreSQL**: Time-series storage, partitioned tables
- **S3**: Telemetry archives, topology snapshots
- **CloudWatch**: Monitoring, alerting

### Visualization
- **Grafana**: Node Graph, time-series, alerting
- **PostgreSQL Data Source**: Direct database queries

### Infrastructure as Code
- **Terraform**: AWS resource provisioning
- **Docker**: Local development environment

---

## Data Flow

1. **Collection**: Edge collectors poll OT devices using SNMPv3
2. **Transport**: Telemetry published to AWS IoT Core via TLS 1.3
3. **Ingestion**: Lambda validates and queues data
4. **Processing**: Correlation engine matches device identities
5. **Classification**: Purdue level assignment with ML confidence
6. **Risk Analysis**: Vulnerability and exposure scoring
7. **Storage**: PostgreSQL for queries, S3 for archives
8. **Visualization**: Grafana pulls from PostgreSQL

---

## Security Measures

### Network Security
- ✅ No reliance on insecure discovery (CDP/LLDP)
- ✅ TLS 1.3 for all communications
- ✅ Certificate-based IoT authentication
- ✅ VPC isolation with private subnets
- ✅ NAT Gateway for outbound-only traffic

### Data Security
- ✅ AES-256 encryption at rest
- ✅ SNMPv3 authPriv (authentication + privacy)
- ✅ AWS Secrets Manager for credentials
- ✅ Database encryption enabled

### Access Control
- ✅ IAM least-privilege policies
- ✅ No direct OT network ingress
- ✅ Audit logging for compliance

---

## Compliance Alignment

| Standard | Relevant Requirements | How We Help |
|----------|----------------------|-------------|
| **IEC 62443** | Asset inventory, zone segmentation | Automated discovery, Purdue classification |
| **NERC CIP** | Cyber asset identification | Complete device registry |
| **NIST CSF** | Identify, Protect functions | Continuous monitoring, risk scoring |
| **ISA/IEC 62443** | Security levels, zones | Automatic zone assignment |

---

## Scalability

- **Serverless**: Lambda auto-scales with load
- **Multi-AZ RDS**: High availability database
- **Partitioned Tables**: Efficient time-series queries
- **S3 Lifecycle**: Automatic data tiering (Standard → IA → Glacier)

---

## Deployment Models

### Cloud-Native (Recommended)
Full AWS deployment with managed services

### Hybrid
Edge collectors on-premise, processing in AWS

### Air-Gapped
Self-hosted version for isolated networks (future)

---

## Getting Started

### Prerequisites
- AWS Account with appropriate permissions
- Node.js 18+
- Terraform 1.5+
- Docker (for local Grafana)

### Quick Start

```bash
# 1. Clone repository
git clone <repository-url>
cd scada-topology-discovery

# 2. Install dependencies
npm install

# 3. Bootstrap AWS infrastructure (S3 state bucket)
./scripts/bootstrap-infrastructure.sh

# 4. Deploy main infrastructure
./scripts/deploy-infrastructure.sh dev apply

# 5. Generate IoT certificates
./scripts/generate-certs.sh collector-01

# 6. Run database migrations
./scripts/run-migrations.sh --seed

# 7. Start collectors
npm run collector:start
```

---

## Future Roadmap

- [ ] Machine learning for device fingerprinting
- [ ] Automated vulnerability correlation (CVE matching)
- [ ] Integration with SIEM platforms
- [ ] Support for additional protocols (OPC-UA, Modbus)
- [ ] Kubernetes deployment option
- [ ] Air-gapped deployment package

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

---

## License

MIT License - See [LICENSE](LICENSE) for details.

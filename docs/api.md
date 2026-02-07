# SCADA/ICS Network Topology Discovery - API Documentation

**Version**: 1.0.0
**Last Updated**: February 2024

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Base URL](#base-url)
4. [Quick Start](#quick-start)
5. [Endpoints](#endpoints)
6. [WebSocket Documentation](#websocket-documentation)
7. [Export Formats](#export-formats)
8. [Rate Limiting](#rate-limiting)
9. [Error Handling](#error-handling)
10. [Code Examples](#code-examples)

---

## Overview

The SCADA/ICS Network Topology Discovery API provides programmatic access to:

- **Device Discovery**: Automated discovery of SCADA, ICS, and industrial devices
- **Network Topology**: Complete visibility into network structure and connections
- **Security Monitoring**: Real-time alerts and risk assessments
- **Compliance Reporting**: Standards-aligned reports (IEC 62443, NERC CIP, NIST CSF)
- **Real-time Updates**: WebSocket streaming for live topology changes
- **Data Export**: Multiple format support for integration and analysis

The API is built on AWS Lambda and API Gateway for scalability and reliability.

---

## Authentication

### API Key Authentication

All endpoints (except `/health`) require authentication using an API key.

**Header**: `X-API-Key`

```bash
curl -X GET https://api.example.com/v1/devices \
  -H "X-API-Key: your-api-key-here"
```

### Obtaining an API Key

1. Contact your system administrator
2. Generate a key from the management dashboard
3. Store it securely (use environment variables)
4. Rotate keys periodically for security

### Bearer Token (Optional)

For integration with OAuth2 systems:

```bash
curl -X GET https://api.example.com/v1/devices \
  -H "Authorization: Bearer your-jwt-token"
```

---

## Base URL

```
https://{api-gateway-id}.execute-api.{region}.amazonaws.com/v1
```

**Example**:
```
https://a1b2c3d4.execute-api.us-west-2.amazonaws.com/v1
```

Replace placeholders with your AWS API Gateway details.

---

## Quick Start

### 1. Check API Health

```bash
curl -X GET https://api.example.com/v1/health
```

Response:
```json
{
  "status": "ok",
  "timestamp": "2024-02-08T10:30:00Z",
  "version": "1.0.0"
}
```

### 2. List All Devices

```bash
curl -X GET https://api.example.com/v1/devices \
  -H "X-API-Key: your-api-key"
```

### 3. Get Device Details

```bash
curl -X GET https://api.example.com/v1/devices/123e4567-e89b-12d3-a456-426614174000 \
  -H "X-API-Key: your-api-key"
```

### 4. View Active Alerts

```bash
curl -X GET https://api.example.com/v1/alerts?severity=critical&acknowledged=false \
  -H "X-API-Key: your-api-key"
```

---

## Endpoints

### Topology Endpoints

#### Get Current Topology

```http
GET /topology?format=json
```

Retrieve the complete current network topology snapshot.

**Query Parameters:**
- `format` (optional): Response format - `json` or `graphml`. Default: `json`

**Response (200 OK)**:
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2024-02-08T10:30:00Z",
  "devices": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "PLC-01",
      "type": "plc",
      "vendor": "Siemens",
      "purdueLevel": 1,
      "securityZone": "control",
      "status": "online",
      "lastSeenAt": "2024-02-08T10:30:00Z"
    }
  ],
  "connections": [
    {
      "id": "650e8400-e29b-41d4-a716-446655440000",
      "sourceDeviceId": "123e4567-e89b-12d3-a456-426614174000",
      "targetDeviceId": "223e4567-e89b-12d3-a456-426614174000",
      "connectionType": "ethernet",
      "protocol": "profinet",
      "isSecure": false
    }
  ],
  "zones": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440000",
      "name": "control",
      "description": "Control layer devices",
      "purdueLevel": 1,
      "deviceCount": 15
    }
  ],
  "metadata": {
    "deviceCount": 150,
    "connectionCount": 280,
    "alertCount": 5,
    "criticalAlertCount": 1
  }
}
```

---

### Device Endpoints

#### List All Devices

```http
GET /devices?limit=20&offset=0&level=1&status=online
```

Retrieve a paginated list of discovered devices.

**Query Parameters:**
- `limit` (optional): Results per page. Default: 20, Max: 100
- `offset` (optional): Number of results to skip. Default: 0
- `level` (optional): Purdue level filter (0-5, 99). See [Purdue Model](#purdue-model)
- `zone` (optional): Security zone filter
- `status` (optional): Device status (online, offline, degraded, maintenance, unknown)
- `type` (optional): Device type filter (plc, rtu, sensor, switch, etc.)
- `vendor` (optional): Manufacturer filter (Siemens, Schneider, etc.)

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "name": "PLC-01",
      "hostname": "plc-01.domain.local",
      "type": "plc",
      "vendor": "Siemens",
      "model": "S7-1200",
      "firmwareVersion": "4.2.1",
      "serialNumber": "SN123456789",
      "purdueLevel": 1,
      "securityZone": "control",
      "status": "online",
      "location": {
        "site": "Main Plant",
        "building": "Building A",
        "floor": "2",
        "room": "Control Room"
      },
      "lastSeenAt": "2024-02-08T10:30:00Z",
      "discoveredAt": "2024-01-15T08:00:00Z",
      "createdAt": "2024-01-15T08:00:00Z",
      "updatedAt": "2024-02-08T10:30:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 150,
    "hasMore": true
  }
}
```

#### Get Device Details

```http
GET /devices/{deviceId}
```

Retrieve comprehensive details for a specific device.

**Path Parameters:**
- `deviceId`: Device UUID

**Response (200 OK)**: Same as above single device object

**Error Responses:**
- `401 Unauthorized`: Invalid or missing API key
- `404 Not Found`: Device not found
- `500 Internal Server Error`: Server error

---

#### Get Device Risk Assessment

```http
GET /devices/{deviceId}/risk
```

Retrieve the current risk assessment for a device.

**Path Parameters:**
- `deviceId`: Device UUID

**Response (200 OK)**:
```json
{
  "deviceId": "123e4567-e89b-12d3-a456-426614174000",
  "overallScore": 62,
  "vulnerabilityScore": 45,
  "configurationScore": 58,
  "exposureScore": 75,
  "complianceScore": 68,
  "factors": [
    {
      "name": "Outdated Firmware",
      "category": "vulnerability",
      "score": 45,
      "impact": "high",
      "evidence": "Device firmware version 3.1.0 released 18 months ago"
    },
    {
      "name": "Weak Encryption",
      "category": "configuration",
      "score": 58,
      "impact": "high",
      "evidence": "Device uses WEP encryption instead of WPA2"
    },
    {
      "name": "Exposed to Internet",
      "category": "exposure",
      "score": 75,
      "impact": "critical",
      "evidence": "Device accessible from DMZ without firewall rules"
    }
  ],
  "recommendations": [
    "Update firmware to latest version (v4.2.1)",
    "Enable WPA2/WPA3 encryption",
    "Restrict internet access via firewall rules",
    "Implement network segmentation",
    "Enable logging and monitoring"
  ],
  "assessedAt": "2024-02-08T10:30:00Z"
}
```

---

### Connection Endpoints

#### List Network Connections

```http
GET /connections?limit=20&offset=0&protocol=modbus&secure=false
```

Retrieve a paginated list of network connections.

**Query Parameters:**
- `limit` (optional): Results per page. Default: 20, Max: 100
- `offset` (optional): Number of results to skip. Default: 0
- `deviceId` (optional): Filter by source or target device UUID
- `protocol` (optional): Filter by protocol (modbus, profinet, ethernet, etc.)
- `secure` (optional): Filter by security status (true/false)

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "650e8400-e29b-41d4-a716-446655440000",
      "sourceDeviceId": "123e4567-e89b-12d3-a456-426614174000",
      "targetDeviceId": "223e4567-e89b-12d3-a456-426614174000",
      "sourceInterface": "eth0",
      "targetInterface": "eth1",
      "connectionType": "ethernet",
      "protocol": "profinet",
      "port": 34962,
      "vlanId": 100,
      "bandwidthMbps": 100,
      "latencyMs": 2.5,
      "isSecure": false,
      "encryptionType": null,
      "discoveredAt": "2024-01-15T08:00:00Z",
      "lastSeenAt": "2024-02-08T10:30:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 280,
    "hasMore": true
  }
}
```

#### Get Connection Details

```http
GET /connections/{connectionId}
```

Retrieve details for a specific connection.

**Path Parameters:**
- `connectionId`: Connection UUID

**Response (200 OK)**: Single connection object (same structure as list response)

---

### Alert Endpoints

#### List Security Alerts

```http
GET /alerts?limit=20&offset=0&severity=critical&acknowledged=false
```

Retrieve a paginated list of security alerts.

**Query Parameters:**
- `limit` (optional): Results per page. Default: 20, Max: 100
- `offset` (optional): Number of results to skip. Default: 0
- `severity` (optional): Alert level (critical, high, medium, low, info)
- `type` (optional): Alert type (security, connectivity, compliance, performance, configuration)
- `acknowledged` (optional): Filter by acknowledgment status (true/false)
- `resolved` (optional): Filter by resolution status (true/false)
- `deviceId` (optional): Filter alerts for a specific device

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "850e8400-e29b-41d4-a716-446655440000",
      "type": "security",
      "severity": "critical",
      "title": "Unencrypted Protocol Detected",
      "description": "Device is using Modbus TCP without encryption",
      "deviceId": "123e4567-e89b-12d3-a456-426614174000",
      "connectionId": null,
      "acknowledged": false,
      "acknowledgedBy": null,
      "acknowledgedAt": null,
      "resolved": false,
      "resolvedAt": null,
      "remediation": "Enable Modbus over TLS or use a proxy with encryption",
      "details": {
        "protocol": "modbus",
        "port": 502,
        "sourceIp": "192.168.1.100"
      },
      "createdAt": "2024-02-08T09:45:00Z"
    }
  ],
  "pagination": {
    "limit": 20,
    "offset": 0,
    "total": 12,
    "hasMore": false
  },
  "summary": {
    "total": 12,
    "critical": 1,
    "high": 3,
    "medium": 5,
    "low": 2,
    "info": 1,
    "acknowledged": 4,
    "unacknowledged": 8
  }
}
```

#### Get Alert Details

```http
GET /alerts/{alertId}
```

Retrieve details for a specific alert.

**Path Parameters:**
- `alertId`: Alert UUID

**Response (200 OK)**: Single alert object (same structure as list response)

---

#### Acknowledge Alert

```http
PUT /alerts/{alertId}/acknowledge
```

Mark an alert as acknowledged by a user.

**Path Parameters:**
- `alertId`: Alert UUID

**Request Body**:
```json
{
  "reason": "In progress - scheduled maintenance window planned for 2024-02-15"
}
```

**Response (200 OK)**:
```json
{
  "id": "850e8400-e29b-41d4-a716-446655440000",
  "type": "security",
  "severity": "critical",
  "title": "Unencrypted Protocol Detected",
  "description": "Device is using Modbus TCP without encryption",
  "deviceId": "123e4567-e89b-12d3-a456-426614174000",
  "acknowledged": true,
  "acknowledgedBy": "admin@example.com",
  "acknowledgedAt": "2024-02-08T10:30:00Z",
  "resolved": false,
  "remediation": "Enable Modbus over TLS or use a proxy with encryption",
  "createdAt": "2024-02-08T09:45:00Z"
}
```

---

### Zone Endpoints

#### List Security Zones

```http
GET /zones
```

Retrieve all configured security zones based on the Purdue model.

**Response (200 OK)**:
```json
{
  "data": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440000",
      "name": "process",
      "description": "Process layer - sensors and actuators (Purdue Level 0)",
      "purdueLevel": 0,
      "deviceCount": 45
    },
    {
      "id": "751e8400-e29b-41d4-a716-446655440000",
      "name": "control",
      "description": "Control layer - PLCs and RTUs (Purdue Level 1)",
      "purdueLevel": 1,
      "deviceCount": 15
    },
    {
      "id": "752e8400-e29b-41d4-a716-446655440000",
      "name": "supervisory",
      "description": "Supervisory layer - SCADA servers (Purdue Level 2)",
      "purdueLevel": 2,
      "deviceCount": 5
    }
  ]
}
```

---

### Export Endpoints

#### Export Topology Report

```http
GET /export/topology?format=json
```

Export the current topology in various formats.

**Query Parameters:**
- `format` (required): Export format - json, csv, xml, or graphml

**Response (200 OK)**: File download with appropriate content type

**Example - JSON Export**:
```json
{
  "exportedAt": "2024-02-08T10:30:00Z",
  "format": "json",
  "devices": [...],
  "connections": [...],
  "zones": [...]
}
```

**Example - CSV Export**:
```csv
DeviceId,Name,Type,Vendor,PurdueLevel,Status,LastSeen
123e4567-e89b-12d3-a456-426614174000,PLC-01,plc,Siemens,1,online,2024-02-08T10:30:00Z
```

---

#### Export Compliance Report

```http
GET /export/compliance?format=json&standard=iec62443
```

Generate compliance reports against industry standards.

**Query Parameters:**
- `format` (optional): Export format - json, pdf, or csv. Default: json
- `standard` (optional): Specific standard - iec62443, nerccip, or nistcsf

**Response (200 OK)**:
```json
{
  "reportId": "950e8400-e29b-41d4-a716-446655440000",
  "standard": "IEC 62443",
  "generatedAt": "2024-02-08T10:30:00Z",
  "summary": {
    "totalRequirements": 156,
    "compliant": 98,
    "nonCompliant": 35,
    "notApplicable": 23,
    "compliancePercentage": 62.8
  },
  "findings": [
    {
      "id": "IEC-62443-4-2-1",
      "title": "Access Control",
      "status": "noncompliant",
      "severity": "high",
      "description": "Role-based access control not implemented on device",
      "affectedDevices": [
        "123e4567-e89b-12d3-a456-426614174000"
      ],
      "remediation": "Implement role-based access control with least privilege principle"
    }
  ]
}
```

---

### Health Endpoint

#### Health Check

```http
GET /health
```

Check if the API is operational. No authentication required.

**Response (200 OK)**:
```json
{
  "status": "ok",
  "timestamp": "2024-02-08T10:30:00Z",
  "version": "1.0.0"
}
```

---

## WebSocket Documentation

### Connection

Establish a WebSocket connection for real-time topology updates.

**Endpoint**: `wss://api.example.com/v1/ws`

**Authentication**: Include API key in initial WebSocket connection

```javascript
const apiKey = 'your-api-key-here';
const ws = new WebSocket(`wss://api.example.com/v1/ws?apiKey=${apiKey}`);
```

### Message Format

**Subscribe to a Channel**:
```json
{
  "type": "subscribe",
  "channel": "devices:events"
}
```

**Receive Broadcast**:
```json
{
  "channel": "devices:events",
  "event": "device_update",
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "name": "PLC-01",
    "status": "online"
  },
  "timestamp": "2024-02-08T10:30:00Z"
}
```

### Available Channels

| Channel | Event | Description |
|---------|-------|-------------|
| `devices:events` | device_created, device_updated, device_deleted, device_status_changed | Device lifecycle events |
| `alerts:events` | alert_created, alert_acknowledged, alert_resolved | Security alert notifications |
| `topology:changes` | topology_updated, zone_changed | Network topology modifications |
| `connections:events` | connection_created, connection_updated, connection_deleted | Connection changes |
| `telemetry:data` | raw data from collectors | Raw telemetry streams (premium only) |
| `system:events` | connected, subscribed, pong | Server events |

### WebSocket Examples

#### Subscribe to Device Events

```javascript
const apiKey = 'your-api-key-here';
const ws = new WebSocket(`wss://api.example.com/v1/ws?apiKey=${apiKey}`);

ws.onopen = () => {
  console.log('Connected');

  // Subscribe to device events
  ws.send(JSON.stringify({
    type: 'subscribe',
    channel: 'devices:events'
  }));
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  console.log('New device event:', message);

  if (message.event === 'device_status_changed') {
    console.log(`Device ${message.data.name} is now ${message.data.status}`);
  }
};

ws.onerror = (error) => {
  console.error('WebSocket error:', error);
};

ws.onclose = () => {
  console.log('Disconnected');
};
```

#### Subscribe to Alerts

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  channel: 'alerts:events'
}));

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);

  if (message.event === 'alert_created') {
    const alert = message.data;
    if (alert.severity === 'critical') {
      console.warn('CRITICAL ALERT:', alert.title);
      // Trigger notification, page alert, etc.
    }
  }
};
```

#### Multiple Channel Subscriptions

```javascript
const channels = [
  'devices:events',
  'alerts:events',
  'topology:changes'
];

ws.onopen = () => {
  channels.forEach(channel => {
    ws.send(JSON.stringify({
      type: 'subscribe',
      channel: channel
    }));
  });
};
```

---

## Export Formats

### JSON Format

Standard JSON format for complete data structure including all properties.

```json
{
  "devices": [
    {
      "id": "uuid",
      "name": "string",
      "type": "enum",
      ...
    }
  ],
  "connections": [...],
  "alerts": [...]
}
```

### CSV Format

Comma-separated values suitable for spreadsheet analysis.

**Devices CSV**:
```csv
DeviceId,Name,Type,Vendor,Model,PurdueLevel,SecurityZone,Status,DiscoveredAt,LastSeenAt
123e4567-e89b-12d3-a456-426614174000,PLC-01,plc,Siemens,S7-1200,1,control,online,2024-01-15T08:00:00Z,2024-02-08T10:30:00Z
```

**Connections CSV**:
```csv
ConnectionId,SourceDevice,TargetDevice,Protocol,Port,IsSecure,DiscoveredAt,LastSeenAt
650e8400-e29b-41d4-a716-446655440000,PLC-01,Switch-01,profinet,34962,false,2024-01-15T08:00:00Z,2024-02-08T10:30:00Z
```

### XML Format

XML structure for integration with enterprise systems.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<topology>
  <devices>
    <device>
      <id>123e4567-e89b-12d3-a456-426614174000</id>
      <name>PLC-01</name>
      <type>plc</type>
      <vendor>Siemens</vendor>
      <purdueLevel>1</purdueLevel>
      <status>online</status>
    </device>
  </devices>
</topology>
```

### GraphML Format

GraphML format for visualization in tools like Gephi, yEd.

```xml
<?xml version="1.0" encoding="UTF-8"?>
<graphml>
  <graph edgedefault="directed">
    <node id="123e4567-e89b-12d3-a456-426614174000">
      <data key="label">PLC-01</data>
      <data key="type">plc</data>
    </node>
    <edge source="123e4567-e89b-12d3-a456-426614174000"
          target="223e4567-e89b-12d3-a456-426614174000">
      <data key="protocol">profinet</data>
    </edge>
  </graph>
</graphml>
```

---

## Rate Limiting

### Rate Limit Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1707387000
```

### Limits by Tier

| Tier | Requests/Minute | Requests/Day |
|------|-----------------|--------------|
| Standard | 100 | 144,000 |
| Premium | 1,000 | 1,440,000 |
| Enterprise | Unlimited | Unlimited |

### Rate Limit Exceeded (429)

When rate limit is exceeded:

```json
{
  "error": "Too Many Requests",
  "message": "Rate limit exceeded. 95 requests remaining. Reset at 2024-02-08T10:40:00Z",
  "code": 429
}
```

**Backoff Strategy**:
```javascript
async function makeRequest(url, options = {}, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);

      if (response.status === 429) {
        const resetTime = parseInt(response.headers.get('X-RateLimit-Reset')) * 1000;
        const waitTime = resetTime - Date.now();

        if (i < retries - 1) {
          console.log(`Rate limited. Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime + 1000));
          continue;
        }
      }

      return response;
    } catch (error) {
      console.error('Request failed:', error);
      throw error;
    }
  }
}
```

---

## Error Handling

### Error Response Format

```json
{
  "error": "Error Type",
  "message": "Human-readable description",
  "code": 400,
  "details": {
    "field": "parameter_name",
    "issue": "specific problem"
  }
}
```

### Status Codes

| Code | Meaning | Cause |
|------|---------|-------|
| 200 | OK | Request succeeded |
| 400 | Bad Request | Invalid parameters or syntax |
| 401 | Unauthorized | Missing/invalid API key |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |
| 503 | Service Unavailable | API temporarily unavailable |

### Common Error Scenarios

**Invalid API Key**:
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key",
  "code": 401
}
```

**Invalid Query Parameter**:
```json
{
  "error": "Bad Request",
  "message": "Invalid limit parameter. Must be between 1 and 100.",
  "code": 400,
  "details": {
    "field": "limit",
    "issue": "value out of range"
  }
}
```

**Device Not Found**:
```json
{
  "error": "Not Found",
  "message": "Device with ID '123e4567-e89b-12d3-a456-426614174000' not found",
  "code": 404
}
```

---

## Code Examples

### Python

```python
import requests
import json
from datetime import datetime

API_KEY = 'your-api-key-here'
BASE_URL = 'https://api.example.com/v1'

headers = {
    'X-API-Key': API_KEY,
    'Content-Type': 'application/json'
}

# Get all devices
response = requests.get(f'{BASE_URL}/devices?limit=50', headers=headers)
devices = response.json()

print(f"Found {len(devices['data'])} devices")

for device in devices['data']:
    print(f"- {device['name']} ({device['type']}) - {device['status']}")

# Get device risk
device_id = devices['data'][0]['id']
risk_response = requests.get(f'{BASE_URL}/devices/{device_id}/risk', headers=headers)
risk = risk_response.json()

print(f"\n{device['name']} Risk Score: {risk['overallScore']}/100")
print("Recommendations:")
for rec in risk['recommendations']:
    print(f"  - {rec}")

# List critical alerts
alerts_response = requests.get(
    f'{BASE_URL}/alerts?severity=critical&acknowledged=false',
    headers=headers
)
alerts = alerts_response.json()

print(f"\nCritical Alerts: {len([a for a in alerts['data'] if a['severity'] == 'critical'])}")
for alert in alerts['data']:
    if alert['severity'] == 'critical':
        print(f"  [{alert['type'].upper()}] {alert['title']}")

# Acknowledge an alert
if alerts['data']:
    alert_id = alerts['data'][0]['id']
    ack_response = requests.put(
        f'{BASE_URL}/alerts/{alert_id}/acknowledge',
        headers=headers,
        json={'reason': 'In progress - scheduled maintenance'}
    )
    print(f"\nAlert acknowledged: {ack_response.status_code}")
```

### JavaScript/Node.js

```javascript
const https = require('https');

const API_KEY = 'your-api-key-here';
const BASE_URL = 'api.example.com';

async function apiCall(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: BASE_URL,
      path: `/v1${path}`,
      method: method,
      headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// Example: Get devices and subscribe to WebSocket
(async () => {
  try {
    // Get all devices
    const devices = await apiCall('GET', '/devices?limit=50');
    console.log(`Found ${devices.pagination.total} devices`);

    // Get topology
    const topology = await apiCall('GET', '/topology');
    console.log(`Topology has ${topology.devices.length} devices and ${topology.connections.length} connections`);

    // WebSocket connection for real-time updates
    const WebSocket = require('ws');
    const ws = new WebSocket(`wss://api.example.com/v1/ws?apiKey=${API_KEY}`);

    ws.on('open', () => {
      console.log('Connected to WebSocket');

      // Subscribe to alerts
      ws.send(JSON.stringify({
        type: 'subscribe',
        channel: 'alerts:events'
      }));
    });

    ws.on('message', (data) => {
      const message = JSON.parse(data);

      if (message.event === 'alert_created') {
        console.log(`New alert: ${message.data.title} (${message.data.severity})`);
      }
    });

    ws.on('error', console.error);
  } catch (error) {
    console.error('Error:', error);
  }
})();
```

### cURL

```bash
#!/bin/bash

API_KEY="your-api-key-here"
BASE_URL="https://api.example.com/v1"

echo "=== Health Check ==="
curl -X GET "${BASE_URL}/health"

echo -e "\n=== List Devices ==="
curl -X GET "${BASE_URL}/devices?limit=10" \
  -H "X-API-Key: ${API_KEY}"

echo -e "\n=== Get Device Risk ==="
DEVICE_ID="123e4567-e89b-12d3-a456-426614174000"
curl -X GET "${BASE_URL}/devices/${DEVICE_ID}/risk" \
  -H "X-API-Key: ${API_KEY}"

echo -e "\n=== List Critical Alerts ==="
curl -X GET "${BASE_URL}/alerts?severity=critical&acknowledged=false" \
  -H "X-API-Key: ${API_KEY}"

echo -e "\n=== Acknowledge Alert ==="
ALERT_ID="850e8400-e29b-41d4-a716-446655440000"
curl -X PUT "${BASE_URL}/alerts/${ALERT_ID}/acknowledge" \
  -H "X-API-Key: ${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "In progress - scheduled maintenance window"
  }'

echo -e "\n=== Export Topology as CSV ==="
curl -X GET "${BASE_URL}/export/topology?format=csv" \
  -H "X-API-Key: ${API_KEY}" \
  -o topology-$(date +%Y%m%d).csv
```

### Go

```go
package main

import (
	"fmt"
	"io/ioutil"
	"net/http"
)

const (
	APIKey  = "your-api-key-here"
	BaseURL = "https://api.example.com/v1"
)

func main() {
	client := &http.Client{}

	// Get devices
	req, _ := http.NewRequest("GET", BaseURL+"/devices", nil)
	req.Header.Add("X-API-Key", APIKey)

	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	fmt.Println("Devices Response:", string(body))

	// Get topology
	req2, _ := http.NewRequest("GET", BaseURL+"/topology", nil)
	req2.Header.Add("X-API-Key", APIKey)

	resp2, _ := client.Do(req2)
	defer resp2.Body.Close()

	body2, _ := ioutil.ReadAll(resp2.Body)
	fmt.Println("Topology Response:", string(body2))
}
```

---

## Purdue Model

The Purdue Model classifies ICS devices into hierarchical levels:

| Level | Name | Examples | Security Focus |
|-------|------|----------|-----------------|
| 0 | Process | Sensors, actuators, drives, instruments | Non-networked or closed-loop |
| 1 | Control | PLC, RTU, DCS, controllers | Local network control |
| 2 | Supervisory | SCADA servers, HMI, alarm servers | Plant-wide monitoring |
| 3 | Operations | MES, historian, engineering workstations | Production planning |
| 4 | Corporate | ERP, data analytics, corporate systems | Business systems |
| 5 | Remote | External partners, cloud systems | Third-party integration |
| 99 | DMZ | Firewalls, gateways, proxies | Demilitarized zone |

---

## Support and Troubleshooting

### Common Issues

**Q: I'm getting 401 Unauthorized errors**
A: Verify your API key is correct and included in the `X-API-Key` header

**Q: Rate limit errors (429)**
A: Implement exponential backoff. See [Rate Limiting](#rate-limiting) section.

**Q: WebSocket connection fails**
A: Ensure you're using `wss://` (secure WebSocket) and include the API key in the connection URL

**Q: Export endpoint returns empty file**
A: Verify you have devices discovered in your topology first

### Getting Help

- **Documentation**: https://github.com/company/scada-topology/docs
- **GitHub Issues**: https://github.com/company/scada-topology/issues
- **Email Support**: support@example.com
- **Status Page**: https://status.example.com

---

## Version History

### Version 1.0.0 (February 2024)
- Initial release
- Core endpoints for topology, devices, connections, alerts
- WebSocket real-time updates
- Export functionality
- Compliance reporting

---

## License

This API documentation is provided under the Proprietary license.

---

**Last Updated**: February 8, 2024
**API Version**: 1.0.0

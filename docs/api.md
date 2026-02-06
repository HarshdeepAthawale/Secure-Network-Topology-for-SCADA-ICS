# SCADA Topology Discovery - API Reference

## Base URL

```
https://{api-gateway-id}.execute-api.{region}.amazonaws.com/{stage}
```

## Authentication

All API requests require an API key in the header:
```
x-api-key: your-api-key
```

## Endpoints

### Topology

#### Get Current Topology
```http
GET /topology
```

**Response**
```json
{
  "id": "uuid",
  "timestamp": "2024-01-15T10:30:00Z",
  "devices": [...],
  "connections": [...],
  "metadata": {
    "deviceCount": 150,
    "connectionCount": 280
  }
}
```

### Devices

#### List Devices
```http
GET /devices?level=1&status=online&limit=50&offset=0
```

**Query Parameters**
- `level`: Filter by Purdue level (0-5, 99 for DMZ)
- `zone`: Filter by security zone
- `status`: Filter by status (online, offline, degraded)
- `type`: Filter by device type
- `limit`: Results per page (default: 50)
- `offset`: Pagination offset

#### Get Device
```http
GET /devices/{deviceId}
```

### Connections

#### List Connections
```http
GET /connections?deviceId=uuid&protocol=modbus
```

**Query Parameters**
- `deviceId`: Filter by source or target device
- `protocol`: Filter by protocol
- `secure`: Filter by security status (true/false)

### Alerts

#### List Alerts
```http
GET /alerts?severity=critical&acknowledged=false
```

**Query Parameters**
- `severity`: critical, high, medium, low, info
- `type`: security, connectivity, compliance
- `acknowledged`: true/false
- `resolved`: true/false

#### Acknowledge Alert
```http
PUT /alerts/{alertId}/acknowledge
```

**Request Body**
```json
{
  "acknowledgedBy": "admin@example.com"
}
```

### Risk Assessments

#### Get Device Risk
```http
GET /devices/{deviceId}/risk
```

**Response**
```json
{
  "deviceId": "uuid",
  "overallScore": 45,
  "factors": [
    {
      "name": "Vulnerability",
      "score": 30,
      "category": "vulnerability"
    }
  ],
  "recommendations": [
    "Update firmware to latest version"
  ]
}
```

## Error Responses

```json
{
  "error": "Not Found",
  "message": "Device not found",
  "code": "DEVICE_NOT_FOUND"
}
```

**Status Codes**
- `200`: Success
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `500`: Internal Server Error

## Rate Limits

- 100 requests per minute per API key
- Retry-After header included on 429 responses

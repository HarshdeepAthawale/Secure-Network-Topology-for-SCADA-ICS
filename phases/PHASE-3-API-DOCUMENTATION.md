# Phase 3: API Documentation - Implementation Plan

**Status**: ⏳ PENDING
**Priority**: MEDIUM
**Estimated Time**: 3-4 days
**Goal**: Complete API documentation with OpenAPI specification

---

## Overview

Phase 3 focuses on creating comprehensive API documentation for integration partners:
- Full OpenAPI 3.0 specification
- Interactive Swagger UI
- Complete endpoint documentation
- Request/response examples
- WebSocket protocol documentation

---

## Task 3.1: OpenAPI 3.0 Specification

**File**: `docs/openapi.yaml`

### Structure
```yaml
openapi: 3.0.0
info:
  title: SCADA/ICS Network Topology Discovery API
  version: 1.0.0
  description: Real-time visibility into industrial control system networks
  contact:
    name: Support Team
    url: https://github.com/company/scada-topology
  license:
    name: Proprietary

servers:
  - url: https://api.example.com/v1
    description: Production environment
  - url: https://staging-api.example.com/v1
    description: Staging environment

paths:
  /topology:
    get:
      summary: Get current network topology
      operationId: getTopology
      tags: [Topology]
      parameters:
        - name: format
          in: query
          schema:
            type: string
            enum: [json, graphml]
      responses:
        '200':
          description: Topology data
          content:
            application/json:
              schema: TopologyResponse
        '401':
          $ref: '#/components/responses/Unauthorized'
        '429':
          $ref: '#/components/responses/TooManyRequests'

  /devices:
    get:
      summary: List all devices
      operationId: listDevices
      tags: [Devices]
      parameters:
        - $ref: '#/components/parameters/Limit'
        - $ref: '#/components/parameters/Offset'
        - name: type
          in: query
          schema:
            type: string
          description: Filter by device type
        - name: vendor
          in: query
          schema:
            type: string
      responses:
        '200':
          description: Device list
          content:
            application/json:
              schema: DeviceListResponse
        '401':
          $ref: '#/components/responses/Unauthorized'

  /devices/{deviceId}:
    get:
      summary: Get device details
      operationId: getDevice
      tags: [Devices]
      parameters:
        - $ref: '#/components/parameters/DeviceId'
      responses:
        '200':
          description: Device details
          content:
            application/json:
              schema: Device
        '404':
          $ref: '#/components/responses/NotFound'

  /devices/{deviceId}/risk:
    get:
      summary: Get device risk assessment
      operationId: getDeviceRisk
      tags: [Devices, Risk]
      parameters:
        - $ref: '#/components/parameters/DeviceId'
      responses:
        '200':
          description: Risk assessment
          content:
            application/json:
              schema: RiskAssessment

  /connections:
    get:
      summary: List network connections
      operationId: listConnections
      tags: [Connections]
      parameters:
        - $ref: '#/components/parameters/Limit'
        - $ref: '#/components/parameters/Offset'
        - name: secure
          in: query
          schema:
            type: boolean
          description: Filter by security status
      responses:
        '200':
          description: Connection list
          content:
            application/json:
              schema: ConnectionListResponse

  /alerts:
    get:
      summary: List security alerts
      operationId: listAlerts
      tags: [Alerts]
      parameters:
        - $ref: '#/components/parameters/Limit'
        - $ref: '#/components/parameters/Offset'
        - name: severity
          in: query
          schema:
            type: string
            enum: [critical, high, medium, low, info]
      responses:
        '200':
          description: Alert list
          content:
            application/json:
              schema: AlertListResponse

  /alerts/{alertId}/acknowledge:
    put:
      summary: Acknowledge alert
      operationId: acknowledgeAlert
      tags: [Alerts]
      parameters:
        - $ref: '#/components/parameters/AlertId'
      requestBody:
        required: true
        content:
          application/json:
            schema:
              type: object
              properties:
                reason:
                  type: string
      responses:
        '200':
          description: Alert acknowledged

  /zones:
    get:
      summary: List security zones
      operationId: listZones
      tags: [Zones]
      responses:
        '200':
          description: Zone list
          content:
            application/json:
              schema: ZoneListResponse

  /export/topology:
    get:
      summary: Export topology report
      operationId: exportTopology
      tags: [Export]
      parameters:
        - name: format
          in: query
          schema:
            type: string
            enum: [json, csv, xml]
          required: true
      responses:
        '200':
          description: Exported topology

  /export/compliance:
    get:
      summary: Export compliance report
      operationId: exportCompliance
      tags: [Export]
      responses:
        '200':
          description: Compliance report

  /health:
    get:
      summary: Health check
      operationId: healthCheck
      tags: [Health]
      security: []
      responses:
        '200':
          description: System healthy
          content:
            application/json:
              schema:
                type: object
                properties:
                  status:
                    type: string
                    enum: [ok, degraded]
                  timestamp:
                    type: string
                    format: date-time

components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT

  parameters:
    DeviceId:
      name: deviceId
      in: path
      required: true
      schema:
        type: string
        format: uuid
    AlertId:
      name: alertId
      in: path
      required: true
      schema:
        type: string
        format: uuid
    Limit:
      name: limit
      in: query
      schema:
        type: integer
        default: 20
        maximum: 100
    Offset:
      name: offset
      in: query
      schema:
        type: integer
        default: 0

  responses:
    Unauthorized:
      description: Unauthorized
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    NotFound:
      description: Not found
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'
    TooManyRequests:
      description: Rate limit exceeded
      content:
        application/json:
          schema:
            $ref: '#/components/schemas/Error'

  schemas:
    Device:
      type: object
      required: [id, name, type]
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        hostname:
          type: string
        type:
          type: string
          enum: [plc, rtu, hmi, scada_server, switch, router, firewall, sensor, actuator, drive, historian]
        vendor:
          type: string
        model:
          type: string
        purdueLevel:
          type: integer
          minimum: 0
          maximum: 5
        status:
          type: string
          enum: [online, offline, unknown]
        lastSeenAt:
          type: string
          format: date-time
        discoveredAt:
          type: string
          format: date-time

    RiskAssessment:
      type: object
      properties:
        deviceId:
          type: string
          format: uuid
        overallScore:
          type: number
          minimum: 0
          maximum: 100
        vulnerabilityScore:
          type: number
        configurationScore:
          type: number
        exposureScore:
          type: number
        complianceScore:
          type: number
        factors:
          type: array
          items:
            type: object
        recommendations:
          type: array
          items:
            type: string
        assessedAt:
          type: string
          format: date-time

    Alert:
      type: object
      required: [id, type, severity, title]
      properties:
        id:
          type: string
          format: uuid
        type:
          type: string
        severity:
          type: string
          enum: [critical, high, medium, low, info]
        title:
          type: string
        description:
          type: string
        deviceId:
          type: string
          format: uuid
        acknowledged:
          type: boolean
        resolved:
          type: boolean
        createdAt:
          type: string
          format: date-time

    Error:
      type: object
      required: [error, message]
      properties:
        error:
          type: string
        message:
          type: string
        code:
          type: integer

security:
  - ApiKeyAuth: []
  - BearerAuth: []
```

---

## Task 3.2: Swagger UI Setup

**File**: `docs/swagger-ui.html`

### Features
- Standalone HTML file with embedded Swagger UI
- Interactive endpoint testing ("Try it out")
- Authentication UI for API key testing
- Custom styling matching project branding
- Responsive design for mobile access

### Implementation
```html
<!DOCTYPE html>
<html>
  <head>
    <title>SCADA API Documentation</title>
    <link rel="stylesheet" type="text/css"
          href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.css">
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@3/swagger-ui.bundle.js"></script>
    <script>
      SwaggerUIBundle({
        url: "./openapi.yaml",
        dom_id: '#swagger-ui',
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIBundle.SwaggerUIStandalonePreset
        ],
        layout: "BaseLayout"
      });
    </script>
  </body>
</html>
```

---

## Task 3.3: API Documentation Updates

**File**: `docs/api.md`

### Sections to Complete

1. **Authentication**
   - API key generation
   - Bearer token usage
   - Token expiration and renewal

2. **Endpoints**
   - Complete all 20+ endpoint descriptions
   - Request/response examples
   - Error codes and meanings

3. **WebSocket Documentation**
   - Connection endpoint: `wss://api.example.com/v1/ws`
   - Subscription channels:
     ```
     devices:events - Device status changes
     alerts:events - New alerts
     topology:changes - Topology updates
     telemetry:data - Raw telemetry streams
     ```

4. **Export Formats**
   - JSON schema
   - CSV structure
   - XML schema

5. **Rate Limiting**
   - 100 requests/minute for standard users
   - 1000 requests/minute for premium users
   - Backoff strategy

6. **Code Examples**
   - curl commands
   - JavaScript/Node.js
   - Python
   - Go

---

## Task 3.4: SDK Generation (Optional)

### Tools
- openapi-generator-cli
- swagger-codegen

### Languages to Support
- TypeScript/JavaScript
- Python
- Go
- Java

---

## Phase 3 Acceptance Criteria

✅ OpenAPI spec validates against OpenAPI 3.0 schema
✅ Swagger UI renders all endpoints correctly
✅ All request/response examples are valid JSON
✅ Authentication flows documented with examples
✅ API documentation includes code samples in 3+ languages
✅ WebSocket connection examples provided
✅ All endpoints documented with descriptions
✅ Error responses documented
✅ Rate limiting documented
✅ Pagination documented
✅ Can generate SDKs from OpenAPI spec

---

## Phase 3 Verification

```bash
# Validate OpenAPI spec
npm install -g @apidevtools/swagger-cli
swagger-cli validate docs/openapi.yaml

# Start local Swagger UI
open docs/swagger-ui.html

# Test API endpoints
curl -X GET https://api-endpoint/v1/health \
  -H "X-API-Key: your-api-key"

# Verify examples are valid
node -e "console.log(JSON.parse(require('fs').readFileSync('docs/openapi.yaml')))"
```

---

## Success Metrics

- Swagger UI displays without errors
- All endpoints accessible from UI
- Code examples run without errors
- OpenAPI spec passes validation
- SDK generation successful

---

## Dependencies

✅ Phase 1: Production Readiness (MUST BE COMPLETE)
✅ Phase 2: Visualization (recommended for completeness)

---

## Next Phase

→ **Phase 4: Integration Tests** - Ensure end-to-end system reliability

# Phase 4: Integration Tests - Implementation Plan

**Status**: ⏳ PENDING
**Priority**: MEDIUM
**Estimated Time**: 1 week
**Goal**: Ensure end-to-end system reliability

---

## Overview

Phase 4 focuses on comprehensive integration testing:
- End-to-end workflow validation
- Collector integration tests
- Lambda function integration tests
- WebSocket integration tests
- Real data flow testing

---

## Task 4.1: Integration Test Setup

### Docker Compose Test Environment

**File**: `docker-compose.test.yml`

```yaml
version: '3.8'

services:
  postgres-test:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: scada_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    ports:
      - "5433:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test"]
      interval: 5s
      timeout: 5s
      retries: 5

  localstack:
    image: localstack/localstack:latest
    environment:
      SERVICES: s3,lambda,sqs,iot
      DEBUG: 1
      DATA_DIR: /tmp/localstack/data
    ports:
      - "4566:4566"
    healthcheck:
      test: ["CMD", "awslocal", "kinesis", "list-streams"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis-test:
    image: redis:7-alpine
    ports:
      - "6380:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
```

### Jest Configuration for Integration Tests

```typescript
// jest.integration.config.js
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/?(*.)+(integration|e2e).test.ts'],
  setupFilesAfterEnv: ['<rootDir>/tests/setup.integration.ts'],
  testTimeout: 30000,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.test.ts',
    '!src/**/*.d.ts'
  ]
};
```

---

## Task 4.2: Collector Integration Tests

**File**: `tests/integration/collectors/snmp-collector.integration.test.ts`

### Features

```typescript
describe('SNMP Collector Integration', () => {

  it('should connect to SNMP device and collect data', async () => {
    // 1. Start mock SNMP device
    // 2. Initialize collector
    // 3. Perform SNMP query
    // 4. Verify data collection
    // 5. Verify telemetry published to MQTT
  });

  it('should handle SNMPv3 authentication', async () => {
    // Test username/password auth
    // Test authPriv security
    // Test encryption with AES
  });

  it('should retry on timeout', async () => {
    // Simulate network delay
    // Verify exponential backoff
    // Verify max retries respected
  });

  it('should handle malformed data gracefully', async () => {
    // Send invalid SNMP responses
    // Verify error handling
    // Verify logging
  });

  it('should respect rate limiting', async () => {
    // Verify polling interval respected
    // Verify no excessive queries
  });

});
```

---

## Task 4.3: Lambda Integration Tests

### 4.3.1 Ingest Lambda Tests

**File**: `tests/integration/lambda/ingest.integration.test.ts`

```typescript
describe('Ingest Lambda Integration', () => {

  it('should ingest telemetry from multiple collectors', async () => {
    // 1. Send SNMP telemetry
    // 2. Send ARP telemetry
    // 3. Send NetFlow data
    // 4. Verify all stored in database
    // 5. Verify telemetry partitioning
  });

  it('should validate telemetry before storage', async () => {
    // Send valid telemetry - should succeed
    // Send invalid telemetry - should reject
    // Verify error notifications
  });

  it('should handle high throughput', async () => {
    // Send 1000+ telemetry records
    // Measure latency
    // Verify all records stored
  });

});
```

### 4.3.2 Process Lambda Tests

**File**: `tests/integration/lambda/process.integration.test.ts`

```typescript
describe('Process Lambda Integration', () => {

  it('should discover and correlate devices', async () => {
    // 1. Ingest SNMP, ARP, NetFlow data
    // 2. Process to correlate devices
    // 3. Verify devices created
    // 4. Verify connections created
  });

  it('should classify devices by Purdue level', async () => {
    // 1. Create devices with various types
    // 2. Process for classification
    // 3. Verify correct Purdue levels assigned
  });

  it('should generate alerts for anomalies', async () => {
    // 1. Create devices and connections
    // 2. Simulate anomaly (offline device, insecure connection)
    // 3. Verify alerts generated
    // 4. Verify alert severity correct
  });

  it('should perform risk assessment', async () => {
    // 1. Create devices and connections
    // 2. Process for risk analysis
    // 3. Verify risk scores calculated
    // 4. Verify risk factors identified
  });

});
```

### 4.3.3 Query Lambda Tests

**File**: `tests/integration/lambda/query.integration.test.ts`

```typescript
describe('Query Lambda Integration', () => {

  it('should retrieve current topology', async () => {
    // 1. Setup test data
    // 2. Query topology
    // 3. Verify node and edge counts
    // 4. Verify data completeness
  });

  it('should support filtering and pagination', async () => {
    // 1. Create 100+ devices
    // 2. Query with filters
    // 3. Verify pagination
    // 4. Verify filter criteria applied
  });

  it('should support searches', async () => {
    // 1. Create devices with various names/types
    // 2. Perform text search
    // 3. Verify correct results returned
  });

});
```

### 4.3.4 Export Lambda Tests

**File**: `tests/integration/lambda/export.integration.test.ts`

```typescript
describe('Export Lambda Integration', () => {

  it('should export topology to JSON', async () => {
    // 1. Setup test topology
    // 2. Export to JSON
    // 3. Verify structure
    // 4. Verify all data included
  });

  it('should export to S3', async () => {
    // 1. Setup test data
    // 2. Trigger export
    // 3. Verify file in S3
    // 4. Verify file integrity
  });

});
```

---

## Task 4.4: WebSocket Integration Tests

**File**: `tests/integration/websocket/realtime.integration.test.ts`

```typescript
describe('WebSocket Real-time Integration', () => {

  it('should handle single client connection', async () => {
    // 1. Connect client
    // 2. Subscribe to channel
    // 3. Trigger event
    // 4. Verify client receives update
    // 5. Disconnect
  });

  it('should broadcast to multiple clients', async () => {
    // 1. Connect 10 clients
    // 2. All subscribe to topology:changes
    // 3. Trigger topology change
    // 4. Verify all clients receive broadcast
  });

  it('should handle concurrent connections', async () => {
    // 1. Connect 100 clients rapidly
    // 2. Send updates continuously
    // 3. Measure latency
    // 4. Verify no message loss
  });

  it('should handle disconnection and reconnection', async () => {
    // 1. Connect client
    // 2. Disconnect
    // 3. Reconnect
    // 4. Verify state synchronized
  });

  it('should support channel subscriptions', async () => {
    // 1. Connect client
    // 2. Subscribe to devices:events
    // 3. Trigger device change
    // 4. Verify subscription works
    // 5. Unsubscribe
    // 6. Trigger change
    // 7. Verify no message received
  });

});
```

---

## Task 4.5: End-to-End Workflow Tests

**File**: `tests/integration/e2e/discovery-workflow.integration.test.ts`

```typescript
describe('Device Discovery Workflow E2E', () => {

  it('should complete full discovery workflow', async () => {
    // 1. Simulate SNMP collector discovery
    // 2. Simulate ARP table collection
    // 3. Simulate NetFlow export
    // 4. Process and correlate all data
    // 5. Verify devices discovered
    // 6. Verify connections established
    // 7. Verify topology graph correct
    // 8. Verify WebSocket broadcasts sent
    // 9. Query topology via Lambda
    // 10. Verify data integrity
  });

  it('should handle topology changes', async () => {
    // 1. Establish initial topology
    // 2. Add new device
    // 3. Trigger reprocessing
    // 4. Verify new device detected
    // 5. Verify alerts generated
    // 6. Verify WebSocket notified
  });

  it('should detect offline devices', async () => {
    // 1. Establish baseline
    // 2. Stop device collector
    // 3. Process after timeout
    // 4. Verify device marked offline
    // 5. Verify alert generated
    // 6. Verify risk score increased
  });

});
```

---

## Task 4.6: Database Integration Tests

**File**: `tests/integration/database/repositories.integration.test.ts`

```typescript
describe('Database Integration', () => {

  it('should handle concurrent writes', async () => {
    // 1. Write 100 devices concurrently
    // 2. Verify all stored
    // 3. Verify no duplicates
    // 4. Verify data consistency
  });

  it('should maintain referential integrity', async () => {
    // 1. Create device and connections
    // 2. Try to delete device
    // 3. Verify constraint enforced
  });

  it('should handle transactions', async () => {
    // 1. Start transaction
    // 2. Create multiple entities
    // 3. Trigger error
    // 4. Rollback
    // 5. Verify no data persisted
  });

  it('should support connection pooling', async () => {
    // 1. Execute 50 concurrent queries
    // 2. Measure connection pool utilization
    // 3. Verify queries succeed
  });

});
```

---

## Phase 4 Acceptance Criteria

✅ All integration tests pass in CI/CD pipeline
✅ E2E workflow tests cover device discovery
✅ WebSocket integration tests handle 100+ clients
✅ Lambda integration tests verify all handlers
✅ Database integration tests validate ACID properties
✅ Integration test suite completes in <5 minutes
✅ Test data cleanup verified
✅ All tests use isolated test databases
✅ No integration tests modify production data

---

## Phase 4 Verification

```bash
# Start test environment
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be healthy
docker-compose -f docker-compose.test.yml ps

# Run integration tests
npm run test:integration

# Check coverage
npm run test:coverage -- --coveragePathIgnorePatterns='/tests/'

# Teardown
docker-compose -f docker-compose.test.yml down
```

---

## Success Metrics

- All integration tests pass (100%)
- Test execution time <5 minutes
- Code coverage >80% for integration paths
- No flaky tests
- Database state cleanup verified

---

## Dependencies

✅ Phase 1: Production Readiness (MUST BE COMPLETE)
✅ Phase 2: Visualization (optional)
✅ Phase 3: API Documentation (optional)

---

## Next Phase

→ **Phase 5: Polish & Documentation** - Final touches for professional release

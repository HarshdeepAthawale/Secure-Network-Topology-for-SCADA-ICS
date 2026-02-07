# Integration Tests Quick Start Guide

## Overview

Phase 4 provides a comprehensive integration test suite with **200+ test cases** covering all major system components. Tests are fully isolated, repeatable, and complete in under 5 minutes.

---

## Quick Start (5 minutes)

### Step 1: Start Test Environment
```bash
cd /path/to/project

# Start Docker services (PostgreSQL, LocalStack, Redis, Mosquitto)
docker-compose -f docker-compose.test.yml up -d

# Wait for services to be healthy (30-60 seconds)
docker-compose -f docker-compose.test.yml ps
```

**Expected Output**: All services showing "healthy" or "running"

### Step 2: Run All Integration Tests
```bash
# Run entire integration test suite
npm run test:integration

# Or with coverage
npm run test:integration -- --coverage
```

**Expected Result**: ✅ All tests pass (200+ tests)

### Step 3: Clean Up
```bash
# Stop test environment
docker-compose -f docker-compose.test.yml down

# Remove volumes (optional)
docker-compose -f docker-compose.test.yml down -v
```

---

## Test Commands

### Run All Integration Tests
```bash
npm run test:integration
```

### Run Specific Test Suites
```bash
# SNMP Collector tests (34 tests)
npm run test:integration:collectors

# Database Repository tests (50+ tests)
npm run test:integration:database

# Lambda Handler tests (40+ tests)
npm run test:integration:lambda

# WebSocket tests (40+ tests)
npm run test:integration:websocket

# End-to-End workflow tests (35+ tests)
npm run test:integration:e2e
```

### Run All Test Types
```bash
# Unit + Integration + Security tests
npm run test:all
```

### Generate Coverage Report
```bash
npm run test:coverage
```

Coverage reports will be in `coverage/` directory. Open `coverage/index.html` in a browser.

---

## Test Suite Details

### 1. SNMP Collector Tests (`tests/integration/collectors/`)
**34 test cases**

Tests SNMPv3 collector initialization, target management, session handling, error recovery, and telemetry publishing.

**Key Tests**:
- Target management (add, remove, enable, disable)
- SNMPv3 security configuration
- Error handling and recovery
- Configuration persistence

### 2. Database Repository Tests (`tests/integration/database/`)
**50+ test cases**

Tests CRUD operations, advanced queries, pagination, filtering, concurrent operations, and data integrity with real PostgreSQL.

**Key Tests**:
- Device, Connection, Alert CRUD operations
- Pagination and search functionality
- Concurrent writes and reads
- Foreign key constraints and cascades

### 3. Lambda Handler Tests (`tests/integration/lambda/`)
**40+ test cases**

Tests Lambda function invocations with various payloads, error scenarios, performance, and concurrency.

**Key Tests**:
- Valid/invalid payload handling
- Telemetry enrichment
- Large batch processing (100+ items)
- Performance and memory efficiency
- Concurrent request handling

### 4. WebSocket Tests (`tests/integration/websocket/`)
**40+ test cases**

Tests WebSocket server initialization, client connections, message subscriptions, broadcasting, and concurrent operations.

**Key Tests**:
- Client connection/disconnection
- Channel subscription/unsubscription
- Broadcasting to multiple clients
- Concurrent client operations (20+ clients)
- Message handling and heartbeat

### 5. End-to-End Workflow Tests (`tests/integration/e2e/`)
**35+ test cases**

Tests complete device discovery workflows, network topology building, anomaly detection, and risk assessment.

**Key Tests**:
- Device discovery and classification
- Network topology building
- Cross-zone communication detection
- Offline device detection
- Risk scoring and assessment

---

## Environment Details

### Test Database
- **Host**: localhost
- **Port**: 5433
- **Database**: scada_topology_test
- **User**: test_user
- **Password**: test_password

### Test Docker Services
- **PostgreSQL**: Port 5433 (health check via pg_isready)
- **LocalStack**: Port 4566 (AWS service mocking)
- **Redis**: Port 6380 (cache testing)
- **Mosquitto MQTT**: Port 1883 (message broker testing)

### Key Features
- Automatic test database initialization
- Schema creation with tables and indexes
- Pre-test data cleanup
- Connection pooling support
- Transaction testing
- Foreign key constraint enforcement

---

## Configuration Files

### docker-compose.test.yml
Defines all test services with health checks and network configuration.

### jest.integration.config.js
Jest configuration specific to integration tests:
- Test timeout: 60 seconds
- Coverage threshold: 65%
- Max workers: 2 (for stability)
- Open handle detection enabled

### tests/setup.env.ts
Environment variable configuration for tests.

### tests/setup.integration.ts
Global test setup and teardown logic, database initialization.

---

## Common Tasks

### Run Tests with Specific Pattern
```bash
# Run only SNMP collector tests
npm run test:integration -- --testNamePattern="SNMP"

# Run only WebSocket broadcast tests
npm run test:integration -- --testNamePattern="broadcast"

# Run only device CRUD tests
npm run test:integration -- --testNamePattern="CRUD"
```

### Run Tests with Debugging
```bash
# Run with verbose output
npm run test:integration -- --verbose

# Run a single test file
npm run test:integration -- tests/integration/collectors/snmp-collector.integration.test.ts

# Run in watch mode (re-run on file changes)
npm run test:integration -- --watch
```

### Generate HTML Coverage Report
```bash
npm run test:coverage

# Open in browser
open coverage/integration/index.html
```

### Run Tests in CI/CD Pipeline
```bash
# Clean Docker environment
docker-compose -f docker-compose.test.yml down

# Start fresh
docker-compose -f docker-compose.test.yml up -d

# Run with exit codes
npm run test:integration || exit 1

# Cleanup
docker-compose -f docker-compose.test.yml down
```

---

## Troubleshooting

### PostgreSQL Connection Failed
```bash
# Check if service is running
docker-compose -f docker-compose.test.yml ps postgres-test

# View logs
docker-compose -f docker-compose.test.yml logs postgres-test

# Restart service
docker-compose -f docker-compose.test.yml restart postgres-test
```

### Port Already in Use
```bash
# Find and kill processes
lsof -ti:5433 | xargs kill -9  # PostgreSQL
lsof -ti:4566 | xargs kill -9  # LocalStack
lsof -ti:6380 | xargs kill -9  # Redis
lsof -ti:1883 | xargs kill -9  # Mosquitto

# Or stop all Docker containers
docker-compose -f docker-compose.test.yml down
```

### Timeout Issues
```bash
# Increase test timeout in jest.integration.config.js
testTimeout: 120000  # 2 minutes instead of 60 seconds

# Or set environment variable
TEST_TIMEOUT=120000 npm run test:integration
```

### Out of Memory
```bash
# Reduce max workers
npm run test:integration -- --maxWorkers=1

# Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096" npm run test:integration
```

### Database Schema Not Created
```bash
# Manually initialize test database
docker-compose -f docker-compose.test.yml exec postgres-test psql -U test_user -d scada_topology_test -c "CREATE TABLE IF EXISTS devices (...)"

# Or delete and recreate volume
docker-compose -f docker-compose.test.yml down -v
docker-compose -f docker-compose.test.yml up -d
```

---

## Performance Tips

1. **Use Specific Test Suite**: Run `npm run test:integration:collectors` instead of full suite if only testing collectors

2. **Run in CI**: Tests complete faster with dedicated resources
   ```bash
   npm run test:integration -- --bail  # Stop on first failure
   ```

3. **Parallel Execution**: Jest automatically parallelizes across 2 workers
   - More workers = more resource usage
   - Fewer workers = slower tests

4. **Watch Mode**: For development
   ```bash
   npm run test:integration -- --watch
   ```

---

## CI/CD Integration

### GitHub Actions Example
```yaml
name: Integration Tests
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15-alpine
        env:
          POSTGRES_DB: scada_topology_test
          POSTGRES_USER: test_user
          POSTGRES_PASSWORD: test_password
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm install
      - run: npm run build
      - run: docker-compose -f docker-compose.test.yml up -d
      - run: npm run test:integration
      - run: docker-compose -f docker-compose.test.yml down
```

---

## What Gets Tested

### ✅ Collectors
- SNMPv3 configuration and sessions
- Target management and lifecycle
- Error handling and recovery
- Telemetry publishing

### ✅ Database
- CRUD operations (Create, Read, Update, Delete)
- Advanced queries (search, filter, pagination)
- Concurrent operations
- Foreign key constraints
- Data integrity

### ✅ Lambda Functions
- Payload parsing and validation
- Telemetry enrichment
- Error handling
- Performance and memory
- Concurrent invocations

### ✅ WebSocket
- Client connection/disconnection
- Channel subscriptions
- Broadcasting
- Message handling
- Concurrent clients

### ✅ End-to-End
- Device discovery workflows
- Topology building
- Anomaly detection
- Risk assessment
- Data consistency

---

## Next Steps

1. **Run tests locally**: Follow Quick Start guide above
2. **Review test results**: Check output for any failures
3. **Integrate into CI/CD**: Add to your pipeline
4. **Set up monitoring**: Track test execution metrics
5. **Extend tests**: Add additional test cases as needed

---

**Questions?** See [PHASE-4-IMPLEMENTATION-SUMMARY.md](./PHASE-4-IMPLEMENTATION-SUMMARY.md) for detailed information.

**Last Updated**: February 8, 2026

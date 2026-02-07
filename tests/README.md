# Test Suite Documentation

This directory contains all test files for the Secure Network Topology for SCADA/ICS project, organized by test type.

---

## Directory Structure

```
tests/
├── setup.ts                          # Jest unit test setup (global mocks)
├── setup.env.ts                      # Environment variable configuration
├── setup.integration.ts              # Integration test setup (database, services)
├── unit/                             # Unit tests (mocked dependencies)
│   ├── collectors/
│   ├── database/repositories/
│   ├── processors/parsers/
│   ├── services/
│   ├── utils/
│   └── websocket/
├── integration/                      # Integration tests (real components)
│   ├── collectors/
│   │   └── snmp-collector.integration.test.ts      # 34 tests
│   ├── database/
│   │   └── repositories.integration.test.ts        # 50+ tests
│   ├── lambda/
│   │   └── handlers.integration.test.ts            # 40+ tests
│   ├── websocket/
│   │   └── realtime.integration.test.ts            # 40+ tests
│   └── e2e/
│       └── discovery-workflow.integration.test.ts  # 35+ tests
└── security/                        # Security-focused tests
    ├── sql-injection.security.test.ts
    ├── snmpv3-authentication.security.test.ts
    ├── api-authorization.security.test.ts
    └── tls-certificates.security.test.ts
```

---

## Test Types

### Unit Tests (`tests/unit/`)
- **Mocked dependencies** (database, services)
- **Fast execution** (<100ms per test)
- **Focused testing** on individual functions
- **Coverage threshold**: 70%

Run with:
```bash
npm run test:unit
```

### Integration Tests (`tests/integration/`)
- **Real components** with test database
- **Cross-component interaction** testing
- **Moderate execution** (60 seconds per test)
- **Coverage threshold**: 65%

Run with:
```bash
npm run test:integration
```

Subdivided by component:
- **Collectors**: Protocol handling, data collection
- **Database**: Repository operations, queries, constraints
- **Lambda**: Handler invocations, payload processing
- **WebSocket**: Real-time communication, streaming
- **E2E**: Complete workflows, device discovery

### Security Tests (`tests/security/`)
- **Vulnerability testing** (SQL injection, auth bypasses)
- **Compliance verification** (encryption, TLS)
- **Input validation** (malformed data, edge cases)
- **Coverage threshold**: 70%

Run with:
```bash
npm run test:security
```

---

## Setup Files

### setup.ts (All Tests)
```typescript
// Global setup for all test types
- NODE_ENV = 'test'
- LOG_LEVEL = 'error'
- Global MQTT mock (all tests)
- Console output suppression
```

### setup.env.ts (Integration Tests)
```typescript
// Environment configuration for integration tests
- Database connection (port 5433)
- AWS credentials for LocalStack
- Redis and MQTT configuration
- WebSocket port settings
```

### setup.integration.ts (Integration Tests Only)
```typescript
// Before all tests:
- Initialize PostgreSQL connection
- Create database tables and indexes

// Before each test:
- Clean all test data (DELETE FROM tables)
- Reset mocks

// After all tests:
- Close database connection
- Restore console mocks
```

---

## Running Tests

### All Tests
```bash
npm run test                    # Unit + integration + security
npm run test:all              # Explicit all test types
```

### Specific Test Type
```bash
npm run test:unit             # Unit tests only
npm run test:integration      # Integration tests only
npm run test:security         # Security tests only
```

### Specific Test Suite
```bash
npm run test:integration:collectors   # SNMP collector tests
npm run test:integration:database     # Database repository tests
npm run test:integration:lambda       # Lambda handler tests
npm run test:integration:websocket    # WebSocket tests
npm run test:integration:e2e          # E2E workflow tests
```

### With Coverage
```bash
npm run test:coverage         # All tests with coverage report
```

---

## Test Naming Convention

Test files follow Jest naming conventions:

```
src/module/component.ts           → tests/unit/module/component.test.ts
src/lambda/ingest/handler.ts      → tests/integration/lambda/handlers.integration.test.ts
src/database/repositories/device.repository.ts → tests/integration/database/repositories.integration.test.ts
```

**Pattern**: `*.test.ts` (unit), `*.integration.test.ts` (integration), `*.security.test.ts` (security)

---

## Test Structure

Each test file follows the AAA pattern (Arrange, Act, Assert):

```typescript
describe('Component Name', () => {
  // Setup before all tests
  beforeAll(async () => {
    // Initialize expensive resources
  });

  // Cleanup after all tests
  afterAll(async () => {
    // Close connections, cleanup
  });

  // Setup before each test
  beforeEach(async () => {
    // Reset state, clear data
  });

  describe('Feature Group', () => {
    it('should do something specific', async () => {
      // Arrange: Set up test data
      const input = { /* ... */ };

      // Act: Execute functionality
      const result = await component.doSomething(input);

      // Assert: Verify results
      expect(result).toEqual(expectedOutput);
    });
  });
});
```

---

## Integration Test Database

### Connection Details
- **Host**: localhost
- **Port**: 5433 (vs production 5432)
- **Database**: scada_topology_test
- **User**: test_user
- **Password**: test_password

### Schema
Automatically created in `setup.integration.ts`:
- `devices` - Device inventory
- `network_interfaces` - Interface information
- `connections` - Network connections
- `alerts` - Security/operational alerts
- `telemetry` - Raw telemetry data
- `topology_snapshots` - Topology snapshots
- `audit_logs` - Change audit trail

All tables are dropped and recreated before each test to ensure isolation.

---

## Mocking Strategy

### Global Mocks (All Tests)
```typescript
jest.mock('../src/utils/mqtt-client', () => ({
  getMQTTClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
  })),
}));
```

### Per-Test Mocks (as needed)
```typescript
jest.mock('../src/database', () => ({
  initializeDatabase: jest.fn().mockResolvedValue(undefined),
  getDeviceRepository: jest.fn(() => mockDeviceRepo),
}));
```

### Real External Services (Integration Tests)
- **PostgreSQL**: Real test database
- **AWS**: LocalStack provides mock endpoints
- **WebSocket**: Real `ws` server
- **Collectors**: Real collector implementations

---

## Test Isolation

### Database Isolation
- Each test runs against clean database
- Tables dropped and recreated before each test
- Foreign key constraints enforced
- No cross-test data leakage

### Mock Isolation
```typescript
beforeEach(() => {
  jest.clearAllMocks();  // Reset mock call counts
});
```

### Process Isolation
- Single Jest instance per test run
- No shared global state between tests
- Each test completes within timeout

---

## Performance Baselines

| Test Type | Count | Duration | Avg/Test |
|-----------|-------|----------|----------|
| Unit | 100+ | ~5s | ~50ms |
| Integration | 200+ | ~120s | ~600ms |
| Security | 20+ | ~10s | ~500ms |
| **Total** | **320+** | **~135s** | **~420ms** |

Optimizations:
- Max workers: 2 (prevents resource contention)
- Parallel execution: Jest handles automatically
- Test timeout: 60 seconds (integration), 30 seconds (unit)

---

## Coverage Requirements

### Coverage Thresholds
```javascript
// jest.config.js (unit tests)
coverageThreshold: {
  global: {
    branches: 70,      // Statement coverage
    functions: 70,     // Function coverage
    lines: 70,         // Line coverage
    statements: 70     // Expression coverage
  }
}

// jest.integration.config.js (integration tests)
coverageThreshold: {
  global: {
    branches: 65,
    functions: 65,
    lines: 65,
    statements: 65
  }
}
```

### Coverage Reports
- Generated in `coverage/` directory
- HTML report: `coverage/index.html`
- LCOV format: `coverage/lcov.info` (for CI/CD)
- Text summary in console output

---

## Debugging Tests

### Run Single Test
```bash
npm run test -- --testNamePattern="should create a device"
npm run test:integration -- tests/integration/database/repositories.integration.test.ts
```

### Run with Logging
```bash
# Show all console output
npm run test -- --silent=false

# Verbose output
npm run test -- --verbose

# Watch mode (re-run on changes)
npm run test -- --watch
```

### Inspect Test Variables
```typescript
it('should do something', () => {
  const result = something();
  console.log('Result:', result);  // Will show with --silent=false
  expect(result).toBeDefined();
});
```

### Debug with Node Inspector
```bash
node --inspect-brk node_modules/.bin/jest --runInBand
# Then open chrome://inspect in Chrome
```

---

## Adding New Tests

### Create Test File
1. Create file: `tests/integration/module/component.integration.test.ts`
2. Import tested module: `import { Component } from '../../../src/module/component'`
3. Write test cases following AAA pattern
4. Ensure setup/teardown are appropriate

### Example Structure
```typescript
import { MyComponent } from '../../../src/my-module/my-component';

describe('MyComponent Integration', () => {
  let component: MyComponent;

  beforeEach(() => {
    component = new MyComponent();
  });

  describe('Feature', () => {
    it('should work correctly', async () => {
      // Arrange
      const input = { /* ... */ };

      // Act
      const result = await component.doSomething(input);

      // Assert
      expect(result).toBeDefined();
    });
  });
});
```

### Run Your Tests
```bash
npm run test:integration -- tests/integration/module/component.integration.test.ts
```

---

## CI/CD Integration

### GitHub Actions
```yaml
- run: npm install
- run: npm run build
- run: docker-compose -f docker-compose.test.yml up -d
- run: npm run test:integration
- run: docker-compose -f docker-compose.test.yml down
```

### Pre-commit Hooks
```json
{
  "husky": {
    "hooks": {
      "pre-commit": "npm run test:unit",
      "pre-push": "npm run test:integration"
    }
  }
}
```

---

## Troubleshooting

### "Cannot find module" errors
```bash
# Verify tsconfig.json paths aliases
# Check moduleNameMapper in jest.config.js
npm run build  # Ensure TypeScript compilation works
```

### "Port already in use" errors
```bash
# Kill existing processes
lsof -ti:5433 | xargs kill -9
docker-compose -f docker-compose.test.yml down
```

### "Connection timeout" errors
```bash
# Check Docker service health
docker-compose -f docker-compose.test.yml ps

# Increase timeout
testTimeout: 120000  // in jest config
```

### "Out of memory" errors
```bash
# Reduce parallel workers
npm run test -- --maxWorkers=1

# Increase Node memory
NODE_OPTIONS="--max-old-space-size=4096" npm run test
```

---

## Best Practices

1. **Isolation**: Each test should be independent
2. **Clarity**: Use descriptive test names
3. **Completeness**: Test happy path, edge cases, and errors
4. **Performance**: Keep unit tests fast, accept slower integration tests
5. **Maintenance**: Update tests when code changes
6. **Documentation**: Comment complex test logic
7. **Organization**: Group related tests with `describe`

---

## Resources

- [Jest Documentation](https://jestjs.io/)
- [Testing Library](https://testing-library.com/)
- [PostgreSQL Testing](https://www.postgresql.org/)
- [LocalStack Documentation](https://docs.localstack.cloud/)

---

**Last Updated**: February 8, 2026
**Status**: Production Ready

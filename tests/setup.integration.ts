/**
 * Integration test setup - handles database and service initialization
 */

import { Pool } from 'pg';

// Global test timeout for integration tests
jest.setTimeout(60000);

// Mock MQTT client for all tests
jest.mock('../src/utils/mqtt-client', () => ({
  getMQTTClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
    publishTelemetry: jest.fn().mockResolvedValue(undefined),
    connected: true,
    isConnected: () => true,
  })),
  resetMQTTClient: jest.fn(),
}));

// Database pool for test teardown
let testPool: Pool;

/**
 * Initialize test database and clear existing data
 */
async function initializeTestDatabase() {
  try {
    testPool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433'),
      database: process.env.DB_NAME || 'scada_topology_test',
      user: process.env.DB_USER || 'test_user',
      password: process.env.DB_PASSWORD || 'test_password',
      application_name: 'integration-tests',
    });

    // Test connection
    await testPool.query('SELECT 1');
    console.log('✓ Test database connected');
  } catch (error) {
    console.error('✗ Failed to connect to test database:', error);
    throw error;
  }
}

/**
 * Clean up test data before each test
 */
async function cleanupTestData() {
  if (!testPool) return;

  try {
    // Drop and recreate test tables in correct order (respecting foreign keys)
    await testPool.query(`
      DROP TABLE IF EXISTS topology_snapshots CASCADE;
      DROP TABLE IF EXISTS alerts CASCADE;
      DROP TABLE IF EXISTS connections CASCADE;
      DROP TABLE IF EXISTS network_interfaces CASCADE;
      DROP TABLE IF EXISTS devices CASCADE;
      DROP TABLE IF EXISTS telemetry CASCADE;
      DROP TABLE IF EXISTS audit_logs CASCADE;
    `);

    // Recreate tables (you may want to run migrations instead)
    await testPool.query(`
      CREATE TABLE IF NOT EXISTS devices (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL UNIQUE,
        hostname VARCHAR(255),
        type VARCHAR(50) NOT NULL,
        vendor VARCHAR(100),
        model VARCHAR(100),
        firmware_version VARCHAR(50),
        serial_number VARCHAR(100),
        purdue_level INTEGER NOT NULL CHECK (purdue_level BETWEEN 0 AND 99),
        security_zone VARCHAR(50) NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'unknown',
        location JSONB,
        metadata JSONB DEFAULT '{}',
        discovered_at TIMESTAMP NOT NULL,
        last_seen_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT valid_purdue_level CHECK (purdue_level IN (0, 1, 2, 3, 4, 5, 99))
      );

      CREATE TABLE IF NOT EXISTS network_interfaces (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        name VARCHAR(50) NOT NULL,
        ip_address INET,
        mac_address MACADDR,
        status VARCHAR(20) DEFAULT 'up',
        speed BIGINT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(device_id, name)
      );

      CREATE TABLE IF NOT EXISTS connections (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        source_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        target_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
        source_interface VARCHAR(50),
        target_interface VARCHAR(50),
        connection_type VARCHAR(50) NOT NULL,
        protocol VARCHAR(50),
        port INTEGER,
        vlan_id INTEGER,
        bandwidth BIGINT,
        latency DECIMAL(10, 2),
        is_secure BOOLEAN DEFAULT FALSE,
        encryption_type VARCHAR(50),
        discovered_at TIMESTAMP NOT NULL,
        last_seen_at TIMESTAMP NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(source_device_id, target_device_id, protocol)
      );

      CREATE TABLE IF NOT EXISTS alerts (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
        type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL,
        message TEXT NOT NULL,
        description TEXT,
        acknowledged BOOLEAN DEFAULT FALSE,
        acknowledged_at TIMESTAMP,
        acknowledged_by VARCHAR(255),
        resolved BOOLEAN DEFAULT FALSE,
        resolved_at TIMESTAMP,
        resolved_by VARCHAR(255),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS telemetry (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        collector VARCHAR(50) NOT NULL,
        source VARCHAR(255) NOT NULL,
        payload JSONB NOT NULL,
        processed BOOLEAN DEFAULT FALSE,
        processed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_collector_source (collector, source)
      );

      CREATE TABLE IF NOT EXISTS topology_snapshots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        timestamp TIMESTAMP NOT NULL,
        device_count INTEGER NOT NULL,
        connection_count INTEGER NOT NULL,
        data JSONB NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(timestamp)
      );

      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action VARCHAR(50) NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id UUID,
        changes JSONB,
        user_id VARCHAR(255),
        ip_address INET,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE INDEX idx_devices_purdue_level ON devices(purdue_level);
      CREATE INDEX idx_devices_security_zone ON devices(security_zone);
      CREATE INDEX idx_devices_status ON devices(status);
      CREATE INDEX idx_devices_last_seen ON devices(last_seen_at);
      CREATE INDEX idx_connections_source ON connections(source_device_id);
      CREATE INDEX idx_connections_target ON connections(target_device_id);
      CREATE INDEX idx_alerts_device ON alerts(device_id);
      CREATE INDEX idx_alerts_severity ON alerts(severity);
      CREATE INDEX idx_alerts_created_at ON alerts(created_at);
      CREATE INDEX idx_telemetry_collector ON telemetry(collector);
      CREATE INDEX idx_telemetry_processed ON telemetry(processed);
      CREATE INDEX idx_audit_logs_entity ON audit_logs(entity_type, entity_id);
    `);

    console.log('✓ Test database cleaned and initialized');
  } catch (error) {
    console.error('✗ Failed to cleanup test data:', error);
    // Don't throw - continue with test
  }
}

/**
 * Close database connections after all tests
 */
async function closeTestDatabase() {
  if (testPool) {
    try {
      await testPool.end();
      console.log('✓ Test database disconnected');
    } catch (error) {
      console.error('✗ Failed to close test database:', error);
    }
  }
}

// Console mocking
beforeAll(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});

  // Initialize test database
  await initializeTestDatabase();
});

beforeEach(async () => {
  // Clean test data before each test
  await cleanupTestData();
});

afterAll(async () => {
  jest.restoreAllMocks();

  // Close database connection
  await closeTestDatabase();
});

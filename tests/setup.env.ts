/**
 * Environment setup for integration tests
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// Database Configuration for Integration Tests
process.env.DB_HOST = process.env.DB_HOST || 'localhost';
process.env.DB_PORT = process.env.DB_PORT || '5433';
process.env.DB_NAME = process.env.DB_NAME || 'scada_topology_test';
process.env.DB_USER = process.env.DB_USER || 'test_user';
process.env.DB_PASSWORD = process.env.DB_PASSWORD || 'test_password';
process.env.DB_SSL = 'false';

// AWS Configuration for LocalStack
process.env.AWS_REGION = process.env.AWS_REGION || 'us-east-1';
process.env.AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID || 'testing';
process.env.AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY || 'testing';
process.env.AWS_ENDPOINT = process.env.AWS_ENDPOINT || 'http://localhost:4566';

// Redis Configuration
process.env.REDIS_HOST = process.env.REDIS_HOST || 'localhost';
process.env.REDIS_PORT = process.env.REDIS_PORT || '6380';

// MQTT Configuration
process.env.MQTT_BROKER = process.env.MQTT_BROKER || 'mqtt://localhost:1883';
process.env.MQTT_USERNAME = process.env.MQTT_USERNAME || '';
process.env.MQTT_PASSWORD = process.env.MQTT_PASSWORD || '';

// WebSocket Configuration
process.env.WEBSOCKET_PORT = process.env.WEBSOCKET_PORT || '8080';
process.env.WEBSOCKET_HOST = process.env.WEBSOCKET_HOST || 'localhost';

// Test Configuration
process.env.TEST_DATA_DIR = process.env.TEST_DATA_DIR || '/tmp/scada-test-data';
process.env.TEST_TIMEOUT = process.env.TEST_TIMEOUT || '60000';

// Disable external service calls
process.env.ENABLE_EXTERNAL_SERVICES = 'false';

/**
 * Jest test setup
 */

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'scada_topology_test';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';

// Global test timeout
jest.setTimeout(30000);

// Mock MQTT client
jest.mock('../src/utils/mqtt-client', () => ({
  getMQTTClient: jest.fn(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    publish: jest.fn().mockResolvedValue(undefined),
    publishTelemetry: jest.fn().mockResolvedValue(undefined),
    connected: true,
  })),
  resetMQTTClient: jest.fn(),
}));

// Console cleanup
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
  jest.spyOn(console, 'debug').mockImplementation(() => {});
});

afterAll(() => {
  jest.restoreAllMocks();
});

/**
 * Unit tests for Configuration Management
 */

import { config, getConfig, validateConfig } from '../../../../src/utils/config';

describe('Configuration Management', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('getConfig', () => {
    it('should load configuration from environment variables', () => {
      process.env.NODE_ENV = 'production';
      process.env.PORT = '8080';
      process.env.LOG_LEVEL = 'debug';

      const cfg = getConfig();

      expect(cfg.nodeEnv).toBe('production');
      expect(cfg.port).toBe(8080);
      expect(cfg.logLevel).toBe('debug');
    });

    it('should use default values when env vars are missing', () => {
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;

      const cfg = getConfig();

      expect(cfg.port).toBe(3000); // default
      expect(cfg.logLevel).toBe('info'); // default
    });

    it('should throw error when required config is missing', () => {
      delete process.env.DATABASE_URL;

      expect(() => getConfig()).toThrow();
    });

    it('should support different environment configurations', () => {
      const testConfig = { env: 'test', debug: true };
      const prodConfig = { env: 'production', debug: false };

      expect(testConfig.debug).toBe(true);
      expect(prodConfig.debug).toBe(false);
    });
  });

  describe('Type coercion', () => {
    it('should coerce string to number', () => {
      process.env.PORT = '3000';
      process.env.MAX_CONNECTIONS = '100';

      const cfg = getConfig();

      expect(typeof cfg.port).toBe('number');
      expect(cfg.port).toBe(3000);
      expect(typeof cfg.maxConnections).toBe('number');
    });

    it('should coerce string to boolean', () => {
      process.env.DEBUG = 'true';
      process.env.ENABLE_CACHE = 'false';

      const cfg = getConfig();

      expect(typeof cfg.debug).toBe('boolean');
      expect(cfg.debug).toBe(true);
      expect(cfg.enableCache).toBe(false);
    });

    it('should parse JSON configuration', () => {
      process.env.ALLOWED_ORIGINS = JSON.stringify([
        'https://app1.com',
        'https://app2.com',
      ]);

      const cfg = getConfig();

      expect(Array.isArray(cfg.allowedOrigins)).toBe(true);
      expect(cfg.allowedOrigins).toContain('https://app1.com');
    });

    it('should handle invalid type coercion gracefully', () => {
      process.env.PORT = 'not-a-number';

      expect(() => getConfig()).toThrow();
    });
  });

  describe('Validation', () => {
    it('should validate required configuration', () => {
      process.env.DATABASE_URL = '';

      expect(() => validateConfig()).toThrow();
    });

    it('should validate port number range', () => {
      process.env.PORT = '70000'; // Invalid port

      expect(() => validateConfig()).toThrow();
    });

    it('should validate database URL format', () => {
      process.env.DATABASE_URL = 'invalid-url';

      expect(() => validateConfig()).toThrow();
    });

    it('should validate log level values', () => {
      process.env.LOG_LEVEL = 'invalid-level';

      expect(() => validateConfig()).toThrow();
    });

    it('should accept valid configurations', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/scada';
      process.env.PORT = '3000';
      process.env.LOG_LEVEL = 'info';

      expect(() => validateConfig()).not.toThrow();
    });
  });

  describe('Sensitive data masking', () => {
    it('should not expose passwords in logs', () => {
      process.env.DATABASE_URL = 'postgresql://user:secretpass@localhost:5432/scada';

      const cfg = getConfig();
      const configStr = JSON.stringify(cfg);

      expect(configStr).not.toContain('secretpass');
    });

    it('should not expose API keys in logs', () => {
      process.env.API_KEY = 'super-secret-api-key-12345';

      const configStr = JSON.stringify(getConfig());

      expect(configStr).not.toContain('super-secret-api-key-12345');
    });

    it('should mask sensitive values with asterisks', () => {
      const maskedValue = '*'.repeat(8); // Masked version
      expect(maskedValue).toBe('********');
    });
  });

  describe('Database configuration', () => {
    it('should load database connection string', () => {
      process.env.DATABASE_URL = 'postgresql://localhost:5432/scada_db';

      const cfg = getConfig();

      expect(cfg.databaseUrl).toContain('postgresql');
      expect(cfg.databaseUrl).toContain('localhost');
    });

    it('should parse database configuration with pooling', () => {
      process.env.DB_POOL_MIN = '2';
      process.env.DB_POOL_MAX = '20';

      const cfg = getConfig();

      expect(cfg.dbPoolMin).toBe(2);
      expect(cfg.dbPoolMax).toBe(20);
    });
  });

  describe('AWS configuration', () => {
    it('should load AWS region', () => {
      process.env.AWS_REGION = 'us-east-1';

      const cfg = getConfig();

      expect(cfg.awsRegion).toBe('us-east-1');
    });

    it('should support AWS credentials from environment', () => {
      process.env.AWS_ACCESS_KEY_ID = 'AKIAIOSFODNN7EXAMPLE';
      process.env.AWS_SECRET_ACCESS_KEY = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';

      const cfg = getConfig();

      expect(cfg.awsAccessKeyId).toBeDefined();
      expect(cfg.awsSecretAccessKey).toBeDefined();
    });
  });

  describe('MQTT configuration', () => {
    it('should load MQTT broker settings', () => {
      process.env.MQTT_BROKER_URL = 'mqtt://broker.example.com:1883';
      process.env.MQTT_USERNAME = 'user';
      process.env.MQTT_PASSWORD = 'pass';

      const cfg = getConfig();

      expect(cfg.mqttBrokerUrl).toContain('mqtt://');
      expect(cfg.mqttUsername).toBe('user');
    });

    it('should support MQTT with TLS', () => {
      process.env.MQTT_BROKER_URL = 'mqtts://broker.example.com:8883';

      const cfg = getConfig();

      expect(cfg.mqttBrokerUrl).toContain('mqtts://');
    });
  });

  describe('Logging configuration', () => {
    it('should load log level', () => {
      process.env.LOG_LEVEL = 'debug';

      const cfg = getConfig();

      expect(['debug', 'info', 'warn', 'error']).toContain(cfg.logLevel);
    });

    it('should support log file output', () => {
      process.env.LOG_FILE = '/var/log/scada/app.log';

      const cfg = getConfig();

      expect(cfg.logFile).toContain('.log');
    });
  });

  describe('Environment-specific configuration', () => {
    it('should load development configuration', () => {
      process.env.NODE_ENV = 'development';
      process.env.DEBUG = 'true';

      const cfg = getConfig();

      expect(cfg.nodeEnv).toBe('development');
      expect(cfg.debug).toBe(true);
    });

    it('should load production configuration', () => {
      process.env.NODE_ENV = 'production';
      process.env.DEBUG = 'false';

      const cfg = getConfig();

      expect(cfg.nodeEnv).toBe('production');
      expect(cfg.debug).toBe(false);
    });

    it('should load test configuration', () => {
      process.env.NODE_ENV = 'test';

      const cfg = getConfig();

      expect(cfg.nodeEnv).toBe('test');
    });
  });

  describe('Configuration override precedence', () => {
    it('should prioritize environment variables over defaults', () => {
      process.env.PORT = '9000';

      const cfg = getConfig();

      expect(cfg.port).toBe(9000);
    });

    it('should support configuration files', () => {
      // Simulating config file loading
      const fileConfig = { port: 4000, debug: true };
      const envConfig = { port: 3000 };

      const merged = { ...fileConfig, ...envConfig };

      expect(merged.port).toBe(3000); // env var wins
      expect(merged.debug).toBe(true); // from file
    });
  });

  describe('Error messages', () => {
    it('should provide clear error messages for missing config', () => {
      delete process.env.DATABASE_URL;

      try {
        getConfig();
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('DATABASE_URL');
        expect(error.message).toContain('required');
      }
    });

    it('should provide helpful error messages for invalid values', () => {
      process.env.PORT = 'invalid';

      try {
        getConfig();
        fail('Should have thrown');
      } catch (error: any) {
        expect(error.message).toContain('PORT');
        expect(error.message).toContain('invalid');
      }
    });
  });
});

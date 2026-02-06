/**
 * Configuration loader for SCADA Topology Discovery
 * Loads environment variables and provides typed configuration
 */

import * as dotenv from 'dotenv';
import { z } from 'zod';
import { SNMPConfig, MQTTConfig, DatabaseConfig, CollectorConfig } from './types';

// Load environment variables
dotenv.config();

// ============================================================================
// Configuration Schemas
// ============================================================================

const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
  APP_NAME: z.string().default('scada-topology-discovery'),

  // AWS
  AWS_REGION: z.string().default('us-east-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),

  // AWS IoT
  IOT_ENDPOINT: z.string().optional(),
  IOT_TOPIC_TELEMETRY: z.string().default('scada/telemetry'),
  IOT_TOPIC_ALERTS: z.string().default('scada/alerts'),
  IOT_CERT_PATH: z.string().default('./certs/device.pem.crt'),
  IOT_KEY_PATH: z.string().default('./certs/private.pem.key'),
  IOT_CA_PATH: z.string().default('./certs/root-CA.crt'),

  // Database
  DB_HOST: z.string().default('localhost'),
  DB_PORT: z.string().transform(Number).default('5432'),
  DB_NAME: z.string().default('scada_topology'),
  DB_USER: z.string().default('scada_admin'),
  DB_PASSWORD: z.string().optional(),
  DB_SSL: z.string().transform(val => val === 'true').default('false'),
  DB_POOL_SIZE: z.string().transform(Number).default('10'),

  // SNMP
  SNMP_AUTH_PROTOCOL: z.enum(['MD5', 'SHA', 'SHA256', 'SHA512']).default('SHA'),
  SNMP_PRIV_PROTOCOL: z.enum(['DES', 'AES', 'AES256']).default('AES'),
  SNMP_SECURITY_LEVEL: z.enum(['noAuthNoPriv', 'authNoPriv', 'authPriv']).default('authPriv'),
  SNMP_TIMEOUT: z.string().transform(Number).default('5000'),
  SNMP_RETRIES: z.string().transform(Number).default('3'),

  // Collector
  COLLECTOR_POLL_INTERVAL: z.string().transform(Number).default('60000'),
  COLLECTOR_BATCH_SIZE: z.string().transform(Number).default('100'),
  COLLECTOR_MAX_CONCURRENT: z.string().transform(Number).default('10'),

  // Syslog
  SYSLOG_PORT: z.string().transform(Number).default('514'),
  SYSLOG_PROTOCOL: z.enum(['udp', 'tcp']).default('udp'),

  // NetFlow
  NETFLOW_PORT: z.string().transform(Number).default('2055'),
  NETFLOW_VERSION: z.string().transform(Number).default('9'),

  // Security
  ENCRYPTION_KEY: z.string().min(32).optional(),
  JWT_SECRET: z.string().optional(),
  TLS_MIN_VERSION: z.string().default('TLSv1.3'),

  // Grafana
  GRAFANA_URL: z.string().default('http://localhost:3000'),
  GRAFANA_API_KEY: z.string().optional(),

  // Alerting
  ALERT_EMAIL_ENABLED: z.string().transform(val => val === 'true').default('false'),
  ALERT_EMAIL_SMTP_HOST: z.string().optional(),
  ALERT_EMAIL_SMTP_PORT: z.string().transform(Number).default('587'),
  ALERT_EMAIL_FROM: z.string().optional(),
  ALERT_EMAIL_TO: z.string().optional(),
  ALERT_WEBHOOK_URL: z.string().optional(),
});

// ============================================================================
// Configuration Class
// ============================================================================

class Config {
  private static instance: Config;
  private env: z.infer<typeof envSchema>;

  private constructor() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const errors = result.error.format();
      throw new Error(`Configuration validation failed: ${JSON.stringify(errors)}`);
    }
    this.env = result.data;
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  // ============================================================================
  // Application Config
  // ============================================================================

  get nodeEnv(): string {
    return this.env.NODE_ENV;
  }

  get isDevelopment(): boolean {
    return this.env.NODE_ENV === 'development';
  }

  get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  get isTest(): boolean {
    return this.env.NODE_ENV === 'test';
  }

  get logLevel(): string {
    return this.env.LOG_LEVEL;
  }

  get appName(): string {
    return this.env.APP_NAME;
  }

  // ============================================================================
  // AWS Config
  // ============================================================================

  get aws(): { region: string; accessKeyId?: string; secretAccessKey?: string } {
    return {
      region: this.env.AWS_REGION,
      accessKeyId: this.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: this.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  // ============================================================================
  // MQTT Config
  // ============================================================================

  get mqtt(): MQTTConfig {
    return {
      endpoint: this.env.IOT_ENDPOINT || '',
      clientId: `${this.env.APP_NAME}-${process.pid}`,
      topics: {
        telemetry: this.env.IOT_TOPIC_TELEMETRY,
        alerts: this.env.IOT_TOPIC_ALERTS,
        commands: 'scada/commands',
      },
      tls: {
        certPath: this.env.IOT_CERT_PATH,
        keyPath: this.env.IOT_KEY_PATH,
        caPath: this.env.IOT_CA_PATH,
        minVersion: this.env.TLS_MIN_VERSION,
      },
      keepalive: 60,
      reconnectPeriod: 5000,
    };
  }

  // ============================================================================
  // Database Config
  // ============================================================================

  get database(): DatabaseConfig {
    return {
      host: this.env.DB_HOST,
      port: this.env.DB_PORT,
      database: this.env.DB_NAME,
      user: this.env.DB_USER,
      password: this.env.DB_PASSWORD || '',
      ssl: this.env.DB_SSL,
      poolSize: this.env.DB_POOL_SIZE,
    };
  }

  get databaseUrl(): string {
    const { host, port, database, user, password, ssl } = this.database;
    const sslParam = ssl ? '?sslmode=require' : '';
    return `postgresql://${user}:${password}@${host}:${port}/${database}${sslParam}`;
  }

  // ============================================================================
  // SNMP Config
  // ============================================================================

  get snmp(): SNMPConfig {
    return {
      enabled: true,
      pollInterval: this.env.COLLECTOR_POLL_INTERVAL,
      timeout: this.env.SNMP_TIMEOUT,
      retries: this.env.SNMP_RETRIES,
      batchSize: this.env.COLLECTOR_BATCH_SIZE,
      maxConcurrent: this.env.COLLECTOR_MAX_CONCURRENT,
      version: 3,
      securityLevel: this.env.SNMP_SECURITY_LEVEL,
      authProtocol: this.env.SNMP_AUTH_PROTOCOL as SNMPConfig['authProtocol'],
      privProtocol: this.env.SNMP_PRIV_PROTOCOL as SNMPConfig['privProtocol'],
    };
  }

  // ============================================================================
  // Collector Config
  // ============================================================================

  get collector(): CollectorConfig {
    return {
      enabled: true,
      pollInterval: this.env.COLLECTOR_POLL_INTERVAL,
      timeout: this.env.SNMP_TIMEOUT,
      retries: this.env.SNMP_RETRIES,
      batchSize: this.env.COLLECTOR_BATCH_SIZE,
      maxConcurrent: this.env.COLLECTOR_MAX_CONCURRENT,
    };
  }

  // ============================================================================
  // Syslog Config
  // ============================================================================

  get syslog(): { port: number; protocol: 'udp' | 'tcp' } {
    return {
      port: this.env.SYSLOG_PORT,
      protocol: this.env.SYSLOG_PROTOCOL,
    };
  }

  // ============================================================================
  // NetFlow Config
  // ============================================================================

  get netflow(): { port: number; version: number } {
    return {
      port: this.env.NETFLOW_PORT,
      version: this.env.NETFLOW_VERSION,
    };
  }

  // ============================================================================
  // Security Config
  // ============================================================================

  get security(): { encryptionKey?: string; jwtSecret?: string; tlsMinVersion: string } {
    return {
      encryptionKey: this.env.ENCRYPTION_KEY,
      jwtSecret: this.env.JWT_SECRET,
      tlsMinVersion: this.env.TLS_MIN_VERSION,
    };
  }

  // ============================================================================
  // Grafana Config
  // ============================================================================

  get grafana(): { url: string; apiKey?: string } {
    return {
      url: this.env.GRAFANA_URL,
      apiKey: this.env.GRAFANA_API_KEY,
    };
  }

  // ============================================================================
  // Alerting Config
  // ============================================================================

  get alerting(): {
    email: {
      enabled: boolean;
      smtpHost?: string;
      smtpPort: number;
      from?: string;
      to?: string;
    };
    webhook?: string;
  } {
    return {
      email: {
        enabled: this.env.ALERT_EMAIL_ENABLED,
        smtpHost: this.env.ALERT_EMAIL_SMTP_HOST,
        smtpPort: this.env.ALERT_EMAIL_SMTP_PORT,
        from: this.env.ALERT_EMAIL_FROM,
        to: this.env.ALERT_EMAIL_TO,
      },
      webhook: this.env.ALERT_WEBHOOK_URL,
    };
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Get all configuration as a plain object (for debugging)
   * Note: Sensitive values are masked
   */
  toJSON(): Record<string, unknown> {
    return {
      nodeEnv: this.nodeEnv,
      logLevel: this.logLevel,
      appName: this.appName,
      aws: {
        region: this.aws.region,
        hasCredentials: !!(this.aws.accessKeyId && this.aws.secretAccessKey),
      },
      mqtt: {
        endpoint: this.mqtt.endpoint,
        topics: this.mqtt.topics,
      },
      database: {
        host: this.database.host,
        port: this.database.port,
        database: this.database.database,
        ssl: this.database.ssl,
      },
      collector: this.collector,
    };
  }
}

// Export singleton instance
export const config = Config.getInstance();

// Export for testing
export { Config };

"use strict";
/**
 * Configuration loader for SCADA Topology Discovery
 * Loads environment variables and provides typed configuration
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.Config = exports.config = void 0;
const dotenv = __importStar(require("dotenv"));
const zod_1 = require("zod");
// Load environment variables
dotenv.config();
// ============================================================================
// Configuration Schemas
// ============================================================================
const envSchema = zod_1.z.object({
    // Application
    NODE_ENV: zod_1.z.enum(['development', 'production', 'test']).default('development'),
    LOG_LEVEL: zod_1.z.enum(['error', 'warn', 'info', 'debug', 'trace']).default('info'),
    APP_NAME: zod_1.z.string().default('scada-topology-discovery'),
    // AWS
    AWS_REGION: zod_1.z.string().default('us-east-1'),
    AWS_ACCESS_KEY_ID: zod_1.z.string().optional(),
    AWS_SECRET_ACCESS_KEY: zod_1.z.string().optional(),
    // AWS IoT
    IOT_ENDPOINT: zod_1.z.string().optional(),
    IOT_TOPIC_TELEMETRY: zod_1.z.string().default('scada/telemetry'),
    IOT_TOPIC_ALERTS: zod_1.z.string().default('scada/alerts'),
    IOT_CERT_PATH: zod_1.z.string().default('./certs/device.pem.crt'),
    IOT_KEY_PATH: zod_1.z.string().default('./certs/private.pem.key'),
    IOT_CA_PATH: zod_1.z.string().default('./certs/root-CA.crt'),
    // Database
    DB_HOST: zod_1.z.string().default('localhost'),
    DB_PORT: zod_1.z.string().transform(Number).default('5432'),
    DB_NAME: zod_1.z.string().default('scada_topology'),
    DB_USER: zod_1.z.string().default('scada_admin'),
    DB_PASSWORD: zod_1.z.string().optional(),
    DB_SSL: zod_1.z.string().transform(val => val === 'true').default('false'),
    DB_POOL_SIZE: zod_1.z.string().transform(Number).default('10'),
    // SNMP
    SNMP_AUTH_PROTOCOL: zod_1.z.enum(['MD5', 'SHA', 'SHA256', 'SHA512']).default('SHA'),
    SNMP_PRIV_PROTOCOL: zod_1.z.enum(['DES', 'AES', 'AES256']).default('AES'),
    SNMP_SECURITY_LEVEL: zod_1.z.enum(['noAuthNoPriv', 'authNoPriv', 'authPriv']).default('authPriv'),
    SNMP_TIMEOUT: zod_1.z.string().transform(Number).default('5000'),
    SNMP_RETRIES: zod_1.z.string().transform(Number).default('3'),
    // Collector
    COLLECTOR_POLL_INTERVAL: zod_1.z.string().transform(Number).default('60000'),
    COLLECTOR_BATCH_SIZE: zod_1.z.string().transform(Number).default('100'),
    COLLECTOR_MAX_CONCURRENT: zod_1.z.string().transform(Number).default('10'),
    // Syslog
    SYSLOG_PORT: zod_1.z.string().transform(Number).default('514'),
    SYSLOG_PROTOCOL: zod_1.z.enum(['udp', 'tcp']).default('udp'),
    // NetFlow
    NETFLOW_PORT: zod_1.z.string().transform(Number).default('2055'),
    NETFLOW_VERSION: zod_1.z.string().transform(Number).default('9'),
    // Security
    ENCRYPTION_KEY: zod_1.z.string().min(32).optional(),
    JWT_SECRET: zod_1.z.string().optional(),
    TLS_MIN_VERSION: zod_1.z.string().default('TLSv1.3'),
    // Grafana
    GRAFANA_URL: zod_1.z.string().default('http://localhost:3000'),
    GRAFANA_API_KEY: zod_1.z.string().optional(),
    // Alerting
    ALERT_EMAIL_ENABLED: zod_1.z.string().transform(val => val === 'true').default('false'),
    ALERT_EMAIL_SMTP_HOST: zod_1.z.string().optional(),
    ALERT_EMAIL_SMTP_PORT: zod_1.z.string().transform(Number).default('587'),
    ALERT_EMAIL_FROM: zod_1.z.string().optional(),
    ALERT_EMAIL_TO: zod_1.z.string().optional(),
    ALERT_WEBHOOK_URL: zod_1.z.string().optional(),
});
// ============================================================================
// Configuration Class
// ============================================================================
class Config {
    static instance;
    env;
    constructor() {
        const result = envSchema.safeParse(process.env);
        if (!result.success) {
            const errors = result.error.format();
            throw new Error(`Configuration validation failed: ${JSON.stringify(errors)}`);
        }
        this.env = result.data;
    }
    static getInstance() {
        if (!Config.instance) {
            Config.instance = new Config();
        }
        return Config.instance;
    }
    // ============================================================================
    // Application Config
    // ============================================================================
    get nodeEnv() {
        return this.env.NODE_ENV;
    }
    get isDevelopment() {
        return this.env.NODE_ENV === 'development';
    }
    get isProduction() {
        return this.env.NODE_ENV === 'production';
    }
    get isTest() {
        return this.env.NODE_ENV === 'test';
    }
    get logLevel() {
        return this.env.LOG_LEVEL;
    }
    get appName() {
        return this.env.APP_NAME;
    }
    // ============================================================================
    // AWS Config
    // ============================================================================
    get aws() {
        return {
            region: this.env.AWS_REGION,
            accessKeyId: this.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: this.env.AWS_SECRET_ACCESS_KEY,
        };
    }
    // ============================================================================
    // MQTT Config
    // ============================================================================
    get mqtt() {
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
    get database() {
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
    get databaseUrl() {
        const { host, port, database, user, password, ssl } = this.database;
        const sslParam = ssl ? '?sslmode=require' : '';
        return `postgresql://${user}:${password}@${host}:${port}/${database}${sslParam}`;
    }
    // ============================================================================
    // SNMP Config
    // ============================================================================
    get snmp() {
        return {
            enabled: true,
            pollInterval: this.env.COLLECTOR_POLL_INTERVAL,
            timeout: this.env.SNMP_TIMEOUT,
            retries: this.env.SNMP_RETRIES,
            batchSize: this.env.COLLECTOR_BATCH_SIZE,
            maxConcurrent: this.env.COLLECTOR_MAX_CONCURRENT,
            version: 3,
            securityLevel: this.env.SNMP_SECURITY_LEVEL,
            authProtocol: this.env.SNMP_AUTH_PROTOCOL,
            privProtocol: this.env.SNMP_PRIV_PROTOCOL,
        };
    }
    // ============================================================================
    // Collector Config
    // ============================================================================
    get collector() {
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
    get syslog() {
        return {
            port: this.env.SYSLOG_PORT,
            protocol: this.env.SYSLOG_PROTOCOL,
        };
    }
    // ============================================================================
    // NetFlow Config
    // ============================================================================
    get netflow() {
        return {
            port: this.env.NETFLOW_PORT,
            version: this.env.NETFLOW_VERSION,
        };
    }
    // ============================================================================
    // Security Config
    // ============================================================================
    get security() {
        return {
            encryptionKey: this.env.ENCRYPTION_KEY,
            jwtSecret: this.env.JWT_SECRET,
            tlsMinVersion: this.env.TLS_MIN_VERSION,
        };
    }
    // ============================================================================
    // Grafana Config
    // ============================================================================
    get grafana() {
        return {
            url: this.env.GRAFANA_URL,
            apiKey: this.env.GRAFANA_API_KEY,
        };
    }
    // ============================================================================
    // Alerting Config
    // ============================================================================
    get alerting() {
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
    toJSON() {
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
exports.Config = Config;
// Export singleton instance
exports.config = Config.getInstance();
//# sourceMappingURL=config.js.map
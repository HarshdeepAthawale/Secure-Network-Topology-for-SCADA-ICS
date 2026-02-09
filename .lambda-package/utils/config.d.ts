/**
 * Configuration loader for SCADA Topology Discovery
 * Loads environment variables and provides typed configuration
 */
import { SNMPConfig, MQTTConfig, DatabaseConfig, CollectorConfig } from './types';
declare class Config {
    private static instance;
    private env;
    private constructor();
    static getInstance(): Config;
    get nodeEnv(): string;
    get isDevelopment(): boolean;
    get isProduction(): boolean;
    get isTest(): boolean;
    get logLevel(): string;
    get appName(): string;
    get aws(): {
        region: string;
        accessKeyId?: string;
        secretAccessKey?: string;
    };
    get mqtt(): MQTTConfig;
    get database(): DatabaseConfig;
    get databaseUrl(): string;
    get snmp(): SNMPConfig;
    get collector(): CollectorConfig;
    get syslog(): {
        port: number;
        protocol: 'udp' | 'tcp';
    };
    get netflow(): {
        port: number;
        version: number;
    };
    get security(): {
        encryptionKey?: string;
        jwtSecret?: string;
        tlsMinVersion: string;
    };
    get grafana(): {
        url: string;
        apiKey?: string;
    };
    get alerting(): {
        email: {
            enabled: boolean;
            smtpHost?: string;
            smtpPort: number;
            from?: string;
            to?: string;
        };
        webhook?: string;
    };
    /**
     * Get all configuration as a plain object (for debugging)
     * Note: Sensitive values are masked
     */
    toJSON(): Record<string, unknown>;
}
export declare const config: Config;
export { Config };
//# sourceMappingURL=config.d.ts.map
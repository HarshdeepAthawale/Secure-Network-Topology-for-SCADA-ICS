/**
 * EC2 MQTT to RDS Service
 * Subscribes to AWS IoT Core MQTT topics and writes telemetry data to RDS PostgreSQL
 */
interface ServiceConfig {
    iotEndpoint: string;
    topic: string;
    certPath: string;
    keyPath: string;
    caPath: string;
    clientId: string;
}
export declare class MQTTToRDSService {
    private client;
    private config;
    private processedCount;
    private deviceIpMap;
    private isRunning;
    constructor(config?: Partial<ServiceConfig>);
    start(): Promise<void>;
    stop(): Promise<void>;
    private processMessage;
    private reconstituteTelemetry;
    private processSNMP;
    private extractIpFromInterfaces;
    private processARP;
    private processNetFlow;
    private resolveDeviceId;
    private processSyslog;
}
export {};
//# sourceMappingURL=mqtt-to-rds-service.d.ts.map
/**
 * MQTT Ingest Processor - Subscribes to MQTT telemetry topic,
 * processes through the existing pipeline, and stores in PostgreSQL
 */
export declare class MQTTIngestProcessor {
    private client;
    private readonly brokerUrl;
    private readonly topic;
    private processedCount;
    private deviceIpMap;
    constructor(brokerUrl?: string, topic?: string);
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
//# sourceMappingURL=mqtt-ingest.d.ts.map
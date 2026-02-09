/**
 * SCADA Data Generator - Generates realistic SCADA/ICS telemetry
 * and publishes to MQTT broker for pipeline testing
 */
export declare class DataGenerator {
    private client;
    private interval;
    private readonly brokerUrl;
    private readonly topic;
    private tickCount;
    constructor(brokerUrl?: string, topic?: string);
    start(): Promise<void>;
    stop(): Promise<void>;
    private generateAndPublish;
    private generateSNMPBatch;
    private generateARPTelemetry;
    private generateNetFlowTelemetry;
    private generateSyslogTelemetry;
    private generateSyslogMessages;
    private publish;
    private pickRandom;
}
//# sourceMappingURL=data-generator.d.ts.map
/**
 * TLS-secured MQTT client for AWS IoT Core communication
 */
import { EventEmitter } from 'events';
export interface MQTTMessage {
    topic: string;
    payload: unknown;
    qos: 0 | 1 | 2;
    retain: boolean;
}
export interface PublishOptions {
    qos?: 0 | 1 | 2;
    retain?: boolean;
}
export type MessageHandler = (topic: string, payload: unknown) => void | Promise<void>;
export declare class MQTTClient extends EventEmitter {
    private client;
    private readonly clientId;
    private readonly handlers;
    private reconnectAttempts;
    private readonly maxReconnectAttempts;
    private isConnecting;
    private isConnected;
    constructor();
    /**
     * Connect to the MQTT broker
     */
    connect(): Promise<void>;
    /**
     * Load TLS certificates for secure connection
     */
    private loadTLSCertificates;
    /**
     * Disconnect from the MQTT broker
     */
    disconnect(): Promise<void>;
    /**
     * Publish a message to a topic
     */
    publish(topic: string, payload: unknown, options?: PublishOptions): Promise<void>;
    /**
     * Publish telemetry data
     */
    publishTelemetry(data: unknown): Promise<void>;
    /**
     * Publish an alert
     */
    publishAlert(alert: unknown): Promise<void>;
    /**
     * Subscribe to a topic
     */
    subscribe(topic: string, handler: MessageHandler): Promise<void>;
    /**
     * Unsubscribe from a topic
     */
    unsubscribe(topic: string): Promise<void>;
    /**
     * Handle incoming messages
     */
    private handleMessage;
    /**
     * Check if a topic matches a pattern (supports + and # wildcards)
     */
    private topicMatches;
    /**
     * Check if connected
     */
    get connected(): boolean;
    /**
     * Get client ID
     */
    get id(): string;
}
export declare function getMQTTClient(): MQTTClient;
export declare function resetMQTTClient(): void;
//# sourceMappingURL=mqtt-client.d.ts.map
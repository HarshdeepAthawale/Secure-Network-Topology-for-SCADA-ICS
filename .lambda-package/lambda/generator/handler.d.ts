/**
 * Data Generator Lambda - Generates SCADA telemetry data and publishes to IoT Core MQTT
 */
import { ScheduledEvent } from 'aws-lambda';
interface GenerationResult {
    success: boolean;
    messagesPublished: number;
    errors: string[];
}
/**
 * Lambda handler - triggered by EventBridge schedule (every 10 seconds)
 */
export declare function handler(event: ScheduledEvent): Promise<GenerationResult>;
export {};
//# sourceMappingURL=handler.d.ts.map
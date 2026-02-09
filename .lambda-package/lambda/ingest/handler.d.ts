/**
 * Ingestion Lambda - AWS IoT Core message processing
 */
import { IoTEvent } from 'aws-lambda';
interface ProcessingResult {
    success: boolean;
    processedCount: number;
    failedCount: number;
    errors: string[];
}
export declare function handler(event: IoTEvent): Promise<ProcessingResult>;
export declare function validateTelemetry(data: unknown): Promise<{
    valid: boolean;
    errors?: string[];
}>;
export {};
//# sourceMappingURL=handler.d.ts.map
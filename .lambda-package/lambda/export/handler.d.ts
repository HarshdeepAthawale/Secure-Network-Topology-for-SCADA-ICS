/**
 * Export Lambda - Report generation and data export
 */
import { ScheduledHandler } from 'aws-lambda';
export declare const handler: ScheduledHandler;
export declare function exportTopologyToCSV(): Promise<string>;
export declare function exportAlertsToJSON(): Promise<string>;
//# sourceMappingURL=handler.d.ts.map
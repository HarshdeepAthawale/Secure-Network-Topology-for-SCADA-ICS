/**
 * Ingestion Lambda - AWS IoT Core message processing
 */

import { IoTEvent } from 'aws-lambda';
import { TelemetryData, TelemetrySource } from '../../utils/types';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';
import { telemetryDataSchema, safeValidate, formatValidationErrors } from '../../utils/validators';

interface IoTTelemetryPayload {
  collector: string;
  source: TelemetrySource;
  timestamp: string;
  count: number;
  data: TelemetryData[];
}

interface ProcessingResult {
  success: boolean;
  processedCount: number;
  failedCount: number;
  errors: string[];
}

export async function handler(event: IoTEvent): Promise<ProcessingResult> {
  const requestId = generateUUID();
  logger.setContext({ requestId, function: 'ingest' });
  logger.info('Processing IoT telemetry event');

  const result: ProcessingResult = {
    success: true,
    processedCount: 0,
    failedCount: 0,
    errors: [],
  };

  try {
    const payload = parsePayload(event);

    if (!payload) {
      result.success = false;
      result.errors.push('Invalid payload format');
      return result;
    }

    logger.info('Payload parsed', {
      collector: payload.collector,
      source: payload.source,
      dataCount: payload.count,
    });

    // Validate and process each telemetry item
    for (const item of payload.data) {
      try {
        const enriched = enrichTelemetry(item, payload);
        await storeTelemetry(enriched);
        result.processedCount++;
      } catch (error) {
        result.failedCount++;
        result.errors.push((error as Error).message);
        logger.error('Failed to process telemetry item', { error: (error as Error).message });
      }
    }

    result.success = result.failedCount === 0;
    logger.info('Ingestion complete', {
      processed: result.processedCount,
      failed: result.failedCount,
    });

  } catch (error) {
    result.success = false;
    result.errors.push((error as Error).message);
    logger.exception(error as Error, 'Ingestion failed');
  }

  return result;
}

function parsePayload(event: IoTEvent): IoTTelemetryPayload | null {
  try {
    if (typeof event === 'string') {
      return JSON.parse(event);
    }
    return event as unknown as IoTTelemetryPayload;
  } catch {
    return null;
  }
}

function enrichTelemetry(item: TelemetryData, payload: IoTTelemetryPayload): TelemetryData {
  return {
    ...item,
    id: item.id || generateUUID(),
    timestamp: item.timestamp || new Date(payload.timestamp),
    source: item.source || payload.source,
    processed: false,
    metadata: {
      ...item.metadata,
      collector: payload.collector,
      ingestedAt: new Date().toISOString(),
    },
  };
}

async function storeTelemetry(item: TelemetryData): Promise<void> {
  // In production, this would store to RDS/DynamoDB/S3
  logger.debug('Storing telemetry', { id: item.id, source: item.source });

  // Placeholder for database storage
  // await db.telemetry.insert(item);
}

export async function validateTelemetry(data: unknown): Promise<{ valid: boolean; errors?: string[] }> {
  const result = safeValidate(telemetryDataSchema, data);

  if (result.success) {
    return { valid: true };
  }

  return {
    valid: false,
    errors: result.errors ? formatValidationErrors(result.errors) : ['Unknown validation error'],
  };
}

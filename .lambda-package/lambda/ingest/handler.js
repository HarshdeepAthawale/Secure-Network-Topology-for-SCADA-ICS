"use strict";
/**
 * Ingestion Lambda - AWS IoT Core message processing
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = handler;
exports.validateTelemetry = validateTelemetry;
const logger_1 = require("../../utils/logger");
const crypto_1 = require("../../utils/crypto");
const validators_1 = require("../../utils/validators");
const database_1 = require("../../database");
async function handler(event) {
    const requestId = (0, crypto_1.generateUUID)();
    logger_1.logger.setContext({ requestId, function: 'ingest' });
    logger_1.logger.info('Processing IoT telemetry event');
    const result = {
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
        logger_1.logger.info('Payload parsed', {
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
            }
            catch (error) {
                result.failedCount++;
                result.errors.push(error.message);
                logger_1.logger.error('Failed to process telemetry item', { error: error.message });
            }
        }
        result.success = result.failedCount === 0;
        logger_1.logger.info('Ingestion complete', {
            processed: result.processedCount,
            failed: result.failedCount,
        });
    }
    catch (error) {
        result.success = false;
        result.errors.push(error.message);
        logger_1.logger.exception(error, 'Ingestion failed');
    }
    return result;
}
function parsePayload(event) {
    try {
        if (typeof event === 'string') {
            return JSON.parse(event);
        }
        return event;
    }
    catch {
        return null;
    }
}
function enrichTelemetry(item, payload) {
    return {
        ...item,
        id: item.id || (0, crypto_1.generateUUID)(),
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
async function storeTelemetry(item) {
    try {
        await (0, database_1.initializeDatabase)();
        const telemetryRepo = (0, database_1.getTelemetryRepository)();
        await telemetryRepo.insertTelemetry({
            id: item.id,
            source: item.source,
            deviceId: item.deviceId,
            timestamp: item.timestamp,
            data: item.data,
            raw: item.raw,
            processed: false,
            metadata: item.metadata,
        });
        logger_1.logger.debug('Telemetry stored successfully', { id: item.id, source: item.source });
    }
    catch (error) {
        logger_1.logger.error('Failed to store telemetry', {
            id: item.id,
            error: error.message
        });
        throw error;
    }
}
async function validateTelemetry(data) {
    const result = (0, validators_1.safeValidate)(validators_1.telemetryDataSchema, data);
    if (result.success) {
        return { valid: true };
    }
    return {
        valid: false,
        errors: result.errors ? (0, validators_1.formatValidationErrors)(result.errors) : ['Unknown validation error'],
    };
}
//# sourceMappingURL=handler.js.map
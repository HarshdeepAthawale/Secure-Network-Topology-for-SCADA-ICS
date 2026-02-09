"use strict";
/**
 * Query Lambda - API Gateway handler for topology queries
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.handler = void 0;
const logger_1 = require("../../utils/logger");
const crypto_1 = require("../../utils/crypto");
const database_1 = require("../../database");
const handler = async (event) => {
    const requestId = (0, crypto_1.generateUUID)();
    logger_1.logger.setContext({ requestId, function: 'query' });
    const method = event.httpMethod;
    const path = event.path;
    logger_1.logger.info('API request', { method, path });
    try {
        // Route handling
        if (path === '/topology' && method === 'GET') {
            return await getTopology(event.queryStringParameters || {});
        }
        if (path.startsWith('/devices') && method === 'GET') {
            const deviceId = event.pathParameters?.deviceId;
            return deviceId ? await getDevice(deviceId) : await listDevices(event.queryStringParameters || {});
        }
        if (path.startsWith('/connections') && method === 'GET') {
            return await listConnections(event.queryStringParameters || {});
        }
        if (path.startsWith('/alerts') && method === 'GET') {
            return await listAlerts(event.queryStringParameters || {});
        }
        if (path === '/health' && method === 'GET') {
            return success({ status: 'healthy', timestamp: new Date().toISOString() });
        }
        return notFound('Route not found');
    }
    catch (error) {
        logger_1.logger.exception(error, 'Query failed');
        return serverError(error.message);
    }
};
exports.handler = handler;
async function getTopology(params) {
    await (0, database_1.initializeDatabase)();
    const snapshotRepo = (0, database_1.getTopologySnapshotRepository)();
    // Get the latest topology snapshot
    const snapshot = await snapshotRepo.getLatest();
    if (!snapshot) {
        // If no snapshot exists, return empty topology
        return success({
            id: (0, crypto_1.generateUUID)(),
            timestamp: new Date(),
            devices: [],
            connections: [],
            zones: [],
            metadata: {
                deviceCount: 0,
                connectionCount: 0,
                collectionDuration: 0,
                sources: [],
            },
        });
    }
    return success(snapshot);
}
async function getDevice(deviceId) {
    await (0, database_1.initializeDatabase)();
    const deviceRepo = (0, database_1.getDeviceRepository)();
    logger_1.logger.info('Getting device', { deviceId });
    const device = await deviceRepo.findByIdWithInterfaces(deviceId);
    if (!device) {
        return notFound(`Device ${deviceId} not found`);
    }
    return success(device);
}
async function listDevices(params) {
    await (0, database_1.initializeDatabase)();
    const deviceRepo = (0, database_1.getDeviceRepository)();
    const limit = parseInt(params.limit || '50', 10);
    const offset = parseInt(params.offset || '0', 10);
    const page = Math.floor(offset / limit) + 1;
    const level = params.level ? parseInt(params.level, 10) : undefined;
    const zone = params.zone;
    const status = params.status;
    logger_1.logger.info('Listing devices', { limit, offset, level, zone, status });
    const result = await deviceRepo.search({
        purdueLevel: level,
        securityZone: zone,
        status,
    }, page, limit);
    return success({
        data: result.data,
        pagination: {
            limit,
            offset,
            total: result.pagination.total,
            hasMore: result.pagination.hasNext,
        },
    });
}
async function listConnections(params) {
    await (0, database_1.initializeDatabase)();
    const connectionRepo = (0, database_1.getConnectionRepository)();
    const limit = parseInt(params.limit || '100', 10);
    const offset = parseInt(params.offset || '0', 10);
    const page = Math.floor(offset / limit) + 1;
    logger_1.logger.info('Listing connections', { limit, offset });
    const result = await connectionRepo.search({}, page, limit);
    return success({
        data: result.data,
        pagination: {
            limit,
            offset,
            total: result.pagination.total,
            hasMore: result.pagination.hasNext,
        },
    });
}
async function listAlerts(params) {
    await (0, database_1.initializeDatabase)();
    const alertRepo = (0, database_1.getAlertRepository)();
    const limit = parseInt(params.limit || '50', 10);
    const offset = parseInt(params.offset || '0', 10);
    const page = Math.floor(offset / limit) + 1;
    const status = params.status || 'active';
    const resolved = status === 'resolved';
    logger_1.logger.info('Listing alerts', { limit, offset, status });
    const result = await alertRepo.search({
        resolved,
    }, page, limit);
    return success({
        data: result.data,
        pagination: {
            limit,
            offset,
            total: result.pagination.total,
            hasMore: result.pagination.hasNext,
        },
    });
}
// Response helpers
function success(body) {
    return {
        statusCode: 200,
        headers: corsHeaders(),
        body: JSON.stringify(body),
    };
}
function notFound(message) {
    return {
        statusCode: 404,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Not Found', message }),
    };
}
function serverError(message) {
    return {
        statusCode: 500,
        headers: corsHeaders(),
        body: JSON.stringify({ error: 'Internal Server Error', message }),
    };
}
function corsHeaders() {
    return {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    };
}
//# sourceMappingURL=handler.js.map
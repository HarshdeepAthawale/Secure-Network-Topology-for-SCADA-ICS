/**
 * Query Lambda - API Gateway handler for topology queries
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyHandler } from 'aws-lambda';
import { Device, Connection, TopologySnapshot, Alert, PurdueLevel, SecurityZone, DeviceStatus } from '../../utils/types';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';
import {
  initializeDatabase,
  getDeviceRepository,
  getConnectionRepository,
  getAlertRepository,
  getTopologySnapshotRepository,
} from '../../database';

interface QueryParams {
  deviceId?: string;
  level?: string;
  zone?: string;
  status?: string;
  limit?: string;
  offset?: string;
}

export const handler: APIGatewayProxyHandler = async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
  const requestId = generateUUID();
  logger.setContext({ requestId, function: 'query' });

  const method = event.httpMethod;
  const path = event.path;

  logger.info('API request', { method, path });

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
  } catch (error) {
    logger.exception(error as Error, 'Query failed');
    return serverError((error as Error).message);
  }
};

async function getTopology(params: QueryParams): Promise<APIGatewayProxyResult> {
  await initializeDatabase();
  const snapshotRepo = getTopologySnapshotRepository();

  // Get the latest topology snapshot
  const snapshot = await snapshotRepo.getLatest();

  if (!snapshot) {
    // If no snapshot exists, return empty topology
    return success({
      id: generateUUID(),
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

async function getDevice(deviceId: string): Promise<APIGatewayProxyResult> {
  await initializeDatabase();
  const deviceRepo = getDeviceRepository();

  logger.info('Getting device', { deviceId });

  const device = await deviceRepo.findByIdWithInterfaces(deviceId);

  if (!device) {
    return notFound(`Device ${deviceId} not found`);
  }

  return success(device);
}

async function listDevices(params: QueryParams): Promise<APIGatewayProxyResult> {
  await initializeDatabase();
  const deviceRepo = getDeviceRepository();

  const limit = parseInt(params.limit || '50', 10);
  const offset = parseInt(params.offset || '0', 10);
  const page = Math.floor(offset / limit) + 1;
  const level = params.level ? parseInt(params.level, 10) as PurdueLevel : undefined;
  const zone = params.zone as SecurityZone | undefined;
  const status = params.status as DeviceStatus | undefined;

  logger.info('Listing devices', { limit, offset, level, zone, status });

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

async function listConnections(params: QueryParams): Promise<APIGatewayProxyResult> {
  await initializeDatabase();
  const connectionRepo = getConnectionRepository();

  const limit = parseInt(params.limit || '100', 10);
  const offset = parseInt(params.offset || '0', 10);
  const page = Math.floor(offset / limit) + 1;

  logger.info('Listing connections', { limit, offset });

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

async function listAlerts(params: QueryParams): Promise<APIGatewayProxyResult> {
  await initializeDatabase();
  const alertRepo = getAlertRepository();

  const limit = parseInt(params.limit || '50', 10);
  const offset = parseInt(params.offset || '0', 10);
  const page = Math.floor(offset / limit) + 1;
  const status = params.status || 'active';
  const resolved = status === 'resolved';

  logger.info('Listing alerts', { limit, offset, status });

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
function success(body: unknown): APIGatewayProxyResult {
  return {
    statusCode: 200,
    headers: corsHeaders(),
    body: JSON.stringify(body),
  };
}

function notFound(message: string): APIGatewayProxyResult {
  return {
    statusCode: 404,
    headers: corsHeaders(),
    body: JSON.stringify({ error: 'Not Found', message }),
  };
}

function serverError(message: string): APIGatewayProxyResult {
  return {
    statusCode: 500,
    headers: corsHeaders(),
    body: JSON.stringify({ error: 'Internal Server Error', message }),
  };
}

function corsHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  };
}

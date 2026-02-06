/**
 * Query Lambda - API Gateway handler for topology queries
 */

import { APIGatewayProxyEvent, APIGatewayProxyResult, APIGatewayProxyHandler } from 'aws-lambda';
import { Device, Connection, TopologySnapshot, Alert, PurdueLevel } from '../../utils/types';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';

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
  // Placeholder - would query database
  const snapshot: Partial<TopologySnapshot> = {
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
  };

  return success(snapshot);
}

async function getDevice(deviceId: string): Promise<APIGatewayProxyResult> {
  // Placeholder - would query database
  logger.info('Getting device', { deviceId });

  // Simulated response
  return notFound(`Device ${deviceId} not found`);
}

async function listDevices(params: QueryParams): Promise<APIGatewayProxyResult> {
  const limit = parseInt(params.limit || '50', 10);
  const offset = parseInt(params.offset || '0', 10);
  const level = params.level ? parseInt(params.level, 10) as PurdueLevel : undefined;

  logger.info('Listing devices', { limit, offset, level });

  // Placeholder - would query database
  const devices: Device[] = [];

  return success({
    data: devices,
    pagination: {
      limit,
      offset,
      total: 0,
      hasMore: false,
    },
  });
}

async function listConnections(params: QueryParams): Promise<APIGatewayProxyResult> {
  const limit = parseInt(params.limit || '100', 10);
  const offset = parseInt(params.offset || '0', 10);

  logger.info('Listing connections', { limit, offset });

  // Placeholder - would query database
  const connections: Connection[] = [];

  return success({
    data: connections,
    pagination: {
      limit,
      offset,
      total: 0,
      hasMore: false,
    },
  });
}

async function listAlerts(params: QueryParams): Promise<APIGatewayProxyResult> {
  const limit = parseInt(params.limit || '50', 10);
  const offset = parseInt(params.offset || '0', 10);
  const status = params.status || 'active';

  logger.info('Listing alerts', { limit, offset, status });

  // Placeholder - would query database
  const alerts: Alert[] = [];

  return success({
    data: alerts,
    pagination: {
      limit,
      offset,
      total: 0,
      hasMore: false,
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

/**
 * Integration tests for Lambda Handlers
 */

import { handler as ingestHandler } from '../../../src/lambda/ingest/handler';
import { handler as processHandler } from '../../../src/lambda/process/handler';
import { handler as queryHandler } from '../../../src/lambda/query/handler';
import { TelemetrySource } from '../../../src/utils/types';

// Mock database connection
jest.mock('../../../src/database', () => ({
    initializeDatabase: jest.fn().mockResolvedValue(undefined),
    closeDatabase: jest.fn().mockResolvedValue(undefined),
    getDeviceRepository: jest.fn(() => mockDeviceRepo),
    getConnectionRepository: jest.fn(() => mockConnectionRepo),
    getAlertRepository: jest.fn(() => mockAlertRepo),
    getTelemetryRepository: jest.fn(() => mockTelemetryRepo),
    getTopologySnapshotRepository: jest.fn(() => mockSnapshotRepo),
}));

const mockDeviceRepo = {
    search: jest.fn().mockResolvedValue({ data: [], pagination: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrevious: false } }),
    findById: jest.fn().mockResolvedValue(null),
    findByIdWithInterfaces: jest.fn().mockResolvedValue(null),
};

const mockConnectionRepo = {
    search: jest.fn().mockResolvedValue({ data: [], pagination: { total: 0, page: 1, limit: 100, totalPages: 0, hasNext: false, hasPrevious: false } }),
};

const mockAlertRepo = {
    search: jest.fn().mockResolvedValue({ data: [], pagination: { total: 0, page: 1, limit: 50, totalPages: 0, hasNext: false, hasPrevious: false } }),
    create: jest.fn().mockImplementation((data) => Promise.resolve({ ...data, createdAt: new Date() })),
};

const mockTelemetryRepo = {
    insertTelemetry: jest.fn().mockResolvedValue({}),
};

const mockSnapshotRepo = {
    getLatest: jest.fn().mockResolvedValue(null),
    createSnapshot: jest.fn().mockImplementation((data) => Promise.resolve(data)),
};

describe('Lambda Handlers Integration', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Ingest Handler', () => {
        it('should process IoT telemetry event', async () => {
            const event = {
                records: [
                    {
                        payload: Buffer.from(JSON.stringify({
                            collector: 'snmp',
                            timestamp: new Date().toISOString(),
                            data: [
                                {
                                    source: TelemetrySource.SNMP,
                                    timestamp: new Date().toISOString(),
                                    data: { oid: '1.3.6.1.2.1.1.1.0', value: 'Test Device' },
                                },
                            ],
                        })).toString('base64'),
                    },
                ],
            };

            await expect(ingestHandler(event as any, {} as any, {} as any)).resolves.not.toThrow();
        });

        it('should handle empty records', async () => {
            const event = {
                records: [],
            };

            await expect(ingestHandler(event as any, {} as any, {} as any)).resolves.not.toThrow();
        });
    });

    describe('Process Handler', () => {
        it('should process SQS telemetry batch', async () => {
            const event = {
                Records: [
                    {
                        messageId: 'msg-1',
                        body: JSON.stringify({
                            id: 'tel-1',
                            source: TelemetrySource.SNMP,
                            timestamp: new Date().toISOString(),
                            data: {
                                sysName: 'TestDevice',
                                sysDescr: 'Test SNMP Device',
                                sysObjectID: '1.3.6.1.4.1.9.1.1',
                            },
                        }),
                    },
                ],
            };

            await expect(processHandler(event as any, {} as any, () => { })).resolves.not.toThrow();
        });

        it('should handle malformed message gracefully', async () => {
            const event = {
                Records: [
                    {
                        messageId: 'msg-1',
                        body: 'not-json',
                    },
                ],
            };

            // Should not throw, but log error
            await expect(processHandler(event as any, {} as any, () => { })).resolves.not.toThrow();
        });
    });

    describe('Query Handler', () => {
        it('should handle health check', async () => {
            const event = {
                httpMethod: 'GET',
                path: '/health',
                queryStringParameters: null,
                pathParameters: null,
            };

            const result = await queryHandler(event as any, {} as any, () => { });

            expect(result).toBeDefined();
            expect(result?.statusCode).toBe(200);
            const body = JSON.parse(result?.body || '{}');
            expect(body.status).toBe('healthy');
        });

        it('should handle topology request', async () => {
            const event = {
                httpMethod: 'GET',
                path: '/topology',
                queryStringParameters: null,
                pathParameters: null,
            };

            const result = await queryHandler(event as any, {} as any, () => { });

            expect(result).toBeDefined();
            expect(result?.statusCode).toBe(200);
        });

        it('should handle device list request', async () => {
            mockDeviceRepo.search.mockResolvedValue({
                data: [
                    { id: 'd1', name: 'Device 1', type: 'plc', status: 'online' },
                ],
                pagination: { total: 1, page: 1, limit: 50, totalPages: 1, hasNext: false, hasPrevious: false },
            });

            const event = {
                httpMethod: 'GET',
                path: '/devices',
                queryStringParameters: { limit: '50', offset: '0' },
                pathParameters: null,
            };

            const result = await queryHandler(event as any, {} as any, () => { });

            expect(result?.statusCode).toBe(200);
            const body = JSON.parse(result?.body || '{}');
            expect(body.data).toBeDefined();
            expect(body.pagination).toBeDefined();
        });

        it('should handle device not found', async () => {
            mockDeviceRepo.findByIdWithInterfaces.mockResolvedValue(null);

            const event = {
                httpMethod: 'GET',
                path: '/devices/nonexistent',
                queryStringParameters: null,
                pathParameters: { deviceId: 'nonexistent' },
            };

            const result = await queryHandler(event as any, {} as any, () => { });

            expect(result?.statusCode).toBe(404);
        });

        it('should handle alerts list request', async () => {
            const event = {
                httpMethod: 'GET',
                path: '/alerts',
                queryStringParameters: { status: 'active' },
                pathParameters: null,
            };

            const result = await queryHandler(event as any, {} as any, () => { });

            expect(result?.statusCode).toBe(200);
        });

        it('should return 404 for unknown routes', async () => {
            const event = {
                httpMethod: 'GET',
                path: '/unknown',
                queryStringParameters: null,
                pathParameters: null,
            };

            const result = await queryHandler(event as any, {} as any, () => { });

            expect(result?.statusCode).toBe(404);
        });

        it('should handle connections list request', async () => {
            const event = {
                httpMethod: 'GET',
                path: '/connections',
                queryStringParameters: null,
                pathParameters: null,
            };

            const result = await queryHandler(event as any, {} as any, () => { });

            expect(result?.statusCode).toBe(200);
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            mockDeviceRepo.search.mockRejectedValue(new Error('Database connection failed'));

            const event = {
                httpMethod: 'GET',
                path: '/devices',
                queryStringParameters: null,
                pathParameters: null,
            };

            const result = await queryHandler(event as any, {} as any, () => { });

            expect(result?.statusCode).toBe(500);
        });
    });
});

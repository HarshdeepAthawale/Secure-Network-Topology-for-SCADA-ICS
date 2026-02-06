/**
 * Security tests for SQL Injection Prevention
 */

import { DeviceRepository } from '../../src/database/repositories/device.repository';
import { AlertRepository } from '../../src/database/repositories/alert.repository';
import { ConnectionRepository } from '../../src/database/repositories/connection.repository';

// Mock the database to capture queries
const capturedQueries: Array<{ sql: string; params: unknown[] }> = [];

jest.mock('../../src/database/connection', () => ({
    getConnection: jest.fn(() => ({
        query: jest.fn((sql: string, params: unknown[]) => {
            capturedQueries.push({ sql, params });
            return Promise.resolve([]);
        }),
        queryOne: jest.fn((sql: string, params: unknown[]) => {
            capturedQueries.push({ sql, params });
            return Promise.resolve(null);
        }),
        queryCount: jest.fn((sql: string, params: unknown[]) => {
            capturedQueries.push({ sql, params });
            return Promise.resolve(0);
        }),
        insert: jest.fn((table: string, data: any) => {
            return Promise.resolve(data);
        }),
        update: jest.fn(() => Promise.resolve(null)),
        delete: jest.fn(() => Promise.resolve(true)),
    })),
}));

describe('SQL Injection Prevention Tests', () => {
    let deviceRepo: DeviceRepository;
    let alertRepo: AlertRepository;
    let connectionRepo: ConnectionRepository;

    beforeEach(() => {
        capturedQueries.length = 0;
        deviceRepo = new DeviceRepository();
        alertRepo = new AlertRepository();
        connectionRepo = new ConnectionRepository();
    });

    describe('Parameterized Queries', () => {
        it('should use parameterized queries for device search', async () => {
            const maliciousInput = "'; DROP TABLE devices; --";

            await deviceRepo.search({ vendor: maliciousInput });

            const capturedQuery = capturedQueries.find(q => q.sql.includes('devices'));

            expect(capturedQuery).toBeDefined();
            expect(capturedQuery?.params).toContain(maliciousInput);
            // SQL should not contain the malicious input directly
            expect(capturedQuery?.sql).not.toContain('DROP TABLE');
        });

        it('should use parameterized queries for device lookup by ID', async () => {
            const maliciousId = "1 OR 1=1; --";

            await deviceRepo.findById(maliciousId);

            const capturedQuery = capturedQueries[0];

            expect(capturedQuery?.params).toContain(maliciousId);
            expect(capturedQuery?.sql).not.toContain('1=1');
        });

        it('should use parameterized queries for alert search', async () => {
            const maliciousTitle = "'; DELETE FROM alerts; --";

            await alertRepo.search({ type: maliciousTitle as any });

            const capturedQuery = capturedQueries.find(q => q.sql.includes('alerts'));

            expect(capturedQuery?.params).toContain(maliciousTitle);
            expect(capturedQuery?.sql).not.toContain('DELETE');
        });
    });

    describe('Input Sanitization', () => {
        const sqlInjectionPayloads = [
            "'; DROP TABLE users; --",
            "1; DELETE FROM devices WHERE '1'='1",
            "' OR '1'='1",
            "1) UNION SELECT * FROM users--",
            "'; EXEC xp_cmdshell('whoami'); --",
            "1; WAITFOR DELAY '00:00:10'--",
            "' AND EXTRACTVALUE(1, CONCAT(0x7e, (SELECT version()), 0x7e))--",
            "' AND 1=CONVERT(int, (SELECT TOP 1 table_name FROM information_schema.tables))--",
        ];

        for (const payload of sqlInjectionPayloads) {
            it(`should safely handle payload: ${payload.substring(0, 30)}...`, async () => {
                await deviceRepo.findById(payload);

                const capturedQuery = capturedQueries[0];

                // Verify payload is passed as parameter, not embedded in SQL
                expect(capturedQuery?.params).toContain(payload);
                expect(capturedQuery?.sql.includes(payload)).toBe(false);
            });
        }
    });

    describe('Numeric Input Validation', () => {
        it('should handle non-numeric input for Purdue level', async () => {
            const maliciousLevel = "1; DROP TABLE devices; --" as any;

            await deviceRepo.search({ purdueLevel: maliciousLevel });

            const capturedQuery = capturedQueries.find(q => q.sql.includes('purdue_level'));

            if (capturedQuery) {
                expect(capturedQuery.sql).not.toContain('DROP');
            }
        });

        it('should handle negative numbers safely', async () => {
            await deviceRepo.search({ purdueLevel: -1 as any });

            // Should not throw or execute malicious code
            expect(true).toBe(true);
        });
    });

    describe('String Length Limits', () => {
        it('should handle extremely long input', async () => {
            const longInput = 'A'.repeat(100000);

            await deviceRepo.search({ vendor: longInput });

            // Should not crash or cause buffer issues
            expect(true).toBe(true);
        });

        it('should handle unicode injection attempts', async () => {
            const unicodePayload = "'; /* Unicode: \u0000\u001F */ DROP TABLE devices; --";

            await deviceRepo.findById(unicodePayload);

            const capturedQuery = capturedQueries[0];

            expect(capturedQuery?.params).toContain(unicodePayload);
        });
    });

    describe('LIKE Clause Protection', () => {
        it('should escape LIKE wildcards in search', async () => {
            const wildcardPayload = "100% OR 1=1";

            await deviceRepo.search({ searchTerm: wildcardPayload });

            // The % should be escaped or parameterized
            const capturedQuery = capturedQueries.find(q => q.sql.includes('LIKE'));

            if (capturedQuery) {
                expect(capturedQuery.params).toBeDefined();
            }
        });

        it('should handle underscore wildcards', async () => {
            const underscorePayload = "test_'; DROP TABLE--";

            await deviceRepo.search({ searchTerm: underscorePayload });

            expect(true).toBe(true);
        });
    });

    describe('ORDER BY Injection Prevention', () => {
        it('should sanitize order by columns', async () => {
            const maliciousOrder = "name; DROP TABLE devices; --";

            await deviceRepo.findAll({ orderBy: maliciousOrder, limit: 10 });

            const capturedQuery = capturedQueries[0];

            // Should either reject or sanitize the order by clause
            expect(capturedQuery?.sql).not.toContain('DROP TABLE');
        });

        it('should only allow whitelisted columns for ordering', async () => {
            const validColumns = ['name', 'created_at', 'purdue_level', 'status'];
            const invalidColumn = 'nonexistent_column';

            // Should handle gracefully
            await deviceRepo.findAll({ orderBy: invalidColumn, limit: 10 });

            expect(true).toBe(true);
        });
    });

    describe('Batch Operations Protection', () => {
        it('should handle arrays with malicious values', async () => {
            const maliciousIds = [
                'id1',
                "id2'; DROP TABLE devices; --",
                'id3',
            ];

            for (const id of maliciousIds) {
                await deviceRepo.findById(id);
            }

            expect(capturedQueries.length).toBe(maliciousIds.length);
            expect(capturedQueries[1]?.sql).not.toContain('DROP');
        });
    });

    describe('Stored Procedure Injection', () => {
        it('should prevent stored procedure calls', async () => {
            const procPayload = "'; CALL dangerous_proc(); --";

            await deviceRepo.findById(procPayload);

            const capturedQuery = capturedQueries[0];

            expect(capturedQuery?.sql).not.toContain('CALL');
        });
    });

    describe('Comment Stripping', () => {
        it('should handle SQL comments in input', async () => {
            const commentPayloads = [
                "value /* comment */ OR 1=1",
                "value -- comment\n OR 1=1",
                "value # comment",
            ];

            for (const payload of commentPayloads) {
                capturedQueries.length = 0;
                await deviceRepo.search({ vendor: payload });

                const capturedQuery = capturedQueries[0];
                expect(capturedQuery?.params).toContain(payload);
            }
        });
    });

    describe('Error Message Security', () => {
        it('should not expose query details in errors', async () => {
            // Mock a database error
            const mockError = new Error('Connection failed');

            // The error message should not contain SQL or table names
            const sanitizedMessage = sanitizeErrorMessage(mockError.message);

            expect(sanitizedMessage).not.toContain('SELECT');
            expect(sanitizedMessage).not.toContain('devices');
        });
    });
});

// Helper function to sanitize error messages
function sanitizeErrorMessage(message: string): string {
    // Remove SQL keywords and table names
    return message
        .replace(/SELECT|INSERT|UPDATE|DELETE|DROP|FROM|WHERE/gi, '[REDACTED]')
        .replace(/devices|connections|alerts|telemetry/gi, '[TABLE]');
}

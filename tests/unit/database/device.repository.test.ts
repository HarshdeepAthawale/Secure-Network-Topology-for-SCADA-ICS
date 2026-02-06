/**
 * Unit tests for Device Repository
 */

import { DeviceRepository, CreateDeviceDTO } from '../../../src/database/repositories/device.repository';
import { DeviceType, DeviceStatus, PurdueLevel, SecurityZone } from '../../../src/utils/types';

// Mock the database connection
jest.mock('../../../src/database/connection', () => ({
    getConnection: jest.fn(() => mockDb),
}));

const mockDb = {
    query: jest.fn(),
    queryOne: jest.fn(),
    queryCount: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    upsert: jest.fn(),
    bulkInsert: jest.fn(),
};

describe('DeviceRepository', () => {
    let repository: DeviceRepository;

    beforeEach(() => {
        jest.clearAllMocks();
        repository = new DeviceRepository();
    });

    describe('findById', () => {
        it('should return device when found', async () => {
            const mockDevice = {
                id: 'device-123',
                name: 'PLC-001',
                hostname: 'plc-001.scada.local',
                type: 'plc',
                vendor: 'Siemens',
                model: 'S7-1500',
                firmware_version: '2.9.3',
                serial_number: 'SN123456',
                purdue_level: '1',
                security_zone: 'ot_control',
                status: 'online',
                location: null,
                metadata: {},
                discovered_at: new Date('2024-01-01'),
                last_seen_at: new Date('2024-01-02'),
                created_at: new Date('2024-01-01'),
                updated_at: new Date('2024-01-02'),
            };

            mockDb.queryOne.mockResolvedValue(mockDevice);

            const result = await repository.findById('device-123');

            expect(result).not.toBeNull();
            expect(result?.id).toBe('device-123');
            expect(result?.name).toBe('PLC-001');
            expect(result?.purdueLevel).toBe(1);
            expect(result?.type).toBe('plc');
            expect(mockDb.queryOne).toHaveBeenCalledWith(
                expect.stringContaining('SELECT * FROM devices'),
                ['device-123']
            );
        });

        it('should return null when device not found', async () => {
            mockDb.queryOne.mockResolvedValue(null);

            const result = await repository.findById('nonexistent');

            expect(result).toBeNull();
        });
    });

    describe('create', () => {
        it('should create a new device', async () => {
            const createDto: CreateDeviceDTO = {
                name: 'HMI-001',
                hostname: 'hmi-001.scada.local',
                type: DeviceType.HMI,
                vendor: 'Rockwell',
                purdueLevel: PurdueLevel.LEVEL_2,
                securityZone: SecurityZone.SUPERVISORY,
                status: DeviceStatus.ONLINE,
                discoveredAt: new Date(),
                lastSeenAt: new Date(),
            };

            const mockInsertedDevice = {
                id: 'new-device-id',
                name: createDto.name,
                hostname: createDto.hostname,
                type: createDto.type,
                vendor: createDto.vendor,
                purdue_level: '2',
                security_zone: 'ot_supervisory',
                status: 'online',
                metadata: {},
                discovered_at: createDto.discoveredAt,
                last_seen_at: createDto.lastSeenAt,
                created_at: new Date(),
                updated_at: new Date(),
            };

            mockDb.insert.mockResolvedValue(mockInsertedDevice);

            const result = await repository.create(createDto);

            expect(result).toBeDefined();
            expect(mockDb.insert).toHaveBeenCalledWith(
                'devices',
                expect.objectContaining({
                    name: 'HMI-001',
                    type: DeviceType.HMI,
                }),
                '*'
            );
        });
    });

    describe('search', () => {
        it('should search devices by Purdue level', async () => {
            const mockDevices = [
                {
                    id: 'device-1',
                    name: 'PLC-001',
                    type: 'plc',
                    purdue_level: '1',
                    security_zone: 'ot_control',
                    status: 'online',
                    metadata: {},
                    discovered_at: new Date(),
                    last_seen_at: new Date(),
                    created_at: new Date(),
                    updated_at: new Date(),
                },
            ];

            mockDb.queryCount.mockResolvedValue(1);
            mockDb.query.mockResolvedValue(mockDevices);

            const result = await repository.search({ purdueLevel: PurdueLevel.LEVEL_1 });

            expect(result.data).toHaveLength(1);
            expect(result.pagination.total).toBe(1);
            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('purdue_level'),
                expect.arrayContaining(['1'])
            );
        });

        it('should return empty results for no matches', async () => {
            mockDb.queryCount.mockResolvedValue(0);
            mockDb.query.mockResolvedValue([]);

            const result = await repository.search({ vendor: 'NonexistentVendor' });

            expect(result.data).toHaveLength(0);
            expect(result.pagination.total).toBe(0);
        });
    });

    describe('findByPurdueLevel', () => {
        it('should return devices for specific Purdue level', async () => {
            const mockDevices = [
                {
                    id: 'device-1',
                    name: 'Sensor-001',
                    type: 'sensor',
                    purdue_level: '0',
                    security_zone: 'ot_process',
                    status: 'online',
                    metadata: {},
                    discovered_at: new Date(),
                    last_seen_at: new Date(),
                    created_at: new Date(),
                    updated_at: new Date(),
                },
            ];

            mockDb.query.mockResolvedValue(mockDevices);

            const result = await repository.findByPurdueLevel(PurdueLevel.LEVEL_0);

            expect(result).toHaveLength(1);
            expect(result[0].purdueLevel).toBe(0);
        });
    });

    describe('countByPurdueLevel', () => {
        it('should return count grouped by Purdue level', async () => {
            mockDb.query.mockResolvedValue([
                { purdue_level: '0', count: '5' },
                { purdue_level: '1', count: '10' },
                { purdue_level: '2', count: '3' },
            ]);

            const result = await repository.countByPurdueLevel();

            expect(result[0]).toBe(5);
            expect(result[1]).toBe(10);
            expect(result[2]).toBe(3);
        });
    });

    describe('updateLastSeen', () => {
        it('should update last seen timestamp', async () => {
            mockDb.query.mockResolvedValue([]);

            await repository.updateLastSeen('device-123');

            expect(mockDb.query).toHaveBeenCalledWith(
                expect.stringContaining('UPDATE devices SET last_seen_at'),
                ['device-123']
            );
        });
    });
});

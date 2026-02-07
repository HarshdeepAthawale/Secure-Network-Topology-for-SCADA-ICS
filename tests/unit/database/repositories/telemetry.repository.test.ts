/**
 * Unit tests for Telemetry Repository
 */

import { TelemetryRepository } from '../../../../src/database/repositories/telemetry.repository';

jest.mock('../../../../src/database/connection', () => ({
  getConnection: jest.fn(() => mockDb),
}));

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  insert: jest.fn(),
  bulkInsert: jest.fn(),
  delete: jest.fn(),
};

describe('TelemetryRepository', () => {
  let repository: TelemetryRepository;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new TelemetryRepository();
  });

  describe('insert', () => {
    it('should insert telemetry record', async () => {
      const telemetry = {
        id: 'telemetry-1',
        source: 'snmp-collector',
        sourceId: 'collector-1',
        timestamp: new Date(),
        data: { sysDescr: 'Cisco Device' },
      };

      mockDb.insert.mockResolvedValue({ id: 'telemetry-1' });

      const result = await repository.insert(telemetry);

      expect(result.id).toBe('telemetry-1');
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('bulkInsert', () => {
    it('should insert multiple telemetry records', async () => {
      const telemetries = [
        {
          id: 'telemetry-1',
          source: 'snmp-collector',
          sourceId: 'collector-1',
          timestamp: new Date(),
          data: {},
        },
        {
          id: 'telemetry-2',
          source: 'snmp-collector',
          sourceId: 'collector-1',
          timestamp: new Date(),
          data: {},
        },
      ];

      mockDb.bulkInsert.mockResolvedValue({ rowCount: 2 });

      const result = await repository.bulkInsert(telemetries);

      expect(mockDb.bulkInsert).toHaveBeenCalled();
    });
  });

  describe('findBySourceAndTime', () => {
    it('should find telemetry records by source and time range', async () => {
      const start = new Date('2024-01-01T10:00:00Z');
      const end = new Date('2024-01-01T11:00:00Z');

      const mockTelemetries = [
        { id: 'telemetry-1', source: 'snmp-collector', timestamp: start },
        { id: 'telemetry-2', source: 'snmp-collector', timestamp: end },
      ];

      mockDb.query.mockResolvedValue(mockTelemetries);

      const result = await repository.findBySourceAndTime('snmp-collector', start, end);

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('findBySourceIdAndTime', () => {
    it('should find telemetry records by source ID and time range', async () => {
      const start = new Date('2024-01-01T10:00:00Z');
      const end = new Date('2024-01-01T11:00:00Z');

      mockDb.query.mockResolvedValue([]);

      const result = await repository.findBySourceIdAndTime('collector-1', start, end);

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('getLatestBySource', () => {
    it('should get latest telemetry for each source', async () => {
      const mockTelemetries = [
        { source: 'snmp-collector', timestamp: new Date('2024-01-01T10:00:00Z') },
        { source: 'arp-collector', timestamp: new Date('2024-01-01T10:00:00Z') },
      ];

      mockDb.query.mockResolvedValue(mockTelemetries);

      const result = await repository.getLatestBySource();

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('countBySource', () => {
    it('should count telemetry records by source', async () => {
      mockDb.query.mockResolvedValue([{ source: 'snmp-collector', count: '100' }]);

      const result = await repository.countBySource();

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('aggregateByTimeRange', () => {
    it('should aggregate telemetry data by time range', async () => {
      const start = new Date('2024-01-01T00:00:00Z');
      const end = new Date('2024-01-02T00:00:00Z');

      mockDb.query.mockResolvedValue([
        { source: 'snmp-collector', count: '1000', avgSize: '500' },
      ]);

      const result = await repository.aggregateByTimeRange(start, end);

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('deleteOlderThan', () => {
    it('should delete telemetry records older than specified date', async () => {
      const cutoffDate = new Date('2024-01-01T00:00:00Z');

      mockDb.delete.mockResolvedValue({ rowCount: 500 });

      const result = await repository.deleteOlderThan(cutoffDate);

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('findByDataFilter', () => {
    it('should find telemetry records matching data criteria', async () => {
      mockDb.query.mockResolvedValue([
        { id: 'telemetry-1', data: { sysDescr: 'Cisco' } },
      ]);

      const result = await repository.findByDataFilter({
        sysDescr: 'Cisco%',
      });

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('Error handling', () => {
    it('should handle database errors gracefully', async () => {
      mockDb.insert.mockRejectedValue(new Error('Database error'));

      await expect(
        repository.insert({
          id: 'test',
          source: 'test',
          sourceId: 'test',
          timestamp: new Date(),
          data: {},
        })
      ).rejects.toThrow();
    });
  });
});

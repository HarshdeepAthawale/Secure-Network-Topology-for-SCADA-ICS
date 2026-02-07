/**
 * Unit tests for Base Repository
 */

import { BaseRepository } from '../../../../src/database/repositories/base.repository';

jest.mock('../../../../src/database/connection', () => ({
  getConnection: jest.fn(() => mockDb),
}));

const mockDb = {
  query: jest.fn(),
  queryOne: jest.fn(),
  queryCount: jest.fn(),
  insert: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  transaction: jest.fn(),
};

describe('BaseRepository', () => {
  let repository: BaseRepository<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    repository = new BaseRepository('test_table');
  });

  describe('findAll', () => {
    it('should find all records', async () => {
      const mockRecords = [
        { id: '1', name: 'Record 1' },
        { id: '2', name: 'Record 2' },
      ];

      mockDb.query.mockResolvedValue(mockRecords);

      const result = await repository.findAll();

      expect(result).toHaveLength(2);
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should find record by ID', async () => {
      const mockRecord = { id: '1', name: 'Record 1' };

      mockDb.queryOne.mockResolvedValue(mockRecord);

      const result = await repository.findById('1');

      expect(result).not.toBeNull();
      expect(mockDb.queryOne).toHaveBeenCalled();
    });

    it('should return null when not found', async () => {
      mockDb.queryOne.mockResolvedValue(null);

      const result = await repository.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('should create new record', async () => {
      const record = { id: '1', name: 'New Record' };

      mockDb.insert.mockResolvedValue(record);

      const result = await repository.create(record);

      expect(result.id).toBe('1');
      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('update', () => {
    it('should update record', async () => {
      const updates = { name: 'Updated Name' };

      mockDb.update.mockResolvedValue({ id: '1', ...updates });

      const result = await repository.update('1', updates);

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('should delete record', async () => {
      mockDb.delete.mockResolvedValue({ success: true });

      const result = await repository.delete('1');

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });

  describe('count', () => {
    it('should count total records', async () => {
      mockDb.queryCount.mockResolvedValue(100);

      const result = await repository.count();

      expect(result).toBe(100);
      expect(mockDb.queryCount).toHaveBeenCalled();
    });
  });

  describe('paginate', () => {
    it('should paginate records', async () => {
      const mockRecords = [
        { id: '1', name: 'Record 1' },
        { id: '2', name: 'Record 2' },
      ];

      mockDb.query.mockResolvedValue(mockRecords);
      mockDb.queryCount.mockResolvedValue(100);

      const result = await repository.paginate(0, 10);

      expect(result).toBeDefined();
      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('search', () => {
    it('should search records with criteria', async () => {
      const mockRecords = [{ id: '1', name: 'Test' }];

      mockDb.query.mockResolvedValue(mockRecords);

      const result = await repository.search({ name: 'Test' });

      expect(mockDb.query).toHaveBeenCalled();
    });
  });

  describe('bulkCreate', () => {
    it('should create multiple records', async () => {
      const records = [
        { id: '1', name: 'Record 1' },
        { id: '2', name: 'Record 2' },
      ];

      mockDb.insert.mockResolvedValue({ rowCount: 2 });

      const result = await repository.bulkCreate(records);

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe('transaction', () => {
    it('should execute operations in transaction', async () => {
      const transactionCallback = jest.fn().mockResolvedValue({ success: true });

      mockDb.transaction.mockImplementation((cb: any) => cb());

      const result = await repository.transaction(transactionCallback);

      expect(mockDb.transaction).toHaveBeenCalled();
    });

    it('should rollback transaction on error', async () => {
      const transactionCallback = jest.fn().mockRejectedValue(new Error('Test error'));

      mockDb.transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(repository.transaction(transactionCallback)).rejects.toThrow();
    });
  });

  describe('Connection pooling', () => {
    it('should use connection pool for queries', async () => {
      mockDb.query.mockResolvedValue([]);

      await repository.findAll();

      expect(mockDb.query).toHaveBeenCalled();
    });

    it('should handle connection errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection failed'));

      await expect(repository.findAll()).rejects.toThrow('Connection failed');
    });
  });

  describe('Query building', () => {
    it('should build SELECT query correctly', async () => {
      mockDb.query.mockResolvedValue([]);

      await repository.findAll();

      const callArgs = mockDb.query.mock.calls[0];
      expect(callArgs[0]).toContain('SELECT');
      expect(callArgs[0]).toContain('test_table');
    });

    it('should build WHERE clause with parameters', async () => {
      mockDb.query.mockResolvedValue([]);

      await repository.search({ id: '1' });

      const callArgs = mockDb.query.mock.calls[0];
      expect(callArgs[0]).toContain('WHERE');
      expect(callArgs).toHaveLength(2);
    });
  });

  describe('Error handling', () => {
    it('should handle database connection errors', async () => {
      mockDb.query.mockRejectedValue(new Error('Connection refused'));

      await expect(repository.findAll()).rejects.toThrow('Connection refused');
    });

    it('should handle SQL errors', async () => {
      mockDb.insert.mockRejectedValue(new Error('Syntax error in SQL'));

      await expect(repository.create({ id: '1' })).rejects.toThrow();
    });

    it('should handle constraint violations', async () => {
      mockDb.insert.mockRejectedValue(new Error('Unique constraint violated'));

      await expect(repository.create({ id: '1' })).rejects.toThrow();
    });
  });
});

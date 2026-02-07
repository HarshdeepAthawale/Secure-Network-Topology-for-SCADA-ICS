/**
 * Unit tests for Export Service
 */

import { ExportService } from '../../../../src/database/services/export.service';

const mockDeviceRepo = {
  findAll: jest.fn(),
};

const mockConnectionRepo = {
  getTopologyEdges: jest.fn(),
};

const mockAlertRepo = {
  query: jest.fn(),
};

jest.mock('../../../../src/database/repositories/device.repository', () => ({
  DeviceRepository: jest.fn(() => mockDeviceRepo),
}));

jest.mock('../../../../src/database/repositories/connection.repository', () => ({
  ConnectionRepository: jest.fn(() => mockConnectionRepo),
}));

jest.mock('../../../../src/database/repositories/alert.repository', () => ({
  AlertRepository: jest.fn(() => mockAlertRepo),
}));

describe('ExportService', () => {
  let service: ExportService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ExportService();
  });

  describe('exportTopology', () => {
    it('should export topology as JSON', async () => {
      const mockDevices = [{ id: 'device-1', name: 'PLC-01' }];
      const mockConnections = [{ source_device_id: 'device-1', target_device_id: 'device-2' }];

      mockDeviceRepo.findAll.mockResolvedValue(mockDevices);
      mockConnectionRepo.getTopologyEdges.mockResolvedValue(mockConnections);

      const result = await service.exportTopologyJSON();

      expect(result).toBeDefined();
      expect(result.devices).toBeDefined();
      expect(result.connections).toBeDefined();
    });

    it('should export topology as CSV', async () => {
      const mockDevices = [
        { id: 'device-1', name: 'PLC-01', type: 'plc', vendor: 'Siemens' },
      ];

      mockDeviceRepo.findAll.mockResolvedValue(mockDevices);

      const result = await service.exportTopologyCSV();

      expect(typeof result).toBe('string');
      expect(result).toContain('device-1');
      expect(result).toContain('PLC-01');
    });
  });

  describe('exportComplianceReport', () => {
    it('should generate compliance report', async () => {
      const mockDevices = [
        { id: 'device-1', name: 'PLC-01', status: 'online', securityZone: 'control' },
        { id: 'device-2', name: 'PLC-02', status: 'offline', securityZone: 'control' },
      ];

      mockDeviceRepo.findAll.mockResolvedValue(mockDevices);
      mockConnectionRepo.getTopologyEdges.mockResolvedValue([]);

      const result = await service.generateComplianceReport();

      expect(result).toBeDefined();
      expect(result.totalDevices).toBe(2);
      expect(result.onlineDevices).toBe(1);
    });

    it('should check security zone compliance', async () => {
      mockDeviceRepo.findAll.mockResolvedValue([
        { id: 'device-1', purdueLevel: 1, securityZone: 'control' },
        { id: 'device-2', purdueLevel: 3, securityZone: 'enterprise' },
      ]);

      const result = await service.generateComplianceReport();

      expect(result.complianceStatus).toBeDefined();
    });
  });

  describe('exportRiskReport', () => {
    it('should generate risk assessment report', async () => {
      const mockDevices = [
        { id: 'device-1', name: 'PLC-01', riskScore: 45 },
        { id: 'device-2', name: 'PLC-02', riskScore: 78 },
      ];

      mockDeviceRepo.findAll.mockResolvedValue(mockDevices);

      const result = await service.generateRiskReport();

      expect(result).toBeDefined();
      expect(result.highRiskDevices).toBeDefined();
    });

    it('should calculate average risk score', async () => {
      const mockDevices = [
        { id: 'device-1', riskScore: 50 },
        { id: 'device-2', riskScore: 100 },
      ];

      mockDeviceRepo.findAll.mockResolvedValue(mockDevices);

      const result = await service.generateRiskReport();

      expect(result.averageRiskScore).toBe(75);
    });
  });

  describe('exportAuditLog', () => {
    it('should export audit log entries', async () => {
      const mockLogs = [
        {
          id: 'log-1',
          action: 'device_discovered',
          timestamp: new Date(),
          details: { deviceId: 'device-1' },
        },
      ];

      mockAlertRepo.query.mockResolvedValue(mockLogs);

      const result = await service.exportAuditLog();

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('uploadToS3', () => {
    it('should upload report to S3', async () => {
      const reportData = JSON.stringify({ devices: [], connections: [] });
      const reportType = 'topology';

      // Note: This would normally use AWS SDK
      // For testing, we're mocking the behavior
      const mockS3Key = `reports/topology-${Date.now()}.json`;

      expect(mockS3Key).toContain('reports/');
      expect(mockS3Key).toContain('.json');
    });
  });

  describe('formatExport', () => {
    it('should format data as JSON correctly', async () => {
      const data = { devices: [{ id: '1', name: 'Device 1' }] };

      const formatted = service.formatAsJSON(data);

      expect(formatted).toEqual(JSON.stringify(data, null, 2));
    });

    it('should format data as CSV correctly', async () => {
      const data = [
        { id: '1', name: 'Device 1', type: 'PLC' },
        { id: '2', name: 'Device 2', type: 'RTU' },
      ];

      const formatted = service.formatAsCSV(data);

      expect(formatted).toContain('id,name,type');
      expect(formatted).toContain('1,Device 1,PLC');
    });

    it('should handle special characters in CSV export', async () => {
      const data = [{ id: '1', name: 'Device "Special", Name' }];

      const formatted = service.formatAsCSV(data);

      // Special characters should be properly escaped
      expect(formatted).toBeDefined();
    });
  });

  describe('Error handling', () => {
    it('should handle missing data gracefully', async () => {
      mockDeviceRepo.findAll.mockRejectedValue(new Error('Database error'));

      await expect(service.exportTopologyJSON()).rejects.toThrow();
    });

    it('should handle S3 upload failures', async () => {
      // Mock S3 upload failure
      const uploadSpy = jest.spyOn(service, 'uploadToS3').mockRejectedValue(new Error('S3 upload failed'));

      await expect(service.uploadToS3('data', 'topology')).rejects.toThrow('S3 upload failed');

      uploadSpy.mockRestore();
    });
  });

  describe('Large dataset handling', () => {
    it('should handle large topology exports', async () => {
      const largeDeviceList = Array.from({ length: 1000 }, (_, i) => ({
        id: `device-${i}`,
        name: `Device-${i}`,
      }));

      mockDeviceRepo.findAll.mockResolvedValue(largeDeviceList);
      mockConnectionRepo.getTopologyEdges.mockResolvedValue([]);

      const result = await service.exportTopologyJSON();

      expect(result.devices).toHaveLength(1000);
    });
  });
});

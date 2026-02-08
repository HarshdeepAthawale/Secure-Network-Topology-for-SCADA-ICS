/**
 * Unit tests for NetFlow Parser
 */

import { NetFlowParser } from '../../../../src/processors/parsers/netflow-parser';
import { TelemetryData, NetFlowRecord, TelemetrySource } from '../../../../src/utils/types';

describe('NetFlowParser', () => {
  let parser: NetFlowParser;

  beforeEach(() => {
    parser = new NetFlowParser();
  });

  describe('parse', () => {
    it('should parse NetFlow telemetry data', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.NETFLOW,
        timestamp: new Date(),
        data: {
          type: 'netflow',
          flows: [
            {
              srcAddress: '192.168.1.100',
              dstAddress: '192.168.1.200',
              srcPort: 12345,
              dstPort: 502,
              protocol: 6,
              bytes: 5000,
              packets: 10,
              startTime: new Date('2024-01-01T10:00:00Z'),
              endTime: new Date('2024-01-01T10:00:10Z'),
            },
          ],
        },
        processed: false,
        metadata: {},
      };

      const result = parser.parse(telemetry);

      expect(result).toHaveLength(1);
      expect(result[0].srcAddress).toBe('192.168.1.100');
      expect(result[0].dstAddress).toBe('192.168.1.200');
    });

    it('should return empty array for non-NetFlow data', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.ARP,
        timestamp: new Date(),
        data: { type: 'arp', entries: [] },
        processed: false,
        metadata: {},
      };

      const result = parser.parse(telemetry);

      expect(result).toHaveLength(0);
    });

    it('should return empty array when flows array is missing', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.NETFLOW,
        timestamp: new Date(),
        data: { type: 'netflow' },
        processed: false,
        metadata: {},
      };

      const result = parser.parse(telemetry);

      expect(result).toHaveLength(0);
    });

    it('should parse multiple NetFlow records', () => {
      const flows: NetFlowRecord[] = [
        {
          srcAddress: '10.0.0.1',
          dstAddress: '10.0.0.2',
          srcPort: 1000,
          dstPort: 502,
          protocol: 6,
          bytes: 1000,
          packets: 5,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:00:05Z'),
        },
        {
          srcAddress: '10.0.0.3',
          dstAddress: '10.0.0.4',
          srcPort: 1001,
          dstPort: 502,
          protocol: 6,
          bytes: 2000,
          packets: 10,
          startTime: new Date('2024-01-01T10:00:05Z'),
          endTime: new Date('2024-01-01T10:00:10Z'),
        },
      ];

      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.NETFLOW,
        timestamp: new Date(),
        data: { type: 'netflow', flows },
        processed: false,
        metadata: {},
      };

      const result = parser.parse(telemetry);

      expect(result).toHaveLength(2);
    });
  });

  describe('Flow calculations', () => {
    it('should calculate flow duration correctly', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.NETFLOW,
        timestamp: new Date(),
        data: {
          type: 'netflow',
          flows: [
            {
              srcAddress: '192.168.1.100',
              dstAddress: '192.168.1.200',
              srcPort: 12345,
              dstPort: 502,
              protocol: 6,
              bytes: 10000,
              packets: 10,
              startTime: new Date('2024-01-01T10:00:00Z'),
              endTime: new Date('2024-01-01T10:00:10Z'),
            },
          ],
        },
        processed: false,
        metadata: {},
      };

      const result = parser.parse(telemetry);

      expect(result[0].duration).toBe(10);
    });

    it('should calculate bytesPerSecond correctly', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.NETFLOW,
        timestamp: new Date(),
        data: {
          type: 'netflow',
          flows: [
            {
              srcAddress: '192.168.1.100',
              dstAddress: '192.168.1.200',
              srcPort: 12345,
              dstPort: 502,
              protocol: 6,
              bytes: 1000,
              packets: 10,
              startTime: new Date('2024-01-01T10:00:00Z'),
              endTime: new Date('2024-01-01T10:00:10Z'),
            },
          ],
        },
        processed: false,
        metadata: {},
      };

      const result = parser.parse(telemetry);

      expect(result[0].bytesPerSecond).toBe(100);
    });

    it('should handle zero duration flows', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.NETFLOW,
        timestamp: new Date(),
        data: {
          type: 'netflow',
          flows: [
            {
              srcAddress: '192.168.1.100',
              dstAddress: '192.168.1.200',
              srcPort: 12345,
              dstPort: 502,
              protocol: 6,
              bytes: 1000,
              packets: 10,
              startTime: new Date('2024-01-01T10:00:00Z'),
              endTime: new Date('2024-01-01T10:00:00Z'),
            },
          ],
        },
        processed: false,
        metadata: {},
      };

      const result = parser.parse(telemetry);

      expect(result[0].bytesPerSecond).toBe(0);
    });
  });

  describe('Industrial protocol detection', () => {
    it('should detect Modbus TCP flows (port 502)', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.NETFLOW,
        timestamp: new Date(),
        data: {
          type: 'netflow',
          flows: [
            {
              srcAddress: '192.168.1.100',
              dstAddress: '192.168.1.200',
              srcPort: 12345,
              dstPort: 502,
              protocol: 6,
              bytes: 1000,
              packets: 10,
              startTime: new Date('2024-01-01T10:00:00Z'),
              endTime: new Date('2024-01-01T10:00:01Z'),
            },
          ],
        },
        processed: false,
        metadata: {},
      };

      const result = parser.parse(telemetry);

      expect(result[0].isIndustrial).toBe(true);
      expect(result[0].industrialProtocol).toContain('Modbus');
    });

    it('should detect OPC-UA flows (port 4840)', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.NETFLOW,
        timestamp: new Date(),
        data: {
          type: 'netflow',
          flows: [
            {
              srcAddress: '192.168.1.100',
              dstAddress: '192.168.1.200',
              srcPort: 12345,
              dstPort: 4840,
              protocol: 6,
              bytes: 5000,
              packets: 20,
              startTime: new Date('2024-01-01T10:00:00Z'),
              endTime: new Date('2024-01-01T10:00:01Z'),
            },
          ],
        },
        processed: false,
        metadata: {},
      };

      const result = parser.parse(telemetry);

      expect(result[0].isIndustrial).toBe(true);
      expect(result[0].industrialProtocol).toContain('OPC UA');
    });

    it('should mark non-industrial protocols', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.NETFLOW,
        timestamp: new Date(),
        data: {
          type: 'netflow',
          flows: [
            {
              srcAddress: '192.168.1.100',
              dstAddress: '192.168.1.200',
              srcPort: 12345,
              dstPort: 80,
              protocol: 6,
              bytes: 1000,
              packets: 10,
              startTime: new Date('2024-01-01T10:00:00Z'),
              endTime: new Date('2024-01-01T10:00:01Z'),
            },
          ],
        },
        processed: false,
        metadata: {},
      };

      const result = parser.parse(telemetry);

      expect(result[0].isIndustrial).toBe(false);
      expect(result[0].industrialProtocol).toBeUndefined();
    });
  });

  describe('Protocol identification', () => {
    it('should identify TCP protocol (6)', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.NETFLOW,
        timestamp: new Date(),
        data: {
          type: 'netflow',
          flows: [
            {
              srcAddress: '192.168.1.100',
              dstAddress: '192.168.1.200',
              srcPort: 12345,
              dstPort: 502,
              protocol: 6,
              bytes: 1000,
              packets: 10,
              startTime: new Date('2024-01-01T10:00:00Z'),
              endTime: new Date('2024-01-01T10:00:01Z'),
            },
          ],
        },
        processed: false,
        metadata: {},
      };

      const result = parser.parse(telemetry);

      expect(result[0].protocol).toContain('TCP');
      expect(result[0].protocolNumber).toBe(6);
    });

    it('should identify UDP protocol (17)', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.NETFLOW,
        timestamp: new Date(),
        data: {
          type: 'netflow',
          flows: [
            {
              srcAddress: '192.168.1.100',
              dstAddress: '192.168.1.200',
              srcPort: 12345,
              dstPort: 161,
              protocol: 17,
              bytes: 500,
              packets: 5,
              startTime: new Date('2024-01-01T10:00:00Z'),
              endTime: new Date('2024-01-01T10:00:01Z'),
            },
          ],
        },
        processed: false,
        metadata: {},
      };

      const result = parser.parse(telemetry);

      expect(result[0].protocol).toContain('UDP');
      expect(result[0].protocolNumber).toBe(17);
    });
  });

  describe('summarize', () => {
    it('should summarize flow data', () => {
      const flows = [
        {
          id: '1',
          srcAddress: '192.168.1.1',
          dstAddress: '192.168.1.2',
          srcPort: 1000,
          dstPort: 502,
          protocol: 'TCP',
          protocolNumber: 6,
          bytes: 1000,
          packets: 10,
          startTime: new Date('2024-01-01T10:00:00Z'),
          endTime: new Date('2024-01-01T10:00:01Z'),
          duration: 1,
          bytesPerSecond: 1000,
          isIndustrial: true,
          industrialProtocol: 'Modbus',
        },
        {
          id: '2',
          srcAddress: '192.168.1.3',
          dstAddress: '192.168.1.4',
          srcPort: 1001,
          dstPort: 4840,
          protocol: 'TCP',
          protocolNumber: 6,
          bytes: 2000,
          packets: 20,
          startTime: new Date('2024-01-01T10:00:01Z'),
          endTime: new Date('2024-01-01T10:00:02Z'),
          duration: 1,
          bytesPerSecond: 2000,
          isIndustrial: true,
          industrialProtocol: 'OPC-UA',
        },
      ];

      const summary = parser.summarize(flows);

      expect(summary.totalFlows).toBe(2);
      expect(summary.totalBytes).toBe(3000);
      expect(summary.totalPackets).toBe(30);
      expect(summary.uniqueSources).toBe(2);
      expect(summary.uniqueDestinations).toBe(2);
      expect(summary.industrialFlows).toBe(2);
    });
  });

  describe('Error handling', () => {
    it('should handle invalid flow data', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.NETFLOW,
        timestamp: new Date(),
        data: { type: 'netflow' },
        processed: false,
        metadata: {},
      };

      expect(() => parser.parse(telemetry)).not.toThrow();
    });
  });
});

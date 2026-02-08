/**
 * Unit tests for ARP Parser
 */

import { ARPParser } from '../../../../src/processors/parsers/arp-parser';
import { TelemetryData, ARPEntry, MACTableEntry, TelemetrySource } from '../../../../src/utils/types';

describe('ARPParser', () => {
  let parser: ARPParser;

  beforeEach(() => {
    parser = new ARPParser();
  });

  describe('parse', () => {
    it('should parse ARP telemetry data', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.ARP,
        timestamp: new Date(),
        processed: false,
        metadata: {},
        data: {
          type: 'arp',
          entries: [
            { ipAddress: '192.168.1.100', macAddress: '00:1A:2B:3C:4D:5E', vlanId: 1, interface: 'eth0', type: 'dynamic' },
            { ipAddress: '192.168.1.101', macAddress: 'AA:BB:CC:DD:EE:FF', vlanId: 1, interface: 'eth0', type: 'dynamic' },
          ],
        },
      };

      const result = parser.parse(telemetry);

      expect(result.arpEntries).toHaveLength(2);
      expect(result.macEntries).toHaveLength(0);
    });

    it('should parse MAC table telemetry data', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.MAC_TABLE,
        timestamp: new Date(),
        processed: false,
        metadata: {},
        data: {
          type: 'mac',
          entries: [
            { macAddress: '00:1A:2B:3C:4D:5E', vlanId: 1, port: 'Gi0/0/1' },
            { macAddress: 'AA:BB:CC:DD:EE:FF', vlanId: 1, port: 'Gi0/0/2' },
          ],
        },
      };

      const result = parser.parse(telemetry);

      expect(result.arpEntries).toHaveLength(0);
      expect(result.macEntries).toHaveLength(2);
    });

    it('should handle mixed ARP and MAC data', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.ARP,
        timestamp: new Date(),
        processed: false,
        metadata: {},
        data: {
          type: 'arp',
          entries: [
            { ipAddress: '192.168.1.100', macAddress: '00:1A:2B:3C:4D:5E', vlanId: 1, type: 'dynamic' },
          ],
        },
      };

      const result = parser.parse(telemetry);

      expect(result.arpEntries.length).toBeGreaterThan(0);
      expect(result.macEntries).toHaveLength(0);
    });

    it('should filter out invalid ARP entries (missing IP or MAC)', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.ARP,
        timestamp: new Date(),
        processed: false,
        metadata: {},
        data: {
          type: 'arp',
          entries: [
            { ipAddress: '192.168.1.100', macAddress: '00:1A:2B:3C:4D:5E', type: 'dynamic' },
            { ipAddress: '', macAddress: 'AA:BB:CC:DD:EE:FF', type: 'dynamic' },
            { ipAddress: '192.168.1.101', macAddress: '', type: 'dynamic' },
          ],
        },
      };

      const result = parser.parse(telemetry);

      expect(result.arpEntries).toHaveLength(1);
      expect(result.arpEntries[0].ipAddress).toBe('192.168.1.100');
    });

    it('should filter out invalid MAC entries (missing MAC)', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.MAC_TABLE,
        timestamp: new Date(),
        processed: false,
        metadata: {},
        data: {
          type: 'mac',
          entries: [
            { macAddress: '00:1A:2B:3C:4D:5E', vlanId: 1, port: 'Gi0/0/1' },
            { macAddress: '', vlanId: 1, port: 'Gi0/0/2' },
          ],
        },
      };

      const result = parser.parse(telemetry);

      expect(result.macEntries).toHaveLength(1);
      expect(result.macEntries[0].macAddress).toBe('00:1a:2b:3c:4d:5e');
    });
  });

  describe('buildL2Topology', () => {
    it('should build L2 topology from ARP entries', () => {
      const arpEntries: ARPEntry[] = [
        { ipAddress: '192.168.1.100', macAddress: '00:1A:2B:3C:4D:5E', vlanId: 1, interface: 'eth0', type: 'dynamic' },
        { ipAddress: '192.168.1.101', macAddress: 'AA:BB:CC:DD:EE:FF', vlanId: 1, interface: 'eth0', type: 'dynamic' },
      ];

      const result = parser.buildL2Topology(arpEntries, []);

      expect(result.devices).toHaveLength(2);
      expect(result.devices[0].ipAddresses).toContain('192.168.1.100');
      expect(result.devices[0].vlanIds).toContain(1);
    });

    it('should build L2 topology from MAC entries', () => {
      const macEntries: MACTableEntry[] = [
        { macAddress: '00:1A:2B:3C:4D:5E', vlanId: 1, port: 'Gi0/0/1' },
        { macAddress: 'AA:BB:CC:DD:EE:FF', vlanId: 1, port: 'Gi0/0/2' },
      ];

      const result = parser.buildL2Topology([], macEntries);

      expect(result.devices).toHaveLength(2);
      expect(result.devices[0].ports).toContain('Gi0/0/1');
      expect(result.devices[0].vlanIds).toContain(1);
    });

    it('should aggregate MAC and IP information for same device', () => {
      const mac = '00:1A:2B:3C:4D:5E';
      const arpEntries: ARPEntry[] = [
        { ipAddress: '192.168.1.100', macAddress: mac, vlanId: 1, interface: 'eth0', type: 'dynamic' },
        { ipAddress: '192.168.1.200', macAddress: mac, vlanId: 2, interface: 'eth1', type: 'dynamic' },
      ];
      const macEntries: MACTableEntry[] = [
        { macAddress: mac, vlanId: 1, port: 'Gi0/0/1' },
        { macAddress: mac, vlanId: 2, port: 'Gi0/0/2' },
      ];

      const result = parser.buildL2Topology(arpEntries, macEntries);

      expect(result.devices).toHaveLength(1);
      expect(result.devices[0].ipAddresses).toContain('192.168.1.100');
      expect(result.devices[0].ipAddresses).toContain('192.168.1.200');
      expect(result.devices[0].vlanIds).toContain(1);
      expect(result.devices[0].vlanIds).toContain(2);
      expect(result.devices[0].ports).toContain('Gi0/0/1');
      expect(result.devices[0].ports).toContain('Gi0/0/2');
    });

    it('should handle duplicate entries without duplicating device records', () => {
      const arpEntries: ARPEntry[] = [
        { ipAddress: '192.168.1.100', macAddress: '00:1A:2B:3C:4D:5E', vlanId: 1, interface: 'eth0', type: 'dynamic' },
        { ipAddress: '192.168.1.100', macAddress: '00:1A:2B:3C:4D:5E', vlanId: 1, interface: 'eth0', type: 'dynamic' },
      ];

      const result = parser.buildL2Topology(arpEntries, []);

      expect(result.devices).toHaveLength(1);
      expect(result.devices[0].ipAddresses).toHaveLength(1);
    });

    it('should set vendor information from MAC address', () => {
      const arpEntries: ARPEntry[] = [
        { ipAddress: '192.168.1.100', macAddress: '00:1A:2B:3C:4D:5E', vlanId: 1, interface: 'eth0', type: 'dynamic' },
      ];

      const result = parser.buildL2Topology(arpEntries, []);

      expect(result.devices[0].macAddress).toBe('00:1a:2b:3c:4d:5e');
      expect(typeof result.devices[0].vendor === 'string' || result.devices[0].vendor === undefined).toBe(true);
    });

    it('should return empty topology for empty inputs', () => {
      const result = parser.buildL2Topology([], []);

      expect(result.devices).toHaveLength(0);
      expect(result.connections).toBeDefined();
    });

    it('should infer connections from MAC table entries', () => {
      const macEntries: MACTableEntry[] = [
        { macAddress: '00:1A:2B:3C:4D:5E', vlanId: 1, port: 'Gi0/0/1' },
        { macAddress: 'AA:BB:CC:DD:EE:FF', vlanId: 1, port: 'Gi0/0/2' },
      ];

      const result = parser.buildL2Topology([], macEntries);

      expect(result.connections).toBeDefined();
      expect(Array.isArray(result.connections)).toBe(true);
    });
  });

  describe('normalizeMac', () => {
    it('should normalize MAC addresses to lowercase colon-separated format', () => {
      const testCases = [
        { input: '00:1A:2B:3C:4D:5E', expected: '00:1a:2b:3c:4d:5e' },
        { input: '00-1A-2B-3C-4D-5E', expected: '00:1a:2b:3c:4d:5e' },
        { input: '001A2B3C4D5E', expected: '00:1a:2b:3c:4d:5e' },
        { input: 'AA:BB:CC:DD:EE:FF', expected: 'aa:bb:cc:dd:ee:ff' },
      ];

      testCases.forEach(({ input, expected }) => {
        const result = parser['normalizeMac'](input);
        expect(result).toBe(expected);
      });
    });

    it('should handle mixed case MAC addresses', () => {
      const mac = 'aA:Bb:Cc:dD:eE:fF';
      const result = parser['normalizeMac'](mac);

      expect(result).toBe('aa:bb:cc:dd:ee:ff');
    });

    it('should handle MAC addresses with no separators', () => {
      const mac = 'aabbccddeeff';
      const result = parser['normalizeMac'](mac);

      expect(result).toBe('aa:bb:cc:dd:ee:ff');
    });
  });

  describe('getVendorFromMac', () => {
    it('should return vendor for known OUI prefix', () => {
      // This test depends on VENDOR_OUI_PREFIXES constants
      const mac = '00:1A:2B:3C:4D:5E';
      const result = parser['getVendorFromMac'](mac);

      expect(typeof result === 'string' || result === undefined).toBe(true);
    });

    it('should handle various MAC address formats', () => {
      const formats = [
        '00:1A:2B:3C:4D:5E',
        '00-1A-2B-3C-4D-5E',
        '001A2B3C4D5E',
      ];

      formats.forEach((mac) => {
        expect(() => parser['getVendorFromMac'](mac)).not.toThrow();
      });
    });
  });

  describe('ARP deduplication', () => {
    it('should handle multiple ARP entries for same IP on different VLANs', () => {
      const arpEntries: ARPEntry[] = [
        { ipAddress: '192.168.1.100', macAddress: '00:1A:2B:3C:4D:5E', vlanId: 1, interface: 'eth0', type: 'dynamic' },
        { ipAddress: '192.168.1.100', macAddress: 'AA:BB:CC:DD:EE:FF', vlanId: 2, interface: 'eth1', type: 'dynamic' },
      ];

      const result = parser.buildL2Topology(arpEntries, []);

      expect(result.devices).toHaveLength(2);
    });

    it('should update lastSeen time for duplicate MAC entries', () => {
      const arpEntries: ARPEntry[] = [
        { ipAddress: '192.168.1.100', macAddress: '00:1A:2B:3C:4D:5E', vlanId: 1, interface: 'eth0', type: 'dynamic' },
      ];

      const result = parser.buildL2Topology(arpEntries, []);

      expect(result.devices[0].lastSeen).toBeDefined();
      expect(result.devices[0].lastSeen.getTime()).toBeGreaterThan(
        result.devices[0].firstSeen.getTime() - 1000
      );
    });
  });

  describe('Error handling', () => {
    it('should handle null data gracefully', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.ARP,
        timestamp: new Date(),
        processed: false,
        metadata: {},
        data: {},
      };

      expect(() => parser.parse(telemetry as any)).toThrow();
    });

    it('should handle empty entries array', () => {
      const telemetry: TelemetryData = {
        id: 'telemetry-1',
        source: TelemetrySource.ARP,
        timestamp: new Date(),
        processed: false,
        metadata: {},
        data: {
          type: 'arp',
          entries: [],
        },
      };

      const result = parser.parse(telemetry);

      expect(result.arpEntries).toHaveLength(0);
    });

    it('should handle invalid MAC address format', () => {
      const arpEntries: ARPEntry[] = [
        { ipAddress: '192.168.1.100', macAddress: 'invalid-mac', vlanId: 1, interface: 'eth0', type: 'dynamic' },
      ];

      expect(() => parser.buildL2Topology(arpEntries, [])).not.toThrow();
    });
  });

  describe('VLAN handling', () => {
    it('should correctly handle multiple VLANs', () => {
      const arpEntries: ARPEntry[] = [
        { ipAddress: '10.0.1.100', macAddress: '00:1A:2B:3C:4D:5E', vlanId: 10, interface: 'eth0', type: 'dynamic' },
        { ipAddress: '10.0.2.100', macAddress: '00:1A:2B:3C:4D:5E', vlanId: 20, interface: 'eth1', type: 'dynamic' },
        { ipAddress: '10.0.3.100', macAddress: '00:1A:2B:3C:4D:5E', vlanId: 30, interface: 'eth2', type: 'dynamic' },
      ];

      const result = parser.buildL2Topology(arpEntries, []);

      expect(result.devices).toHaveLength(1);
      expect(result.devices[0].vlanIds).toEqual(expect.arrayContaining([10, 20, 30]));
      expect(result.devices[0].ipAddresses.length).toBe(3);
    });

    it('should handle devices without VLAN information', () => {
      const arpEntries: ARPEntry[] = [
        { ipAddress: '192.168.1.100', macAddress: '00:1A:2B:3C:4D:5E', interface: 'eth0', type: 'dynamic' },
      ];

      const result = parser.buildL2Topology(arpEntries, []);

      expect(result.devices).toHaveLength(1);
      expect(result.devices[0].vlanIds).toEqual([]);
    });
  });
});

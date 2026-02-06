/**
 * ARP/MAC Table Collector - Layer 2 connectivity discovery
 */

import * as dgram from 'dgram';
import * as net from 'net';
import { BaseCollector, CollectorTarget } from './base-collector';
import {
  TelemetryData,
  TelemetrySource,
  CollectorConfig,
  ARPEntry,
  MACTableEntry,
} from '../utils/types';
import { logger } from '../utils/logger';
import { CollectorError } from '../utils/error-handler';
import { config } from '../utils/config';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// ============================================================================
// Types
// ============================================================================

export interface ARPTarget extends CollectorTarget {
  interface?: string;
  collectType: 'arp' | 'mac' | 'both';
}

// ============================================================================
// ARP Collector Class
// ============================================================================

export class ARPCollector extends BaseCollector {
  constructor(collectorConfig?: Partial<CollectorConfig>) {
    const mergedConfig = {
      ...config.collector,
      ...collectorConfig,
    };

    super('ARPCollector', TelemetrySource.ARP, mergedConfig);
  }

  // ============================================================================
  // Lifecycle Implementation
  // ============================================================================

  protected async initialize(): Promise<void> {
    logger.info('Initializing ARP/MAC collector');
    // No persistent connections needed
  }

  protected async cleanup(): Promise<void> {
    logger.info('Cleaning up ARP/MAC collector');
    // No cleanup needed
  }

  // ============================================================================
  // Collection Implementation
  // ============================================================================

  protected async collect(target: CollectorTarget): Promise<TelemetryData[]> {
    const arpTarget = target as ARPTarget;
    const telemetryData: TelemetryData[] = [];

    try {
      // Collect ARP entries
      if (arpTarget.collectType === 'arp' || arpTarget.collectType === 'both') {
        const arpEntries = await this.collectARPTable(arpTarget);
        if (arpEntries.length > 0) {
          telemetryData.push(this.createTelemetryData(
            { type: 'arp', entries: arpEntries },
            undefined
          ));
        }
      }

      // Collect MAC table entries (for switches)
      if (arpTarget.collectType === 'mac' || arpTarget.collectType === 'both') {
        const macEntries = await this.collectMACTable(arpTarget);
        if (macEntries.length > 0) {
          telemetryData.push(this.createTelemetryData(
            { type: 'mac', entries: macEntries },
            undefined
          ));
        }
      }

      logger.debug(`ARP collection completed for ${arpTarget.host}`, {
        dataPoints: telemetryData.length,
      });

    } catch (error) {
      throw new CollectorError(
        'arp',
        `Failed to collect from ${arpTarget.host}: ${(error as Error).message}`,
        arpTarget.host
      );
    }

    return telemetryData;
  }

  // ============================================================================
  // ARP Table Collection
  // ============================================================================

  /**
   * Collect ARP table from the system
   */
  private async collectARPTable(target: ARPTarget): Promise<ARPEntry[]> {
    const entries: ARPEntry[] = [];

    try {
      // Different commands for different platforms
      const platform = process.platform;
      let command: string;

      switch (platform) {
        case 'linux':
          command = target.interface
            ? `ip neigh show dev ${target.interface}`
            : 'ip neigh show';
          break;
        case 'darwin':
          command = 'arp -an';
          break;
        case 'win32':
          command = 'arp -a';
          break;
        default:
          throw new Error(`Unsupported platform: ${platform}`);
      }

      const { stdout } = await execAsync(command);
      const parsedEntries = this.parseARPOutput(stdout, platform);

      entries.push(...parsedEntries);
    } catch (error) {
      logger.warn('Failed to collect local ARP table', {
        error: (error as Error).message,
      });
    }

    return entries;
  }

  /**
   * Parse ARP command output based on platform
   */
  private parseARPOutput(output: string, platform: string): ARPEntry[] {
    const entries: ARPEntry[] = [];
    const lines = output.split('\n').filter(line => line.trim());

    for (const line of lines) {
      try {
        let entry: ARPEntry | null = null;

        switch (platform) {
          case 'linux':
            entry = this.parseLinuxARP(line);
            break;
          case 'darwin':
            entry = this.parseDarwinARP(line);
            break;
          case 'win32':
            entry = this.parseWindowsARP(line);
            break;
        }

        if (entry) {
          entries.push(entry);
        }
      } catch {
        // Skip unparseable lines
      }
    }

    return entries;
  }

  /**
   * Parse Linux 'ip neigh' output
   * Format: 192.168.1.1 dev eth0 lladdr aa:bb:cc:dd:ee:ff REACHABLE
   */
  private parseLinuxARP(line: string): ARPEntry | null {
    const regex = /^(\d+\.\d+\.\d+\.\d+)\s+dev\s+(\S+)\s+lladdr\s+([0-9a-f:]+)\s+(\S+)/i;
    const match = line.match(regex);

    if (match) {
      return {
        ipAddress: match[1],
        macAddress: this.normalizeMacAddress(match[3]),
        interface: match[2],
        type: match[4].toLowerCase().includes('permanent') ? 'static' : 'dynamic',
      };
    }

    return null;
  }

  /**
   * Parse macOS 'arp -an' output
   * Format: ? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 ifscope [ethernet]
   */
  private parseDarwinARP(line: string): ARPEntry | null {
    const regex = /\((\d+\.\d+\.\d+\.\d+)\)\s+at\s+([0-9a-f:]+)\s+on\s+(\S+)/i;
    const match = line.match(regex);

    if (match) {
      return {
        ipAddress: match[1],
        macAddress: this.normalizeMacAddress(match[2]),
        interface: match[3],
        type: line.includes('permanent') ? 'static' : 'dynamic',
      };
    }

    return null;
  }

  /**
   * Parse Windows 'arp -a' output
   * Format: 192.168.1.1    aa-bb-cc-dd-ee-ff     dynamic
   */
  private parseWindowsARP(line: string): ARPEntry | null {
    const regex = /(\d+\.\d+\.\d+\.\d+)\s+([0-9a-f-]+)\s+(dynamic|static)/i;
    const match = line.match(regex);

    if (match) {
      return {
        ipAddress: match[1],
        macAddress: this.normalizeMacAddress(match[2]),
        interface: 'unknown',
        type: match[3].toLowerCase() as 'dynamic' | 'static',
      };
    }

    return null;
  }

  // ============================================================================
  // MAC Table Collection
  // ============================================================================

  /**
   * Collect MAC address table (typically from switches via SNMP or CLI)
   */
  private async collectMACTable(target: ARPTarget): Promise<MACTableEntry[]> {
    const entries: MACTableEntry[] = [];

    // For this implementation, we'll simulate MAC table entries
    // In production, this would connect to switches via SNMP or SSH/Telnet

    logger.debug('MAC table collection placeholder', {
      target: target.host,
      note: 'Implement switch-specific MAC table collection',
    });

    // Example: Connect to switch and collect MAC table
    // This would typically use SNMP to walk the bridge MIB
    // OID: 1.3.6.1.2.1.17.4.3 (dot1dTpFdbTable)

    return entries;
  }

  // ============================================================================
  // Network Discovery
  // ============================================================================

  /**
   * Discover devices on a subnet using ARP scanning
   * Note: This is an active scan - use with caution in OT environments
   */
  async discoverSubnet(
    subnet: string,
    options: { passive?: boolean; timeout?: number } = {}
  ): Promise<ARPEntry[]> {
    const { passive = true, timeout = 5000 } = options;

    if (!passive) {
      logger.warn('Active ARP scan requested - use with caution in OT environments', {
        subnet,
      });
    }

    const entries: ARPEntry[] = [];

    try {
      // For passive discovery, just read the current ARP table
      if (passive) {
        const target: ARPTarget = {
          id: 'local',
          host: 'localhost',
          enabled: true,
          collectType: 'arp',
        };

        const collected = await this.collectARPTable(target);

        // Filter entries that match the subnet
        const subnetParts = this.parseSubnet(subnet);
        if (subnetParts) {
          for (const entry of collected) {
            if (this.isInSubnet(entry.ipAddress, subnetParts)) {
              entries.push(entry);
            }
          }
        } else {
          entries.push(...collected);
        }
      } else {
        // Active scan would go here
        // This involves sending ARP requests to all IPs in the subnet
        // Not recommended for OT environments without proper authorization
        logger.warn('Active ARP scanning not implemented - use passive discovery');
      }
    } catch (error) {
      logger.error('Subnet discovery failed', {
        subnet,
        error: (error as Error).message,
      });
    }

    return entries;
  }

  /**
   * Parse subnet in CIDR notation
   */
  private parseSubnet(subnet: string): { network: number; mask: number } | null {
    const match = subnet.match(/^(\d+\.\d+\.\d+\.\d+)\/(\d+)$/);
    if (!match) return null;

    const octets = match[1].split('.').map(Number);
    const network = (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
    const prefix = parseInt(match[2], 10);
    const mask = prefix === 0 ? 0 : ~((1 << (32 - prefix)) - 1);

    return { network: network & mask, mask };
  }

  /**
   * Check if IP is in subnet
   */
  private isInSubnet(ip: string, subnet: { network: number; mask: number }): boolean {
    const octets = ip.split('.').map(Number);
    const ipNum = (octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3];
    return (ipNum & subnet.mask) === subnet.network;
  }

  // ============================================================================
  // Target Management
  // ============================================================================

  /**
   * Add a local ARP collection target
   */
  addLocalTarget(options: { interface?: string; collectType?: 'arp' | 'mac' | 'both' } = {}): string {
    const target: Omit<ARPTarget, 'id'> = {
      host: 'localhost',
      enabled: true,
      interface: options.interface,
      collectType: options.collectType || 'arp',
    };

    return this.addTarget(target);
  }

  /**
   * Add a remote target for MAC table collection
   */
  addRemoteTarget(
    host: string,
    options: { port?: number; collectType?: 'mac' | 'both' } = {}
  ): string {
    const target: Omit<ARPTarget, 'id'> = {
      host,
      port: options.port,
      enabled: true,
      collectType: options.collectType || 'mac',
    };

    return this.addTarget(target);
  }
}

// ============================================================================
// Export
// ============================================================================

export function createARPCollector(config?: Partial<CollectorConfig>): ARPCollector {
  return new ARPCollector(config);
}

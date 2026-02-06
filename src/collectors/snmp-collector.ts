/**
 * SNMPv3 Collector - Secure device discovery and monitoring
 */

import * as snmp from 'net-snmp';
import { BaseCollector, CollectorTarget } from './base-collector';
import {
  TelemetryData,
  TelemetrySource,
  SNMPConfig,
  SNMPInterface,
  SNMPNeighbor,
} from '../utils/types';
import { SNMP_OIDS } from '../utils/constants';
import { logger } from '../utils/logger';
import { SNMPError } from '../utils/error-handler';
import { config } from '../utils/config';

// ============================================================================
// Types
// ============================================================================

export interface SNMPTarget extends CollectorTarget {
  version: 3;
  securityName: string;
  securityLevel: snmp.SecurityLevel;
  authProtocol?: snmp.AuthProtocols;
  authKey?: string;
  privProtocol?: snmp.PrivProtocols;
  privKey?: string;
}

interface SNMPDeviceInfo {
  sysName: string;
  sysDescr: string;
  sysLocation: string;
  sysContact: string;
  sysUpTime: number;
  sysObjectID: string;
}

// ============================================================================
// SNMP Collector Class
// ============================================================================

export class SNMPCollector extends BaseCollector {
  private sessions: Map<string, snmp.Session> = new Map();

  constructor(snmpConfig?: Partial<SNMPConfig>) {
    const collectorConfig = {
      ...config.snmp,
      ...snmpConfig,
    };

    super('SNMPv3Collector', TelemetrySource.SNMP, collectorConfig);
  }

  // ============================================================================
  // Lifecycle Implementation
  // ============================================================================

  protected async initialize(): Promise<void> {
    logger.info('Initializing SNMPv3 collector');
    // Sessions are created on-demand for each target
  }

  protected async cleanup(): Promise<void> {
    logger.info('Cleaning up SNMPv3 collector');

    // Close all sessions
    for (const [targetId, session] of this.sessions) {
      try {
        session.close();
        logger.debug(`Closed SNMP session for target ${targetId}`);
      } catch (error) {
        logger.error(`Error closing SNMP session`, {
          targetId,
          error: (error as Error).message,
        });
      }
    }

    this.sessions.clear();
  }

  // ============================================================================
  // Collection Implementation
  // ============================================================================

  protected async collect(target: CollectorTarget): Promise<TelemetryData[]> {
    const snmpTarget = target as SNMPTarget;
    const telemetryData: TelemetryData[] = [];

    try {
      // Create or get session
      const session = await this.getSession(snmpTarget);

      // Collect system information
      const deviceInfo = await this.getSystemInfo(session);
      telemetryData.push(this.createTelemetryData(
        { type: 'system', ...deviceInfo },
        undefined,
        JSON.stringify(deviceInfo)
      ));

      // Collect interface information
      const interfaces = await this.getInterfaces(session);
      telemetryData.push(this.createTelemetryData(
        { type: 'interfaces', interfaces },
        undefined
      ));

      // Collect LLDP neighbors
      const neighbors = await this.getLLDPNeighbors(session);
      if (neighbors.length > 0) {
        telemetryData.push(this.createTelemetryData(
          { type: 'neighbors', neighbors },
          undefined
        ));
      }

      // Collect ARP table
      const arpTable = await this.getARPTable(session);
      if (arpTable.length > 0) {
        telemetryData.push(this.createTelemetryData(
          { type: 'arp', entries: arpTable },
          undefined
        ));
      }

      logger.debug(`SNMP collection completed for ${snmpTarget.host}`, {
        dataPoints: telemetryData.length,
      });

    } catch (error) {
      throw new SNMPError(
        `Failed to collect from ${snmpTarget.host}: ${(error as Error).message}`,
        snmpTarget.host
      );
    }

    return telemetryData;
  }

  // ============================================================================
  // Session Management
  // ============================================================================

  private async getSession(target: SNMPTarget): Promise<snmp.Session> {
    // Check for existing session
    const existingSession = this.sessions.get(target.id);
    if (existingSession) {
      return existingSession;
    }

    // Create new session
    const session = await this.createSession(target);
    this.sessions.set(target.id, session);

    return session;
  }

  private async createSession(target: SNMPTarget): Promise<snmp.Session> {
    return new Promise((resolve, reject) => {
      try {
        const user: snmp.User = {
          name: target.securityName,
          level: target.securityLevel,
        };

        if (target.authProtocol && target.authKey) {
          user.authProtocol = target.authProtocol;
          user.authKey = target.authKey;
        }

        if (target.privProtocol && target.privKey) {
          user.privProtocol = target.privProtocol;
          user.privKey = target.privKey;
        }

        const options: snmp.SessionOptions = {
          port: target.port || 161,
          timeout: this.config.timeout,
          retries: this.config.retries,
          version: snmp.Version3,
        };

        const session = snmp.createV3Session(target.host, user, options);

        session.on('error', (err: unknown) => {
          logger.error(`SNMP session error for ${target.host}`, {
            error: (err as Error).message,
          });
        });

        logger.debug(`Created SNMP session for ${target.host}`);
        resolve(session);
      } catch (error) {
        reject(new SNMPError(
          `Failed to create session: ${(error as Error).message}`,
          target.host
        ));
      }
    });
  }

  // ============================================================================
  // SNMP Operations
  // ============================================================================

  /**
   * Get system information from device
   */
  private async getSystemInfo(session: snmp.Session): Promise<SNMPDeviceInfo> {
    const oids = [
      SNMP_OIDS.sysDescr,
      SNMP_OIDS.sysObjectID,
      SNMP_OIDS.sysUpTime,
      SNMP_OIDS.sysContact,
      SNMP_OIDS.sysName,
      SNMP_OIDS.sysLocation,
    ];

    const varbinds = await this.get(session, oids);

    return {
      sysDescr: this.extractString(varbinds, SNMP_OIDS.sysDescr),
      sysObjectID: this.extractString(varbinds, SNMP_OIDS.sysObjectID),
      sysUpTime: this.extractNumber(varbinds, SNMP_OIDS.sysUpTime),
      sysContact: this.extractString(varbinds, SNMP_OIDS.sysContact),
      sysName: this.extractString(varbinds, SNMP_OIDS.sysName),
      sysLocation: this.extractString(varbinds, SNMP_OIDS.sysLocation),
    };
  }

  /**
   * Get interface information
   */
  private async getInterfaces(session: snmp.Session): Promise<SNMPInterface[]> {
    const interfaces: SNMPInterface[] = [];

    try {
      // Walk the interface table
      const ifTableResults = await this.walk(session, SNMP_OIDS.ifTable);

      // Group by interface index
      const ifData: Map<number, Partial<SNMPInterface>> = new Map();

      for (const varbind of ifTableResults) {
        const oidParts = varbind.oid.split('.');
        const ifIndex = parseInt(oidParts[oidParts.length - 1], 10);
        const subOid = oidParts.slice(0, -1).join('.');

        if (!ifData.has(ifIndex)) {
          ifData.set(ifIndex, { index: ifIndex });
        }

        const iface = ifData.get(ifIndex)!;
        const value = varbind.value;
        if (value === null) continue;

        switch (subOid) {
          case SNMP_OIDS.ifDescr:
            iface.name = value.toString();
            break;
          case SNMP_OIDS.ifType:
            iface.type = parseInt(value.toString(), 10);
            break;
          case SNMP_OIDS.ifSpeed:
            iface.speed = parseInt(value.toString(), 10);
            break;
          case SNMP_OIDS.ifPhysAddress:
            iface.physAddress = this.formatMacAddress(value as Buffer | string);
            break;
          case SNMP_OIDS.ifAdminStatus:
            iface.adminStatus = parseInt(value.toString(), 10);
            break;
          case SNMP_OIDS.ifOperStatus:
            iface.operStatus = parseInt(value.toString(), 10);
            break;
          case SNMP_OIDS.ifInOctets:
            iface.inOctets = parseInt(value.toString(), 10);
            break;
          case SNMP_OIDS.ifOutOctets:
            iface.outOctets = parseInt(value.toString(), 10);
            break;
        }
      }

      // Convert to array
      for (const iface of ifData.values()) {
        if (iface.index !== undefined && iface.name) {
          interfaces.push({
            index: iface.index,
            name: iface.name,
            description: iface.description,
            type: iface.type || 0,
            speed: iface.speed || 0,
            physAddress: iface.physAddress || '',
            adminStatus: iface.adminStatus || 0,
            operStatus: iface.operStatus || 0,
            inOctets: iface.inOctets || 0,
            outOctets: iface.outOctets || 0,
          });
        }
      }
    } catch (error) {
      logger.warn('Failed to get interface table', {
        error: (error as Error).message,
      });
    }

    return interfaces;
  }

  /**
   * Get LLDP neighbor information
   */
  private async getLLDPNeighbors(session: snmp.Session): Promise<SNMPNeighbor[]> {
    const neighbors: SNMPNeighbor[] = [];

    try {
      const lldpResults = await this.walk(session, SNMP_OIDS.lldpRemTable);

      // Group by neighbor index
      const neighborData: Map<string, Partial<SNMPNeighbor>> = new Map();

      for (const varbind of lldpResults) {
        const oidParts = varbind.oid.split('.');
        const neighborKey = oidParts.slice(-3).join('-');
        const subOid = oidParts.slice(0, -3).join('.');

        if (!neighborData.has(neighborKey)) {
          neighborData.set(neighborKey, { protocol: 'lldp' });
        }

        const neighbor = neighborData.get(neighborKey)!;
        const value = varbind.value;
        if (value === null) continue;

        switch (subOid) {
          case SNMP_OIDS.lldpRemChassisId:
            neighbor.remoteDeviceId = value.toString();
            break;
          case SNMP_OIDS.lldpRemPortId:
            neighbor.remoteInterface = value.toString();
            break;
          case SNMP_OIDS.lldpRemSysName:
            neighbor.remoteDeviceId = value.toString();
            break;
        }
      }

      for (const neighbor of neighborData.values()) {
        if (neighbor.remoteDeviceId) {
          neighbors.push({
            localInterface: neighbor.localInterface || 'unknown',
            remoteDeviceId: neighbor.remoteDeviceId,
            remoteInterface: neighbor.remoteInterface,
            protocol: 'lldp',
          });
        }
      }
    } catch (error) {
      logger.debug('LLDP not available or failed', {
        error: (error as Error).message,
      });
    }

    return neighbors;
  }

  /**
   * Get ARP table
   */
  private async getARPTable(session: snmp.Session): Promise<Array<{ ip: string; mac: string }>> {
    const arpEntries: Array<{ ip: string; mac: string }> = [];

    try {
      const arpResults = await this.walk(session, SNMP_OIDS.ipNetToMediaTable);

      for (const varbind of arpResults) {
        // Parse ARP entry
        const oidParts = varbind.oid.split('.');
        const value = varbind.value;
        if (value === null) continue;

        // OID format: .1.3.6.1.2.1.4.22.1.<type>.<ifIndex>.<ip>
        if (oidParts.length >= 4) {
          const ip = oidParts.slice(-4).join('.');
          const mac = this.formatMacAddress(value as Buffer | string);

          if (this.isValidIP(ip) && mac) {
            arpEntries.push({ ip, mac });
          }
        }
      }
    } catch (error) {
      logger.debug('ARP table walk failed', {
        error: (error as Error).message,
      });
    }

    return arpEntries;
  }

  // ============================================================================
  // SNMP Helper Methods
  // ============================================================================

  private get(session: snmp.Session, oids: string[]): Promise<snmp.Varbind[]> {
    return new Promise((resolve, reject) => {
      session.get(oids, (error, varbinds) => {
        if (error) {
          reject(error);
        } else {
          resolve(varbinds);
        }
      });
    });
  }

  private walk(session: snmp.Session, oid: string): Promise<snmp.Varbind[]> {
    return new Promise((resolve, reject) => {
      const results: snmp.Varbind[] = [];

      session.walk(
        oid,
        this.config.batchSize,
        (varbinds) => {
          for (const varbind of varbinds) {
            if (!snmp.isVarbindError(varbind)) {
              results.push(varbind);
            }
          }
        },
        (error) => {
          if (error) {
            reject(error);
          } else {
            resolve(results);
          }
        }
      );
    });
  }

  private extractString(varbinds: snmp.Varbind[], oid: string): string {
    const varbind = varbinds.find(v => v.oid === oid);
    return varbind && varbind.value !== null ? varbind.value.toString() : '';
  }

  private extractNumber(varbinds: snmp.Varbind[], oid: string): number {
    const varbind = varbinds.find(v => v.oid === oid);
    return varbind && varbind.value !== null ? parseInt(varbind.value.toString(), 10) : 0;
  }

  private formatMacAddress(value: Buffer | string): string {
    if (Buffer.isBuffer(value)) {
      return Array.from(value)
        .map(b => b.toString(16).padStart(2, '0'))
        .join(':');
    }
    return this.normalizeMacAddress(value.toString());
  }

  private isValidIP(ip: string): boolean {
    const parts = ip.split('.');
    if (parts.length !== 4) return false;
    return parts.every(part => {
      const num = parseInt(part, 10);
      return !isNaN(num) && num >= 0 && num <= 255;
    });
  }

  // ============================================================================
  // Target Management Override
  // ============================================================================

  /**
   * Add an SNMPv3 target
   */
  addSNMPTarget(
    host: string,
    securityName: string,
    options: {
      port?: number;
      securityLevel?: snmp.SecurityLevel;
      authProtocol?: snmp.AuthProtocols;
      authKey?: string;
      privProtocol?: snmp.PrivProtocols;
      privKey?: string;
    } = {}
  ): string {
    const target: Omit<SNMPTarget, 'id'> = {
      host,
      port: options.port || 161,
      enabled: true,
      version: 3,
      securityName,
      securityLevel: options.securityLevel || snmp.SecurityLevel.authPriv,
      authProtocol: options.authProtocol,
      authKey: options.authKey,
      privProtocol: options.privProtocol,
      privKey: options.privKey,
    };

    return this.addTarget(target);
  }
}

// ============================================================================
// Export
// ============================================================================

export function createSNMPCollector(config?: Partial<SNMPConfig>): SNMPCollector {
  return new SNMPCollector(config);
}

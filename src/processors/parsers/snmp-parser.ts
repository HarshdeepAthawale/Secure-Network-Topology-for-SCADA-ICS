/**
 * SNMP Data Parser - Normalizes SNMP telemetry data
 */

import { TelemetryData, Device, DeviceType, DeviceStatus, NetworkInterface, PurdueLevel, SecurityZone } from '../../utils/types';
import { VENDOR_OUI_PREFIXES, DEVICE_TYPE_PURDUE_LEVEL, PURDUE_TO_ZONE } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';

export interface ParsedSNMPDevice {
  id: string;
  sysName: string;
  sysDescr: string;
  sysLocation: string;
  sysContact: string;
  sysUpTime: number;
  sysObjectID: string;
  vendor?: string;
  model?: string;
  deviceType: DeviceType;
  interfaces: NetworkInterface[];
  neighbors: Array<{ localInterface: string; remoteDeviceId: string; remoteInterface?: string }>;
  arpEntries: Array<{ ip: string; mac: string }>;
}

export class SNMPParser {
  parse(telemetry: TelemetryData): ParsedSNMPDevice | null {
    if (!telemetry.data || typeof telemetry.data !== 'object') {
      return null;
    }

    const data = telemetry.data as Record<string, unknown>;

    if (data.type === 'system') {
      return this.parseSystemData(data);
    }

    return null;
  }

  private parseSystemData(data: Record<string, unknown>): ParsedSNMPDevice {
    const sysDescr = String(data.sysDescr || '');
    const sysName = String(data.sysName || 'unknown');

    return {
      id: generateUUID(),
      sysName,
      sysDescr,
      sysLocation: String(data.sysLocation || ''),
      sysContact: String(data.sysContact || ''),
      sysUpTime: Number(data.sysUpTime || 0),
      sysObjectID: String(data.sysObjectID || ''),
      vendor: this.detectVendor(sysDescr),
      model: this.extractModel(sysDescr),
      deviceType: this.detectDeviceType(sysDescr, sysName),
      interfaces: [],
      neighbors: [],
      arpEntries: [],
    };
  }

  private detectVendor(sysDescr: string): string | undefined {
    const lower = sysDescr.toLowerCase();
    const vendors: Record<string, string> = {
      'cisco': 'Cisco', 'siemens': 'Siemens', 'schneider': 'Schneider Electric',
      'rockwell': 'Rockwell Automation', 'allen-bradley': 'Rockwell Automation',
      'honeywell': 'Honeywell', 'abb': 'ABB', 'emerson': 'Emerson',
      'ge': 'General Electric', 'yokogawa': 'Yokogawa', 'mitsubishi': 'Mitsubishi',
      'omron': 'Omron', 'beckhoff': 'Beckhoff', 'phoenix': 'Phoenix Contact',
      'moxa': 'Moxa', 'hirschmann': 'Hirschmann', 'juniper': 'Juniper',
      'hp': 'Hewlett-Packard', 'dell': 'Dell', 'linux': 'Linux',
    };

    for (const [key, vendor] of Object.entries(vendors)) {
      if (lower.includes(key)) return vendor;
    }
    return undefined;
  }

  private extractModel(sysDescr: string): string | undefined {
    const patterns = [
      /model[:\s]+([A-Z0-9-]+)/i,
      /([A-Z]{2,}[0-9]{2,}[A-Z0-9-]*)/,
      /S7-(\d+)/i,
    ];

    for (const pattern of patterns) {
      const match = sysDescr.match(pattern);
      if (match) return match[1];
    }
    return undefined;
  }

  private detectDeviceType(sysDescr: string, sysName: string): DeviceType {
    const combined = `${sysDescr} ${sysName}`.toLowerCase();
    const typePatterns: Array<[RegExp, DeviceType]> = [
      [/\b(plc|programmable.?logic.?controller|s7-[0-9]+|controllogix)\b/i, DeviceType.PLC],
      [/\b(rtu|remote.?terminal.?unit)\b/i, DeviceType.RTU],
      [/\b(dcs|distributed.?control)\b/i, DeviceType.DCS],
      [/\b(scada|supervisory)\b/i, DeviceType.SCADA_SERVER],
      [/\b(hmi|human.?machine|panel)\b/i, DeviceType.HMI],
      [/\b(historian|pi.?server)\b/i, DeviceType.HISTORIAN],
      [/\b(switch|catalyst|nexus)\b/i, DeviceType.SWITCH],
      [/\b(router|isr|asr)\b/i, DeviceType.ROUTER],
      [/\b(firewall|asa|fortigate|pfsense)\b/i, DeviceType.FIREWALL],
      [/\b(sensor|transmitter|detector)\b/i, DeviceType.SENSOR],
      [/\b(actuator|valve|motor)\b/i, DeviceType.ACTUATOR],
      [/\b(drive|vfd|inverter)\b/i, DeviceType.DRIVE],
    ];

    for (const [pattern, type] of typePatterns) {
      if (pattern.test(combined)) return type;
    }
    return DeviceType.UNKNOWN;
  }

  parseInterfaces(data: Record<string, unknown>): NetworkInterface[] {
    const interfaces: NetworkInterface[] = [];
    const rawInterfaces = data.interfaces as Array<Record<string, unknown>> | undefined;

    if (!rawInterfaces) return interfaces;

    for (const iface of rawInterfaces) {
      interfaces.push({
        name: String(iface.name || `eth${iface.index}`),
        macAddress: this.normalizeMac(String(iface.physAddress || '')),
        speed: Number(iface.speed || 0) / 1000000,
        status: Number(iface.operStatus) === 1 ? 'up' : 'down',
      });
    }

    return interfaces;
  }

  getVendorFromMac(mac: string): string | undefined {
    const normalized = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
    const oui = `${normalized.slice(0, 2)}:${normalized.slice(2, 4)}:${normalized.slice(4, 6)}`;
    return VENDOR_OUI_PREFIXES[oui];
  }

  toDevice(parsed: ParsedSNMPDevice): Device {
    const purdueLevel = DEVICE_TYPE_PURDUE_LEVEL[parsed.deviceType] || PurdueLevel.LEVEL_5;
    const securityZone = PURDUE_TO_ZONE[purdueLevel];
    const now = new Date();

    return {
      id: parsed.id,
      name: parsed.sysName,
      hostname: parsed.sysName,
      type: parsed.deviceType,
      vendor: parsed.vendor,
      model: parsed.model,
      purdueLevel,
      securityZone,
      status: DeviceStatus.ONLINE,
      interfaces: parsed.interfaces,
      metadata: {
        sysDescr: parsed.sysDescr,
        sysLocation: parsed.sysLocation,
        sysContact: parsed.sysContact,
        sysUpTime: parsed.sysUpTime,
        sysObjectID: parsed.sysObjectID,
      },
      discoveredAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };
  }

  private normalizeMac(mac: string): string {
    return mac.toLowerCase().replace(/[^a-f0-9]/g, '').replace(/(.{2})/g, '$1:').slice(0, -1);
  }
}

export const snmpParser = new SNMPParser();

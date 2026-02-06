/**
 * ARP/MAC Parser - Layer 2 topology analysis
 */

import { TelemetryData, ARPEntry, MACTableEntry, NetworkInterface } from '../../utils/types';
import { VENDOR_OUI_PREFIXES } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';

export interface ParsedL2Device {
  id: string;
  macAddress: string;
  ipAddresses: string[];
  vendor?: string;
  vlanIds: number[];
  ports: string[];
  firstSeen: Date;
  lastSeen: Date;
}

export interface L2Topology {
  devices: ParsedL2Device[];
  connections: Array<{ sourceMac: string; targetMac: string; vlanId?: number; port?: string }>;
}

export class ARPParser {
  parse(telemetry: TelemetryData): { arpEntries: ARPEntry[]; macEntries: MACTableEntry[] } {
    const data = telemetry.data as Record<string, unknown>;
    return {
      arpEntries: data.type === 'arp' ? this.parseARPEntries(data.entries as ARPEntry[]) : [],
      macEntries: data.type === 'mac' ? this.parseMACEntries(data.entries as MACTableEntry[]) : [],
    };
  }

  private parseARPEntries(entries: ARPEntry[]): ARPEntry[] {
    return entries.filter(e => e.ipAddress && e.macAddress).map(entry => ({
      ...entry,
      macAddress: this.normalizeMac(entry.macAddress),
    }));
  }

  private parseMACEntries(entries: MACTableEntry[]): MACTableEntry[] {
    return entries.filter(e => e.macAddress).map(entry => ({
      ...entry,
      macAddress: this.normalizeMac(entry.macAddress),
    }));
  }

  buildL2Topology(arpEntries: ARPEntry[], macEntries: MACTableEntry[]): L2Topology {
    const deviceMap = new Map<string, ParsedL2Device>();
    const now = new Date();

    for (const entry of arpEntries) {
      const mac = entry.macAddress;
      const existing = deviceMap.get(mac);

      if (existing) {
        if (!existing.ipAddresses.includes(entry.ipAddress)) existing.ipAddresses.push(entry.ipAddress);
        if (entry.vlanId && !existing.vlanIds.includes(entry.vlanId)) existing.vlanIds.push(entry.vlanId);
        existing.lastSeen = now;
      } else {
        deviceMap.set(mac, {
          id: generateUUID(),
          macAddress: mac,
          ipAddresses: [entry.ipAddress],
          vendor: this.getVendorFromMac(mac),
          vlanIds: entry.vlanId ? [entry.vlanId] : [],
          ports: [],
          firstSeen: now,
          lastSeen: now,
        });
      }
    }

    for (const entry of macEntries) {
      const mac = entry.macAddress;
      const existing = deviceMap.get(mac);

      if (existing) {
        if (!existing.vlanIds.includes(entry.vlanId)) existing.vlanIds.push(entry.vlanId);
        if (!existing.ports.includes(entry.port)) existing.ports.push(entry.port);
        existing.lastSeen = now;
      } else {
        deviceMap.set(mac, {
          id: generateUUID(),
          macAddress: mac,
          ipAddresses: [],
          vendor: this.getVendorFromMac(mac),
          vlanIds: [entry.vlanId],
          ports: [entry.port],
          firstSeen: now,
          lastSeen: now,
        });
      }
    }

    return {
      devices: Array.from(deviceMap.values()),
      connections: this.inferConnections(macEntries),
    };
  }

  private inferConnections(macEntries: MACTableEntry[]): L2Topology['connections'] {
    const connections: L2Topology['connections'] = [];
    const byPort = new Map<string, MACTableEntry[]>();

    for (const entry of macEntries) {
      const key = `${entry.vlanId}:${entry.port}`;
      const list = byPort.get(key) || [];
      list.push(entry);
      byPort.set(key, list);
    }

    for (const [, entries] of byPort) {
      if (entries.length === 2) {
        connections.push({
          sourceMac: entries[0].macAddress,
          targetMac: entries[1].macAddress,
          vlanId: entries[0].vlanId,
          port: entries[0].port,
        });
      }
    }

    return connections;
  }

  getVendorFromMac(mac: string): string | undefined {
    const normalized = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
    const oui = `${normalized.slice(0, 2)}:${normalized.slice(2, 4)}:${normalized.slice(4, 6)}`;
    return VENDOR_OUI_PREFIXES[oui];
  }

  toNetworkInterface(device: ParsedL2Device): NetworkInterface {
    return {
      name: 'eth0',
      macAddress: device.macAddress,
      ipAddress: device.ipAddresses[0],
      vlanId: device.vlanIds[0],
      status: 'up',
    };
  }

  private normalizeMac(mac: string): string {
    return mac.toLowerCase().replace(/[^a-f0-9]/g, '').replace(/(.{2})/g, '$1:').slice(0, -1);
  }
}

export const arpParser = new ARPParser();

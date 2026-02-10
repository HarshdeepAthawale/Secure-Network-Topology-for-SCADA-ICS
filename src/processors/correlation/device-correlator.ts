/**
 * Device Correlator - Correlates device identity across telemetry sources
 */

import { Device, DeviceType, DeviceStatus, NetworkInterface, PurdueLevel, SecurityZone } from '../../utils/types';
import { DEVICE_TYPE_PURDUE_LEVEL, PURDUE_TO_ZONE } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';

/** Source priority for merge: lower index = higher priority (wins on conflict). */
export const SOURCE_PRIORITY_ORDER = ['snmp', 'arp', 'syslog', 'netflow'] as const;

/** Staleness window in minutes; data older than this contributes less to confidence. */
export const STALENESS_MINUTES = parseInt(process.env.TELEMETRY_STALENESS_MINUTES ?? '15', 10) || 15;

export interface DeviceCandidate {
  source: string;
  ipAddress?: string;
  macAddress?: string;
  hostname?: string;
  sysName?: string;
  vendor?: string;
  model?: string;
  deviceType?: DeviceType;
  interfaces?: NetworkInterface[];
  metadata?: Record<string, unknown>;
  confidence: number;
  /** Telemetry timestamp for recency ordering and freshness scoring. */
  timestamp?: Date;
}

export interface CorrelationResult {
  device: Device;
  sources: string[];
  confidence: number;
  correlatedBy: string[];
}

export class DeviceCorrelator {
  private knownDevices: Map<string, Device> = new Map();
  private macToDeviceId: Map<string, string> = new Map();
  private ipToDeviceId: Map<string, string> = new Map();
  private hostnameToDeviceId: Map<string, string> = new Map();

  correlate(candidates: DeviceCandidate[]): CorrelationResult[] {
    const results: CorrelationResult[] = [];
    const processed = new Set<number>();

    for (let i = 0; i < candidates.length; i++) {
      if (processed.has(i)) continue;

      const candidate = candidates[i];
      const matches: number[] = [i];

      // Find matching candidates
      for (let j = i + 1; j < candidates.length; j++) {
        if (processed.has(j)) continue;
        if (this.candidatesMatch(candidate, candidates[j])) {
          matches.push(j);
        }
      }

      matches.forEach(idx => processed.add(idx));
      const matchedCandidates = matches.map(idx => candidates[idx]);
      const sortedCandidates = this.sortCandidatesByPriorityAndRecency(matchedCandidates);
      const result = this.mergeAndCorrelate(sortedCandidates);
      results.push(result);
    }

    return results;
  }

  private candidatesMatch(a: DeviceCandidate, b: DeviceCandidate): boolean {
    // Match by MAC address
    if (a.macAddress && b.macAddress && this.normalizeMac(a.macAddress) === this.normalizeMac(b.macAddress)) {
      return true;
    }

    // Match by IP address
    if (a.ipAddress && b.ipAddress && a.ipAddress === b.ipAddress) {
      return true;
    }

    // Match by hostname/sysName
    if (a.hostname && b.hostname && a.hostname.toLowerCase() === b.hostname.toLowerCase()) {
      return true;
    }

    if (a.sysName && b.sysName && a.sysName.toLowerCase() === b.sysName.toLowerCase()) {
      return true;
    }

    return false;
  }

  /**
   * Sort candidates so higher-priority source wins, then newest first within same source.
   * Missing timestamp is treated as oldest.
   */
  private sortCandidatesByPriorityAndRecency(candidates: DeviceCandidate[]): DeviceCandidate[] {
    const priorityIndex = (source: string): number => {
      const i = SOURCE_PRIORITY_ORDER.indexOf(source as (typeof SOURCE_PRIORITY_ORDER)[number]);
      return i >= 0 ? i : SOURCE_PRIORITY_ORDER.length;
    };
    const ts = (c: DeviceCandidate): number =>
      c.timestamp ? c.timestamp.getTime() : 0;
    return [...candidates].sort((a, b) => {
      const pa = priorityIndex(a.source);
      const pb = priorityIndex(b.source);
      if (pa !== pb) return pa - pb;
      return ts(b) - ts(a); // newest first
    });
  }

  private mergeAndCorrelate(candidates: DeviceCandidate[]): CorrelationResult {
    const correlatedBy: string[] = [];
    const sources = [...new Set(candidates.map(c => c.source))];

    // Find existing device
    let existingDevice: Device | undefined;
    let existingId: string | undefined;

    for (const candidate of candidates) {
      if (candidate.macAddress) {
        existingId = this.macToDeviceId.get(this.normalizeMac(candidate.macAddress));
        if (existingId) {
          correlatedBy.push('mac');
          break;
        }
      }
      if (candidate.ipAddress) {
        existingId = this.ipToDeviceId.get(candidate.ipAddress);
        if (existingId) {
          correlatedBy.push('ip');
          break;
        }
      }
      if (candidate.hostname) {
        existingId = this.hostnameToDeviceId.get(candidate.hostname.toLowerCase());
        if (existingId) {
          correlatedBy.push('hostname');
          break;
        }
      }
    }

    if (existingId) {
      existingDevice = this.knownDevices.get(existingId);
    }

    // Merge candidate data
    const merged = this.mergeCandidates(candidates);
    const confidence = this.calculateConfidence(candidates, correlatedBy);

    // Create or update device
    const device = existingDevice
      ? this.updateDevice(existingDevice, merged, sources)
      : this.createDevice(merged, sources);

    // Update indexes
    this.indexDevice(device);

    return { device, sources, confidence, correlatedBy };
  }

  private mergeCandidates(candidates: DeviceCandidate[]): DeviceCandidate {
    const merged: DeviceCandidate = {
      source: 'merged',
      confidence: 0,
      interfaces: [],
      metadata: {},
    };

    // Merge all interfaces
    const allInterfaces: NetworkInterface[] = [];
    const seenMacs = new Set<string>();

    for (const candidate of candidates) {
      // Take first non-empty values
      if (!merged.ipAddress && candidate.ipAddress) merged.ipAddress = candidate.ipAddress;
      if (!merged.macAddress && candidate.macAddress) merged.macAddress = candidate.macAddress;
      if (!merged.hostname && candidate.hostname) merged.hostname = candidate.hostname;
      if (!merged.sysName && candidate.sysName) merged.sysName = candidate.sysName;
      if (!merged.vendor && candidate.vendor) merged.vendor = candidate.vendor;
      if (!merged.model && candidate.model) merged.model = candidate.model;
      if (!merged.deviceType && candidate.deviceType) merged.deviceType = candidate.deviceType;

      // Merge interfaces
      if (candidate.interfaces) {
        for (const iface of candidate.interfaces) {
          const mac = this.normalizeMac(iface.macAddress);
          if (!seenMacs.has(mac)) {
            seenMacs.add(mac);
            allInterfaces.push(iface);
          }
        }
      }

      // Merge metadata
      if (candidate.metadata) {
        merged.metadata = { ...merged.metadata, ...candidate.metadata };
      }

      merged.confidence = Math.max(merged.confidence, candidate.confidence);
    }

    merged.interfaces = allInterfaces;
    return merged;
  }

  private createDevice(candidate: DeviceCandidate, sources: string[]): Device {
    const deviceType = candidate.deviceType || DeviceType.UNKNOWN;
    const purdueLevel = DEVICE_TYPE_PURDUE_LEVEL[deviceType] || PurdueLevel.LEVEL_5;
    const now = new Date();

    const device: Device = {
      id: generateUUID(),
      name: candidate.sysName || candidate.hostname || candidate.ipAddress || 'Unknown Device',
      hostname: candidate.hostname,
      type: deviceType,
      vendor: candidate.vendor,
      model: candidate.model,
      purdueLevel,
      securityZone: PURDUE_TO_ZONE[purdueLevel],
      status: DeviceStatus.ONLINE,
      interfaces: candidate.interfaces || [],
      metadata: {
        ...candidate.metadata,
        sources,
        correlationConfidence: candidate.confidence,
      },
      discoveredAt: now,
      lastSeenAt: now,
      createdAt: now,
      updatedAt: now,
    };

    this.knownDevices.set(device.id, device);
    return device;
  }

  private updateDevice(existing: Device, candidate: DeviceCandidate, sources: string[]): Device {
    const now = new Date();

    // Update with new information
    if (candidate.vendor && !existing.vendor) existing.vendor = candidate.vendor;
    if (candidate.model && !existing.model) existing.model = candidate.model;
    if (candidate.deviceType && existing.type === DeviceType.UNKNOWN) {
      existing.type = candidate.deviceType;
      existing.purdueLevel = DEVICE_TYPE_PURDUE_LEVEL[candidate.deviceType];
      existing.securityZone = PURDUE_TO_ZONE[existing.purdueLevel];
    }

    // Merge interfaces
    if (candidate.interfaces) {
      const existingMacs = new Set(existing.interfaces.map(i => this.normalizeMac(i.macAddress)));
      for (const iface of candidate.interfaces) {
        if (!existingMacs.has(this.normalizeMac(iface.macAddress))) {
          existing.interfaces.push(iface);
        }
      }
    }

    // Update metadata
    const existingSources = (existing.metadata.sources as string[]) || [];
    existing.metadata = {
      ...existing.metadata,
      ...candidate.metadata,
      sources: [...new Set([...existingSources, ...sources])],
    };

    existing.lastSeenAt = now;
    existing.updatedAt = now;
    existing.status = DeviceStatus.ONLINE;

    return existing;
  }

  private indexDevice(device: Device): void {
    this.knownDevices.set(device.id, device);

    for (const iface of device.interfaces) {
      if (iface.macAddress) {
        this.macToDeviceId.set(this.normalizeMac(iface.macAddress), device.id);
      }
      if (iface.ipAddress) {
        this.ipToDeviceId.set(iface.ipAddress, device.id);
      }
    }

    if (device.hostname) {
      this.hostnameToDeviceId.set(device.hostname.toLowerCase(), device.id);
    }
  }

  /**
   * Freshness factor in [0, 1]: 1 when timestamp is now, 0 when older than STALENESS_MINUTES.
   * Missing timestamp is treated as fresh (1) for backward compatibility when callers do not set it.
   */
  private freshnessFactor(candidate: DeviceCandidate): number {
    if (!candidate.timestamp) return 1;
    const ageMinutes = (Date.now() - candidate.timestamp.getTime()) / 60_000;
    return Math.max(0, 1 - ageMinutes / STALENESS_MINUTES);
  }

  private calculateConfidence(candidates: DeviceCandidate[], correlatedBy: string[]): number {
    const factors = candidates.map(c => this.freshnessFactor(c));

    // Effective source count: weight by freshness (stale data contributes less)
    const effectiveSourceCount = factors.reduce((sum, f) => sum + f, 0);
    let confidence = Math.min(effectiveSourceCount * 15, 45);

    // Multiple correlation methods = higher confidence
    confidence += correlatedBy.length * 15;

    // Weighted average candidate confidence by freshness
    const totalWeight = factors.reduce((s, f) => s + f, 0);
    const weightedConfidence =
      totalWeight > 0
        ? candidates.reduce((sum, c, i) => sum + c.confidence * factors[i], 0) / totalWeight
        : 0;
    confidence += weightedConfidence * 0.4;

    return Math.min(Math.round(confidence), 100);
  }

  findDevice(criteria: { mac?: string; ip?: string; hostname?: string }): Device | undefined {
    if (criteria.mac) {
      const id = this.macToDeviceId.get(this.normalizeMac(criteria.mac));
      if (id) return this.knownDevices.get(id);
    }
    if (criteria.ip) {
      const id = this.ipToDeviceId.get(criteria.ip);
      if (id) return this.knownDevices.get(id);
    }
    if (criteria.hostname) {
      const id = this.hostnameToDeviceId.get(criteria.hostname.toLowerCase());
      if (id) return this.knownDevices.get(id);
    }
    return undefined;
  }

  getAllDevices(): Device[] {
    return Array.from(this.knownDevices.values());
  }

  private normalizeMac(mac: string): string {
    return mac.toLowerCase().replace(/[^a-f0-9]/g, '');
  }
}

export const deviceCorrelator = new DeviceCorrelator();

/**
 * NetFlow Data Parser - Normalizes flow data for topology analysis
 */

import { TelemetryData, NetFlowRecord, Connection, ConnectionType } from '../../utils/types';
import { IP_PROTOCOLS, INDUSTRIAL_PORTS } from '../../utils/constants';
import { logger } from '../../utils/logger';
import { generateUUID } from '../../utils/crypto';

export interface ParsedFlow {
  id: string;
  srcAddress: string;
  dstAddress: string;
  srcPort: number;
  dstPort: number;
  protocol: string;
  protocolNumber: number;
  bytes: number;
  packets: number;
  startTime: Date;
  endTime: Date;
  duration: number;
  bytesPerSecond: number;
  isIndustrial: boolean;
  industrialProtocol?: string;
  tcpFlags?: number;
}

export interface FlowSummary {
  totalFlows: number;
  totalBytes: number;
  totalPackets: number;
  uniqueSources: number;
  uniqueDestinations: number;
  topTalkers: Array<{ address: string; bytes: number }>;
  topProtocols: Array<{ protocol: string; bytes: number }>;
  industrialFlows: number;
}

export class NetFlowParser {
  parse(telemetry: TelemetryData): ParsedFlow[] {
    const data = telemetry.data as Record<string, unknown>;
    if (data.type !== 'netflow' || !Array.isArray(data.flows)) return [];

    return (data.flows as NetFlowRecord[]).map(flow => this.parseFlow(flow)).filter(Boolean) as ParsedFlow[];
  }

  private parseFlow(flow: NetFlowRecord): ParsedFlow {
    const duration = (flow.endTime.getTime() - flow.startTime.getTime()) / 1000;
    const industrialInfo = this.detectIndustrialProtocol(flow.dstPort, flow.srcPort);

    return {
      id: generateUUID(),
      srcAddress: flow.srcAddress,
      dstAddress: flow.dstAddress,
      srcPort: flow.srcPort,
      dstPort: flow.dstPort,
      protocol: IP_PROTOCOLS[flow.protocol] || `Unknown(${flow.protocol})`,
      protocolNumber: flow.protocol,
      bytes: flow.bytes,
      packets: flow.packets,
      startTime: flow.startTime,
      endTime: flow.endTime,
      duration,
      bytesPerSecond: duration > 0 ? flow.bytes / duration : 0,
      isIndustrial: industrialInfo.isIndustrial,
      industrialProtocol: industrialInfo.protocol,
      tcpFlags: flow.tcpFlags,
    };
  }

  private detectIndustrialProtocol(dstPort: number, srcPort: number): { isIndustrial: boolean; protocol?: string } {
    const portInfo = INDUSTRIAL_PORTS[dstPort] || INDUSTRIAL_PORTS[srcPort];
    return portInfo ? { isIndustrial: true, protocol: portInfo.protocol } : { isIndustrial: false };
  }

  summarize(flows: ParsedFlow[]): FlowSummary {
    const sources = new Set<string>();
    const destinations = new Set<string>();
    const bySource = new Map<string, number>();
    const byProtocol = new Map<string, number>();
    let totalBytes = 0, totalPackets = 0, industrialFlows = 0;

    for (const flow of flows) {
      sources.add(flow.srcAddress);
      destinations.add(flow.dstAddress);
      totalBytes += flow.bytes;
      totalPackets += flow.packets;
      if (flow.isIndustrial) industrialFlows++;

      bySource.set(flow.srcAddress, (bySource.get(flow.srcAddress) || 0) + flow.bytes);
      byProtocol.set(flow.protocol, (byProtocol.get(flow.protocol) || 0) + flow.bytes);
    }

    return {
      totalFlows: flows.length,
      totalBytes,
      totalPackets,
      uniqueSources: sources.size,
      uniqueDestinations: destinations.size,
      topTalkers: Array.from(bySource.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([address, bytes]) => ({ address, bytes })),
      topProtocols: Array.from(byProtocol.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10).map(([protocol, bytes]) => ({ protocol, bytes })),
      industrialFlows,
    };
  }

  toConnection(flow: ParsedFlow, sourceDeviceId: string, targetDeviceId: string): Connection {
    const now = new Date();
    return {
      id: generateUUID(),
      sourceDeviceId,
      targetDeviceId,
      connectionType: ConnectionType.ETHERNET,
      protocol: flow.industrialProtocol || flow.protocol,
      port: flow.dstPort,
      bandwidth: flow.bytesPerSecond * 8 / 1000000,
      isSecure: flow.dstPort === 443 || flow.dstPort === 8883 || flow.dstPort === 4840,
      encryptionType: flow.dstPort === 443 ? 'TLS' : undefined,
      discoveredAt: flow.startTime,
      lastSeenAt: flow.endTime,
      metadata: { bytes: flow.bytes, packets: flow.packets, isIndustrial: flow.isIndustrial },
    };
  }
}

export const netflowParser = new NetFlowParser();

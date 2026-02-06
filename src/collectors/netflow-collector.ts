/**
 * NetFlow Collector - Traffic flow analysis
 */

import * as dgram from 'dgram';
import { BaseCollector, CollectorTarget } from './base-collector';
import {
  TelemetryData,
  TelemetrySource,
  CollectorConfig,
  NetFlowRecord,
} from '../utils/types';
import { IP_PROTOCOLS } from '../utils/constants';
import { logger } from '../utils/logger';
import { NetFlowError } from '../utils/error-handler';
import { config } from '../utils/config';

// ============================================================================
// Types
// ============================================================================

interface NetFlowV5Header {
  version: number;
  count: number;
  sysUptime: number;
  unixSecs: number;
  unixNsecs: number;
  flowSequence: number;
  engineType: number;
  engineId: number;
  samplingInterval: number;
}

interface NetFlowV5Record {
  srcAddr: string;
  dstAddr: string;
  nextHop: string;
  input: number;
  output: number;
  dPkts: number;
  dOctets: number;
  first: number;
  last: number;
  srcPort: number;
  dstPort: number;
  tcpFlags: number;
  prot: number;
  tos: number;
  srcAs: number;
  dstAs: number;
  srcMask: number;
  dstMask: number;
}

interface NetFlowV9Header {
  version: number;
  count: number;
  sysUptime: number;
  unixSecs: number;
  sequenceNumber: number;
  sourceId: number;
}

interface NetFlowV9Template {
  templateId: number;
  fieldCount: number;
  fields: Array<{ type: number; length: number }>;
}

// ============================================================================
// NetFlow Collector Class
// ============================================================================

export class NetFlowCollector extends BaseCollector {
  private server: dgram.Socket | null = null;
  private readonly port: number;
  private readonly version: number;
  private templates: Map<number, NetFlowV9Template> = new Map();
  private flowBuffer: NetFlowRecord[] = [];
  private readonly maxBufferSize = 10000;

  constructor(collectorConfig?: Partial<CollectorConfig>) {
    const mergedConfig = {
      ...config.collector,
      ...collectorConfig,
    };

    super('NetFlowCollector', TelemetrySource.NETFLOW, mergedConfig);

    this.port = config.netflow.port;
    this.version = config.netflow.version;
  }

  // ============================================================================
  // Lifecycle Implementation
  // ============================================================================

  protected async initialize(): Promise<void> {
    logger.info('Initializing NetFlow collector', { port: this.port });

    return new Promise((resolve, reject) => {
      this.server = dgram.createSocket('udp4');

      this.server.on('error', (error) => {
        logger.error('NetFlow server error', { error: error.message });
        reject(new NetFlowError(`Server error: ${error.message}`));
      });

      this.server.on('message', (msg, rinfo) => {
        this.handlePacket(msg, rinfo);
      });

      this.server.on('listening', () => {
        const address = this.server!.address();
        logger.info('NetFlow collector listening', {
          address: address.address,
          port: address.port,
        });
        resolve();
      });

      this.server.bind(this.port);
    });
  }

  protected async cleanup(): Promise<void> {
    logger.info('Cleaning up NetFlow collector');

    if (this.server) {
      return new Promise((resolve) => {
        this.server!.close(() => {
          this.server = null;
          resolve();
        });
      });
    }
  }

  // ============================================================================
  // Collection Implementation
  // ============================================================================

  protected async collect(_target: CollectorTarget): Promise<TelemetryData[]> {
    // NetFlow is passive - we collect from the buffer
    const telemetryData: TelemetryData[] = [];

    if (this.flowBuffer.length > 0) {
      // Get all buffered flows
      const flows = [...this.flowBuffer];
      this.flowBuffer = [];

      // Aggregate flows
      const aggregatedFlows = this.aggregateFlows(flows);

      telemetryData.push(this.createTelemetryData(
        {
          type: 'netflow',
          recordCount: aggregatedFlows.length,
          flows: aggregatedFlows,
        },
        undefined
      ));

      logger.debug('NetFlow collection completed', {
        rawFlows: flows.length,
        aggregatedFlows: aggregatedFlows.length,
      });
    }

    return telemetryData;
  }

  // ============================================================================
  // Packet Processing
  // ============================================================================

  /**
   * Handle incoming NetFlow packet
   */
  private handlePacket(data: Buffer, rinfo: dgram.RemoteInfo): void {
    try {
      const version = data.readUInt16BE(0);

      switch (version) {
        case 5:
          this.parseNetFlowV5(data, rinfo);
          break;
        case 9:
          this.parseNetFlowV9(data, rinfo);
          break;
        default:
          logger.warn('Unsupported NetFlow version', { version, source: rinfo.address });
      }
    } catch (error) {
      logger.error('Failed to parse NetFlow packet', {
        error: (error as Error).message,
        source: rinfo.address,
      });
    }
  }

  /**
   * Parse NetFlow v5 packet
   */
  private parseNetFlowV5(data: Buffer, rinfo: dgram.RemoteInfo): void {
    const header = this.parseV5Header(data);
    const records: NetFlowRecord[] = [];

    let offset = 24; // Header size for v5

    for (let i = 0; i < header.count; i++) {
      if (offset + 48 > data.length) break;

      const record = this.parseV5Record(data, offset, header);
      records.push(record);
      offset += 48; // Record size for v5
    }

    // Add to buffer
    this.addToBuffer(records);

    logger.trace('Processed NetFlow v5 packet', {
      source: rinfo.address,
      flowCount: records.length,
    });
  }

  /**
   * Parse NetFlow v5 header
   */
  private parseV5Header(data: Buffer): NetFlowV5Header {
    return {
      version: data.readUInt16BE(0),
      count: data.readUInt16BE(2),
      sysUptime: data.readUInt32BE(4),
      unixSecs: data.readUInt32BE(8),
      unixNsecs: data.readUInt32BE(12),
      flowSequence: data.readUInt32BE(16),
      engineType: data.readUInt8(20),
      engineId: data.readUInt8(21),
      samplingInterval: data.readUInt16BE(22) & 0x3fff,
    };
  }

  /**
   * Parse NetFlow v5 record
   */
  private parseV5Record(data: Buffer, offset: number, header: NetFlowV5Header): NetFlowRecord {
    const first = data.readUInt32BE(offset + 24);
    const last = data.readUInt32BE(offset + 28);

    // Convert to timestamps
    const baseTime = new Date(header.unixSecs * 1000);
    const firstTime = new Date(baseTime.getTime() - (header.sysUptime - first));
    const lastTime = new Date(baseTime.getTime() - (header.sysUptime - last));

    return {
      srcAddress: this.intToIP(data.readUInt32BE(offset)),
      dstAddress: this.intToIP(data.readUInt32BE(offset + 4)),
      srcPort: data.readUInt16BE(offset + 32),
      dstPort: data.readUInt16BE(offset + 34),
      protocol: data.readUInt8(offset + 38),
      bytes: data.readUInt32BE(offset + 20),
      packets: data.readUInt32BE(offset + 16),
      startTime: firstTime,
      endTime: lastTime,
      tcpFlags: data.readUInt8(offset + 37),
      tos: data.readUInt8(offset + 39),
    };
  }

  /**
   * Parse NetFlow v9 packet
   */
  private parseNetFlowV9(data: Buffer, rinfo: dgram.RemoteInfo): void {
    const header = this.parseV9Header(data);
    let offset = 20; // Header size for v9

    while (offset < data.length) {
      const flowsetId = data.readUInt16BE(offset);
      const flowsetLength = data.readUInt16BE(offset + 2);

      if (flowsetLength < 4) break;

      if (flowsetId === 0) {
        // Template flowset
        this.parseV9Template(data, offset + 4, flowsetLength - 4);
      } else if (flowsetId === 1) {
        // Options template flowset
        logger.debug('NetFlow v9 options template received');
      } else if (flowsetId >= 256) {
        // Data flowset
        const records = this.parseV9Data(data, offset + 4, flowsetLength - 4, flowsetId);
        this.addToBuffer(records);
      }

      offset += flowsetLength;
    }

    logger.trace('Processed NetFlow v9 packet', {
      source: rinfo.address,
      flowsets: header.count,
    });
  }

  /**
   * Parse NetFlow v9 header
   */
  private parseV9Header(data: Buffer): NetFlowV9Header {
    return {
      version: data.readUInt16BE(0),
      count: data.readUInt16BE(2),
      sysUptime: data.readUInt32BE(4),
      unixSecs: data.readUInt32BE(8),
      sequenceNumber: data.readUInt32BE(12),
      sourceId: data.readUInt32BE(16),
    };
  }

  /**
   * Parse NetFlow v9 template
   */
  private parseV9Template(data: Buffer, offset: number, length: number): void {
    let pos = offset;

    while (pos < offset + length) {
      const templateId = data.readUInt16BE(pos);
      const fieldCount = data.readUInt16BE(pos + 2);
      pos += 4;

      const fields: Array<{ type: number; length: number }> = [];

      for (let i = 0; i < fieldCount; i++) {
        if (pos + 4 > offset + length) break;

        fields.push({
          type: data.readUInt16BE(pos),
          length: data.readUInt16BE(pos + 2),
        });
        pos += 4;
      }

      this.templates.set(templateId, {
        templateId,
        fieldCount,
        fields,
      });

      logger.debug('NetFlow v9 template received', {
        templateId,
        fieldCount,
      });
    }
  }

  /**
   * Parse NetFlow v9 data
   */
  private parseV9Data(
    data: Buffer,
    offset: number,
    length: number,
    templateId: number
  ): NetFlowRecord[] {
    const template = this.templates.get(templateId);
    if (!template) {
      logger.debug('No template for flowset', { templateId });
      return [];
    }

    const records: NetFlowRecord[] = [];
    const recordSize = template.fields.reduce((sum, f) => sum + f.length, 0);

    let pos = offset;

    while (pos + recordSize <= offset + length) {
      const record = this.parseV9Record(data, pos, template);
      if (record) {
        records.push(record);
      }
      pos += recordSize;
    }

    return records;
  }

  /**
   * Parse NetFlow v9 record based on template
   */
  private parseV9Record(
    data: Buffer,
    offset: number,
    template: NetFlowV9Template
  ): NetFlowRecord | null {
    const record: Partial<NetFlowRecord> = {
      srcAddress: '0.0.0.0',
      dstAddress: '0.0.0.0',
      srcPort: 0,
      dstPort: 0,
      protocol: 0,
      bytes: 0,
      packets: 0,
      startTime: new Date(),
      endTime: new Date(),
    };

    let pos = offset;

    for (const field of template.fields) {
      switch (field.type) {
        case 8: // SRC_ADDR
          record.srcAddress = this.intToIP(data.readUInt32BE(pos));
          break;
        case 12: // DST_ADDR
          record.dstAddress = this.intToIP(data.readUInt32BE(pos));
          break;
        case 7: // L4_SRC_PORT
          record.srcPort = data.readUInt16BE(pos);
          break;
        case 11: // L4_DST_PORT
          record.dstPort = data.readUInt16BE(pos);
          break;
        case 4: // PROTOCOL
          record.protocol = data.readUInt8(pos);
          break;
        case 1: // IN_BYTES
          record.bytes = field.length === 4
            ? data.readUInt32BE(pos)
            : Number(data.readBigUInt64BE(pos));
          break;
        case 2: // IN_PKTS
          record.packets = field.length === 4
            ? data.readUInt32BE(pos)
            : Number(data.readBigUInt64BE(pos));
          break;
        case 6: // TCP_FLAGS
          record.tcpFlags = data.readUInt8(pos);
          break;
        case 5: // TOS
          record.tos = data.readUInt8(pos);
          break;
      }

      pos += field.length;
    }

    return record as NetFlowRecord;
  }

  // ============================================================================
  // Flow Aggregation
  // ============================================================================

  /**
   * Aggregate flows by source/destination/port/protocol
   */
  private aggregateFlows(flows: NetFlowRecord[]): NetFlowRecord[] {
    const aggregated = new Map<string, NetFlowRecord>();

    for (const flow of flows) {
      const key = `${flow.srcAddress}:${flow.srcPort}-${flow.dstAddress}:${flow.dstPort}-${flow.protocol}`;

      if (aggregated.has(key)) {
        const existing = aggregated.get(key)!;
        existing.bytes += flow.bytes;
        existing.packets += flow.packets;
        if (flow.startTime < existing.startTime) {
          existing.startTime = flow.startTime;
        }
        if (flow.endTime > existing.endTime) {
          existing.endTime = flow.endTime;
        }
      } else {
        aggregated.set(key, { ...flow });
      }
    }

    return Array.from(aggregated.values());
  }

  /**
   * Add flows to buffer
   */
  private addToBuffer(flows: NetFlowRecord[]): void {
    this.flowBuffer.push(...flows);

    // Limit buffer size
    if (this.flowBuffer.length > this.maxBufferSize) {
      this.flowBuffer = this.flowBuffer.slice(-this.maxBufferSize);
      logger.warn('NetFlow buffer overflow - oldest flows dropped');
    }
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Convert integer to IP address string
   */
  private intToIP(num: number): string {
    return [
      (num >>> 24) & 0xff,
      (num >>> 16) & 0xff,
      (num >>> 8) & 0xff,
      num & 0xff,
    ].join('.');
  }

  /**
   * Get protocol name from number
   */
  getProtocolName(protocol: number): string {
    return IP_PROTOCOLS[protocol] || `Unknown(${protocol})`;
  }

  // ============================================================================
  // Statistics
  // ============================================================================

  /**
   * Get current buffer statistics
   */
  getBufferStats(): {
    flowCount: number;
    templateCount: number;
    oldestFlow?: Date;
    newestFlow?: Date;
  } {
    return {
      flowCount: this.flowBuffer.length,
      templateCount: this.templates.size,
      oldestFlow: this.flowBuffer.length > 0 ? this.flowBuffer[0].startTime : undefined,
      newestFlow: this.flowBuffer.length > 0
        ? this.flowBuffer[this.flowBuffer.length - 1].startTime
        : undefined,
    };
  }
}

// ============================================================================
// Export
// ============================================================================

export function createNetFlowCollector(config?: Partial<CollectorConfig>): NetFlowCollector {
  return new NetFlowCollector(config);
}

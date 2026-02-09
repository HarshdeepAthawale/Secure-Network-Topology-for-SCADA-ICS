"use strict";
/**
 * NetFlow Collector - Traffic flow analysis
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.NetFlowCollector = void 0;
exports.createNetFlowCollector = createNetFlowCollector;
const dgram = __importStar(require("dgram"));
const base_collector_1 = require("./base-collector");
const types_1 = require("../utils/types");
const constants_1 = require("../utils/constants");
const logger_1 = require("../utils/logger");
const error_handler_1 = require("../utils/error-handler");
const config_1 = require("../utils/config");
// ============================================================================
// NetFlow Collector Class
// ============================================================================
class NetFlowCollector extends base_collector_1.BaseCollector {
    server = null;
    port;
    version;
    templates = new Map();
    flowBuffer = [];
    maxBufferSize = 10000;
    constructor(collectorConfig) {
        const mergedConfig = {
            ...config_1.config.collector,
            ...collectorConfig,
        };
        super('NetFlowCollector', types_1.TelemetrySource.NETFLOW, mergedConfig);
        this.port = config_1.config.netflow.port;
        this.version = config_1.config.netflow.version;
    }
    // ============================================================================
    // Lifecycle Implementation
    // ============================================================================
    async initialize() {
        logger_1.logger.info('Initializing NetFlow collector', { port: this.port });
        return new Promise((resolve, reject) => {
            this.server = dgram.createSocket('udp4');
            this.server.on('error', (error) => {
                logger_1.logger.error('NetFlow server error', { error: error.message });
                reject(new error_handler_1.NetFlowError(`Server error: ${error.message}`));
            });
            this.server.on('message', (msg, rinfo) => {
                this.handlePacket(msg, rinfo);
            });
            this.server.on('listening', () => {
                const address = this.server.address();
                logger_1.logger.info('NetFlow collector listening', {
                    address: address.address,
                    port: address.port,
                });
                resolve();
            });
            this.server.bind(this.port);
        });
    }
    async cleanup() {
        logger_1.logger.info('Cleaning up NetFlow collector');
        if (this.server) {
            return new Promise((resolve) => {
                this.server.close(() => {
                    this.server = null;
                    resolve();
                });
            });
        }
    }
    // ============================================================================
    // Collection Implementation
    // ============================================================================
    async collect(_target) {
        // NetFlow is passive - we collect from the buffer
        const telemetryData = [];
        if (this.flowBuffer.length > 0) {
            // Get all buffered flows
            const flows = [...this.flowBuffer];
            this.flowBuffer = [];
            // Aggregate flows
            const aggregatedFlows = this.aggregateFlows(flows);
            telemetryData.push(this.createTelemetryData({
                type: 'netflow',
                recordCount: aggregatedFlows.length,
                flows: aggregatedFlows,
            }, undefined));
            logger_1.logger.debug('NetFlow collection completed', {
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
    handlePacket(data, rinfo) {
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
                    logger_1.logger.warn('Unsupported NetFlow version', { version, source: rinfo.address });
            }
        }
        catch (error) {
            logger_1.logger.error('Failed to parse NetFlow packet', {
                error: error.message,
                source: rinfo.address,
            });
        }
    }
    /**
     * Parse NetFlow v5 packet
     */
    parseNetFlowV5(data, rinfo) {
        const header = this.parseV5Header(data);
        const records = [];
        let offset = 24; // Header size for v5
        for (let i = 0; i < header.count; i++) {
            if (offset + 48 > data.length)
                break;
            const record = this.parseV5Record(data, offset, header);
            records.push(record);
            offset += 48; // Record size for v5
        }
        // Add to buffer
        this.addToBuffer(records);
        logger_1.logger.trace('Processed NetFlow v5 packet', {
            source: rinfo.address,
            flowCount: records.length,
        });
    }
    /**
     * Parse NetFlow v5 header
     */
    parseV5Header(data) {
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
    parseV5Record(data, offset, header) {
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
    parseNetFlowV9(data, rinfo) {
        const header = this.parseV9Header(data);
        let offset = 20; // Header size for v9
        while (offset < data.length) {
            const flowsetId = data.readUInt16BE(offset);
            const flowsetLength = data.readUInt16BE(offset + 2);
            if (flowsetLength < 4)
                break;
            if (flowsetId === 0) {
                // Template flowset
                this.parseV9Template(data, offset + 4, flowsetLength - 4);
            }
            else if (flowsetId === 1) {
                // Options template flowset
                logger_1.logger.debug('NetFlow v9 options template received');
            }
            else if (flowsetId >= 256) {
                // Data flowset
                const records = this.parseV9Data(data, offset + 4, flowsetLength - 4, flowsetId);
                this.addToBuffer(records);
            }
            offset += flowsetLength;
        }
        logger_1.logger.trace('Processed NetFlow v9 packet', {
            source: rinfo.address,
            flowsets: header.count,
        });
    }
    /**
     * Parse NetFlow v9 header
     */
    parseV9Header(data) {
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
    parseV9Template(data, offset, length) {
        let pos = offset;
        while (pos < offset + length) {
            const templateId = data.readUInt16BE(pos);
            const fieldCount = data.readUInt16BE(pos + 2);
            pos += 4;
            const fields = [];
            for (let i = 0; i < fieldCount; i++) {
                if (pos + 4 > offset + length)
                    break;
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
            logger_1.logger.debug('NetFlow v9 template received', {
                templateId,
                fieldCount,
            });
        }
    }
    /**
     * Parse NetFlow v9 data
     */
    parseV9Data(data, offset, length, templateId) {
        const template = this.templates.get(templateId);
        if (!template) {
            logger_1.logger.debug('No template for flowset', { templateId });
            return [];
        }
        const records = [];
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
    parseV9Record(data, offset, template) {
        const record = {
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
        return record;
    }
    // ============================================================================
    // Flow Aggregation
    // ============================================================================
    /**
     * Aggregate flows by source/destination/port/protocol
     */
    aggregateFlows(flows) {
        const aggregated = new Map();
        for (const flow of flows) {
            const key = `${flow.srcAddress}:${flow.srcPort}-${flow.dstAddress}:${flow.dstPort}-${flow.protocol}`;
            if (aggregated.has(key)) {
                const existing = aggregated.get(key);
                existing.bytes += flow.bytes;
                existing.packets += flow.packets;
                if (flow.startTime < existing.startTime) {
                    existing.startTime = flow.startTime;
                }
                if (flow.endTime > existing.endTime) {
                    existing.endTime = flow.endTime;
                }
            }
            else {
                aggregated.set(key, { ...flow });
            }
        }
        return Array.from(aggregated.values());
    }
    /**
     * Add flows to buffer
     */
    addToBuffer(flows) {
        this.flowBuffer.push(...flows);
        // Limit buffer size
        if (this.flowBuffer.length > this.maxBufferSize) {
            this.flowBuffer = this.flowBuffer.slice(-this.maxBufferSize);
            logger_1.logger.warn('NetFlow buffer overflow - oldest flows dropped');
        }
    }
    // ============================================================================
    // Utility Methods
    // ============================================================================
    /**
     * Convert integer to IP address string
     */
    intToIP(num) {
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
    getProtocolName(protocol) {
        return constants_1.IP_PROTOCOLS[protocol] || `Unknown(${protocol})`;
    }
    // ============================================================================
    // Statistics
    // ============================================================================
    /**
     * Get current buffer statistics
     */
    getBufferStats() {
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
exports.NetFlowCollector = NetFlowCollector;
// ============================================================================
// Export
// ============================================================================
function createNetFlowCollector(config) {
    return new NetFlowCollector(config);
}
//# sourceMappingURL=netflow-collector.js.map
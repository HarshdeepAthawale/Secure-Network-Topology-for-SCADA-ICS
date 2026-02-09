"use strict";
/**
 * NetFlow Data Parser - Normalizes flow data for topology analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.netflowParser = exports.NetFlowParser = void 0;
const types_1 = require("../../utils/types");
const constants_1 = require("../../utils/constants");
const crypto_1 = require("../../utils/crypto");
class NetFlowParser {
    parse(telemetry) {
        const data = telemetry.data;
        if (data.type !== 'netflow' || !Array.isArray(data.flows))
            return [];
        return data.flows.map(flow => this.parseFlow(flow)).filter(Boolean);
    }
    parseFlow(flow) {
        const duration = (flow.endTime.getTime() - flow.startTime.getTime()) / 1000;
        const industrialInfo = this.detectIndustrialProtocol(flow.dstPort, flow.srcPort);
        return {
            id: (0, crypto_1.generateUUID)(),
            srcAddress: flow.srcAddress,
            dstAddress: flow.dstAddress,
            srcPort: flow.srcPort,
            dstPort: flow.dstPort,
            protocol: constants_1.IP_PROTOCOLS[flow.protocol] || `Unknown(${flow.protocol})`,
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
    detectIndustrialProtocol(dstPort, srcPort) {
        const portInfo = constants_1.INDUSTRIAL_PORTS[dstPort] || constants_1.INDUSTRIAL_PORTS[srcPort];
        return portInfo ? { isIndustrial: true, protocol: portInfo.protocol } : { isIndustrial: false };
    }
    summarize(flows) {
        const sources = new Set();
        const destinations = new Set();
        const bySource = new Map();
        const byProtocol = new Map();
        let totalBytes = 0, totalPackets = 0, industrialFlows = 0;
        for (const flow of flows) {
            sources.add(flow.srcAddress);
            destinations.add(flow.dstAddress);
            totalBytes += flow.bytes;
            totalPackets += flow.packets;
            if (flow.isIndustrial)
                industrialFlows++;
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
    toConnection(flow, sourceDeviceId, targetDeviceId) {
        const now = new Date();
        return {
            id: (0, crypto_1.generateUUID)(),
            sourceDeviceId,
            targetDeviceId,
            connectionType: types_1.ConnectionType.ETHERNET,
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
exports.NetFlowParser = NetFlowParser;
exports.netflowParser = new NetFlowParser();
//# sourceMappingURL=netflow-parser.js.map
"use strict";
/**
 * ARP/MAC Parser - Layer 2 topology analysis
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.arpParser = exports.ARPParser = void 0;
const constants_1 = require("../../utils/constants");
const crypto_1 = require("../../utils/crypto");
class ARPParser {
    parse(telemetry) {
        const data = telemetry.data;
        return {
            arpEntries: data.type === 'arp' ? this.parseARPEntries(data.entries) : [],
            macEntries: data.type === 'mac' ? this.parseMACEntries(data.entries) : [],
        };
    }
    parseARPEntries(entries) {
        return entries.filter(e => e.ipAddress && e.macAddress).map(entry => ({
            ...entry,
            macAddress: this.normalizeMac(entry.macAddress),
        }));
    }
    parseMACEntries(entries) {
        return entries.filter(e => e.macAddress).map(entry => ({
            ...entry,
            macAddress: this.normalizeMac(entry.macAddress),
        }));
    }
    buildL2Topology(arpEntries, macEntries) {
        const deviceMap = new Map();
        const now = new Date();
        for (const entry of arpEntries) {
            const mac = entry.macAddress;
            const existing = deviceMap.get(mac);
            if (existing) {
                if (!existing.ipAddresses.includes(entry.ipAddress))
                    existing.ipAddresses.push(entry.ipAddress);
                if (entry.vlanId && !existing.vlanIds.includes(entry.vlanId))
                    existing.vlanIds.push(entry.vlanId);
                existing.lastSeen = now;
            }
            else {
                deviceMap.set(mac, {
                    id: (0, crypto_1.generateUUID)(),
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
                if (!existing.vlanIds.includes(entry.vlanId))
                    existing.vlanIds.push(entry.vlanId);
                if (!existing.ports.includes(entry.port))
                    existing.ports.push(entry.port);
                existing.lastSeen = now;
            }
            else {
                deviceMap.set(mac, {
                    id: (0, crypto_1.generateUUID)(),
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
    inferConnections(macEntries) {
        const connections = [];
        const byPort = new Map();
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
    getVendorFromMac(mac) {
        const normalized = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
        const oui = `${normalized.slice(0, 2)}:${normalized.slice(2, 4)}:${normalized.slice(4, 6)}`;
        return constants_1.VENDOR_OUI_PREFIXES[oui];
    }
    toNetworkInterface(device) {
        return {
            name: 'eth0',
            macAddress: device.macAddress,
            ipAddress: device.ipAddresses[0],
            vlanId: device.vlanIds[0],
            status: 'up',
        };
    }
    normalizeMac(mac) {
        return mac.toLowerCase().replace(/[^a-f0-9]/g, '').replace(/(.{2})/g, '$1:').slice(0, -1);
    }
}
exports.ARPParser = ARPParser;
exports.arpParser = new ARPParser();
//# sourceMappingURL=arp-parser.js.map
"use strict";
/**
 * SNMP Data Parser - Normalizes SNMP telemetry data
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.snmpParser = exports.SNMPParser = void 0;
const types_1 = require("../../utils/types");
const constants_1 = require("../../utils/constants");
const crypto_1 = require("../../utils/crypto");
class SNMPParser {
    parse(telemetry) {
        if (!telemetry.data || typeof telemetry.data !== 'object') {
            return null;
        }
        const data = telemetry.data;
        if (data.type === 'system') {
            return this.parseSystemData(data);
        }
        return null;
    }
    parseSystemData(data) {
        const sysDescr = String(data.sysDescr || '');
        const sysName = String(data.sysName || 'unknown');
        return {
            id: (0, crypto_1.generateUUID)(),
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
    detectVendor(sysDescr) {
        const lower = sysDescr.toLowerCase();
        const vendors = {
            'cisco': 'Cisco', 'siemens': 'Siemens', 'schneider': 'Schneider Electric',
            'rockwell': 'Rockwell Automation', 'allen-bradley': 'Rockwell Automation',
            'honeywell': 'Honeywell', 'abb': 'ABB', 'emerson': 'Emerson',
            'ge': 'General Electric', 'yokogawa': 'Yokogawa', 'mitsubishi': 'Mitsubishi',
            'omron': 'Omron', 'beckhoff': 'Beckhoff', 'phoenix': 'Phoenix Contact',
            'moxa': 'Moxa', 'hirschmann': 'Hirschmann', 'juniper': 'Juniper',
            'hp': 'Hewlett-Packard', 'dell': 'Dell', 'linux': 'Linux',
        };
        for (const [key, vendor] of Object.entries(vendors)) {
            if (lower.includes(key))
                return vendor;
        }
        return undefined;
    }
    extractModel(sysDescr) {
        const patterns = [
            /model[:\s]+([A-Z0-9-]+)/i,
            /([A-Z]{2,}[0-9]{2,}[A-Z0-9-]*)/,
            /S7-(\d+)/i,
        ];
        for (const pattern of patterns) {
            const match = sysDescr.match(pattern);
            if (match)
                return match[1];
        }
        return undefined;
    }
    detectDeviceType(sysDescr, sysName) {
        const combined = `${sysDescr} ${sysName}`.toLowerCase();
        const typePatterns = [
            [/\b(plc|programmable.?logic.?controller|s7-[0-9]+|controllogix)\b/i, types_1.DeviceType.PLC],
            [/\b(rtu|remote.?terminal.?unit)\b/i, types_1.DeviceType.RTU],
            [/\b(dcs|distributed.?control)\b/i, types_1.DeviceType.DCS],
            [/\b(scada|supervisory)\b/i, types_1.DeviceType.SCADA_SERVER],
            [/\b(hmi|human.?machine|panel)\b/i, types_1.DeviceType.HMI],
            [/\b(historian|pi.?server)\b/i, types_1.DeviceType.HISTORIAN],
            [/\b(switch|catalyst|nexus)\b/i, types_1.DeviceType.SWITCH],
            [/\b(router|isr|asr)\b/i, types_1.DeviceType.ROUTER],
            [/\b(firewall|asa|fortigate|pfsense)\b/i, types_1.DeviceType.FIREWALL],
            [/\b(sensor|transmitter|detector)\b/i, types_1.DeviceType.SENSOR],
            [/\b(actuator|valve|motor)\b/i, types_1.DeviceType.ACTUATOR],
            [/\b(drive|vfd|inverter)\b/i, types_1.DeviceType.DRIVE],
        ];
        for (const [pattern, type] of typePatterns) {
            if (pattern.test(combined))
                return type;
        }
        return types_1.DeviceType.UNKNOWN;
    }
    parseInterfaces(data) {
        const interfaces = [];
        const rawInterfaces = data.interfaces;
        if (!rawInterfaces)
            return interfaces;
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
    getVendorFromMac(mac) {
        const normalized = mac.toUpperCase().replace(/[^A-F0-9]/g, '');
        const oui = `${normalized.slice(0, 2)}:${normalized.slice(2, 4)}:${normalized.slice(4, 6)}`;
        return constants_1.VENDOR_OUI_PREFIXES[oui];
    }
    toDevice(parsed) {
        const purdueLevel = constants_1.DEVICE_TYPE_PURDUE_LEVEL[parsed.deviceType] || types_1.PurdueLevel.LEVEL_5;
        const securityZone = constants_1.PURDUE_TO_ZONE[purdueLevel];
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
            status: types_1.DeviceStatus.ONLINE,
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
    normalizeMac(mac) {
        return mac.toLowerCase().replace(/[^a-f0-9]/g, '').replace(/(.{2})/g, '$1:').slice(0, -1);
    }
}
exports.SNMPParser = SNMPParser;
exports.snmpParser = new SNMPParser();
//# sourceMappingURL=snmp-parser.js.map
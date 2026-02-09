"use strict";
/**
 * Purdue Model Classifier - Assigns devices to Purdue levels
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.purdueClassifier = exports.PurdueClassifier = void 0;
const types_1 = require("../../utils/types");
const constants_1 = require("../../utils/constants");
class PurdueClassifier {
    levelPatterns = new Map([
        [types_1.PurdueLevel.LEVEL_0, [/sensor/i, /actuator/i, /transmitter/i, /valve/i, /motor/i, /drive/i, /vfd/i]],
        [types_1.PurdueLevel.LEVEL_1, [/plc/i, /rtu/i, /dcs/i, /controller/i, /s7-\d+/i, /controllogix/i, /modicon/i]],
        [types_1.PurdueLevel.LEVEL_2, [/scada/i, /hmi/i, /wonderware/i, /ignition/i, /factorytalk/i, /wincc/i]],
        [types_1.PurdueLevel.LEVEL_3, [/historian/i, /mes/i, /pi\s*server/i, /aspen/i, /osisoft/i]],
        [types_1.PurdueLevel.LEVEL_4, [/erp/i, /sap/i, /oracle/i, /business/i]],
        [types_1.PurdueLevel.LEVEL_5, [/corporate/i, /internet/i, /email/i, /web/i, /office/i]],
        [types_1.PurdueLevel.DMZ, [/dmz/i, /firewall/i, /proxy/i, /diode/i, /jump/i, /bastion/i]],
    ]);
    industrialSubnets = new Map([
        ['10.0.0.0/8', types_1.PurdueLevel.LEVEL_1],
        ['172.16.0.0/12', types_1.PurdueLevel.LEVEL_2],
        ['192.168.0.0/16', types_1.PurdueLevel.LEVEL_3],
    ]);
    classify(device) {
        const reasons = [];
        const levelScores = new Map();
        // Initialize scores
        for (const level of Object.values(types_1.PurdueLevel).filter(v => typeof v === 'number')) {
            levelScores.set(level, 0);
        }
        // Score by device type
        if (device.type !== types_1.DeviceType.UNKNOWN) {
            const typeLevel = constants_1.DEVICE_TYPE_PURDUE_LEVEL[device.type];
            levelScores.set(typeLevel, (levelScores.get(typeLevel) || 0) + 40);
            reasons.push(`Device type ${device.type} maps to Level ${typeLevel}`);
        }
        // Score by name/hostname patterns
        const nameScore = this.scoreByPatterns(device.name + ' ' + (device.hostname || ''));
        for (const [level, score] of nameScore) {
            levelScores.set(level, (levelScores.get(level) || 0) + score);
            if (score > 0)
                reasons.push(`Name pattern matches Level ${level}`);
        }
        // Score by vendor
        const vendorLevel = this.classifyByVendor(device.vendor);
        if (vendorLevel !== null) {
            levelScores.set(vendorLevel, (levelScores.get(vendorLevel) || 0) + 20);
            reasons.push(`Vendor ${device.vendor} associated with Level ${vendorLevel}`);
        }
        // Score by protocols/ports on interfaces
        for (const iface of device.interfaces) {
            const portLevel = this.classifyBySubnet(iface.ipAddress);
            if (portLevel !== null) {
                levelScores.set(portLevel, (levelScores.get(portLevel) || 0) + 15);
                reasons.push(`Subnet suggests Level ${portLevel}`);
            }
        }
        // Find best level
        let bestLevel = device.purdueLevel;
        let bestScore = 0;
        for (const [level, score] of levelScores) {
            if (score > bestScore) {
                bestScore = score;
                bestLevel = level;
            }
        }
        // Calculate confidence
        const totalScore = Array.from(levelScores.values()).reduce((a, b) => a + b, 0);
        const confidence = totalScore > 0 ? (bestScore / totalScore) * 100 : 50;
        // Build suggested levels
        const suggestedLevels = Array.from(levelScores.entries())
            .filter(([_, score]) => score > 0)
            .map(([level, score]) => ({
            level,
            probability: totalScore > 0 ? (score / totalScore) * 100 : 0,
        }))
            .sort((a, b) => b.probability - a.probability);
        return {
            deviceId: device.id,
            assignedLevel: bestLevel,
            assignedZone: constants_1.PURDUE_TO_ZONE[bestLevel],
            confidence,
            reasons,
            suggestedLevels,
        };
    }
    scoreByPatterns(text) {
        const scores = new Map();
        for (const [level, patterns] of this.levelPatterns) {
            for (const pattern of patterns) {
                if (pattern.test(text)) {
                    scores.set(level, (scores.get(level) || 0) + 25);
                }
            }
        }
        return scores;
    }
    classifyByVendor(vendor) {
        if (!vendor)
            return null;
        const lower = vendor.toLowerCase();
        const vendorLevels = [
            [/siemens|allen-bradley|rockwell|schneider|abb|emerson|yokogawa|honeywell/i, types_1.PurdueLevel.LEVEL_1],
            [/wonderware|aveva|ge|iconics/i, types_1.PurdueLevel.LEVEL_2],
            [/osisoft|aspentech/i, types_1.PurdueLevel.LEVEL_3],
            [/cisco|juniper|fortinet|palo alto/i, types_1.PurdueLevel.DMZ],
        ];
        for (const [pattern, level] of vendorLevels) {
            if (pattern.test(lower))
                return level;
        }
        return null;
    }
    classifyBySubnet(ip) {
        if (!ip)
            return null;
        const octets = ip.split('.').map(Number);
        if (octets.length !== 4)
            return null;
        // Simple heuristic based on common OT network designs
        if (octets[0] === 10) {
            if (octets[1] === 0)
                return types_1.PurdueLevel.LEVEL_0;
            if (octets[1] === 1)
                return types_1.PurdueLevel.LEVEL_1;
            if (octets[1] === 2)
                return types_1.PurdueLevel.LEVEL_2;
            if (octets[1] === 3)
                return types_1.PurdueLevel.LEVEL_3;
        }
        return null;
    }
    classifyBatch(devices) {
        return devices.map(device => this.classify(device));
    }
    reclassify(device, criteria) {
        // Apply additional criteria for reclassification
        const baseResult = this.classify(device);
        if (criteria.connectedToLevels && criteria.connectedToLevels.length > 0) {
            // Devices typically connect to adjacent levels
            const avgLevel = criteria.connectedToLevels.reduce((a, b) => a + b, 0) / criteria.connectedToLevels.length;
            const suggestedLevel = Math.round(avgLevel);
            baseResult.suggestedLevels.unshift({
                level: suggestedLevel,
                probability: 30,
            });
            baseResult.reasons.push(`Connected to devices at levels: ${criteria.connectedToLevels.join(', ')}`);
        }
        return baseResult;
    }
}
exports.PurdueClassifier = PurdueClassifier;
exports.purdueClassifier = new PurdueClassifier();
//# sourceMappingURL=purdue-classifier.js.map
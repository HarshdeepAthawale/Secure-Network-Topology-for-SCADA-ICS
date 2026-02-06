/**
 * Purdue Model Classifier - Assigns devices to Purdue levels
 */

import { Device, DeviceType, PurdueLevel, SecurityZone, NetworkInterface } from '../../utils/types';
import { DEVICE_TYPE_PURDUE_LEVEL, PURDUE_TO_ZONE, INDUSTRIAL_PORTS } from '../../utils/constants';
import { logger } from '../../utils/logger';

export interface ClassificationResult {
  deviceId: string;
  assignedLevel: PurdueLevel;
  assignedZone: SecurityZone;
  confidence: number;
  reasons: string[];
  suggestedLevels: Array<{ level: PurdueLevel; probability: number }>;
}

export interface ClassificationCriteria {
  deviceType?: DeviceType;
  vendor?: string;
  protocols?: string[];
  ports?: number[];
  connectedToLevels?: PurdueLevel[];
  subnet?: string;
  keywords?: string[];
}

export class PurdueClassifier {
  private readonly levelPatterns: Map<PurdueLevel, RegExp[]> = new Map([
    [PurdueLevel.LEVEL_0, [/sensor/i, /actuator/i, /transmitter/i, /valve/i, /motor/i, /drive/i, /vfd/i]],
    [PurdueLevel.LEVEL_1, [/plc/i, /rtu/i, /dcs/i, /controller/i, /s7-\d+/i, /controllogix/i, /modicon/i]],
    [PurdueLevel.LEVEL_2, [/scada/i, /hmi/i, /wonderware/i, /ignition/i, /factorytalk/i, /wincc/i]],
    [PurdueLevel.LEVEL_3, [/historian/i, /mes/i, /pi\s*server/i, /aspen/i, /osisoft/i]],
    [PurdueLevel.LEVEL_4, [/erp/i, /sap/i, /oracle/i, /business/i]],
    [PurdueLevel.LEVEL_5, [/corporate/i, /internet/i, /email/i, /web/i, /office/i]],
    [PurdueLevel.DMZ, [/dmz/i, /firewall/i, /proxy/i, /diode/i, /jump/i, /bastion/i]],
  ]);

  private readonly industrialSubnets: Map<string, PurdueLevel> = new Map([
    ['10.0.0.0/8', PurdueLevel.LEVEL_1],
    ['172.16.0.0/12', PurdueLevel.LEVEL_2],
    ['192.168.0.0/16', PurdueLevel.LEVEL_3],
  ]);

  classify(device: Device): ClassificationResult {
    const reasons: string[] = [];
    const levelScores = new Map<PurdueLevel, number>();

    // Initialize scores
    for (const level of Object.values(PurdueLevel).filter(v => typeof v === 'number') as PurdueLevel[]) {
      levelScores.set(level, 0);
    }

    // Score by device type
    if (device.type !== DeviceType.UNKNOWN) {
      const typeLevel = DEVICE_TYPE_PURDUE_LEVEL[device.type];
      levelScores.set(typeLevel, (levelScores.get(typeLevel) || 0) + 40);
      reasons.push(`Device type ${device.type} maps to Level ${typeLevel}`);
    }

    // Score by name/hostname patterns
    const nameScore = this.scoreByPatterns(device.name + ' ' + (device.hostname || ''));
    for (const [level, score] of nameScore) {
      levelScores.set(level, (levelScores.get(level) || 0) + score);
      if (score > 0) reasons.push(`Name pattern matches Level ${level}`);
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
      assignedZone: PURDUE_TO_ZONE[bestLevel],
      confidence,
      reasons,
      suggestedLevels,
    };
  }

  private scoreByPatterns(text: string): Map<PurdueLevel, number> {
    const scores = new Map<PurdueLevel, number>();

    for (const [level, patterns] of this.levelPatterns) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          scores.set(level, (scores.get(level) || 0) + 25);
        }
      }
    }

    return scores;
  }

  private classifyByVendor(vendor?: string): PurdueLevel | null {
    if (!vendor) return null;

    const lower = vendor.toLowerCase();
    const vendorLevels: Array<[RegExp, PurdueLevel]> = [
      [/siemens|allen-bradley|rockwell|schneider|abb|emerson|yokogawa|honeywell/i, PurdueLevel.LEVEL_1],
      [/wonderware|aveva|ge|iconics/i, PurdueLevel.LEVEL_2],
      [/osisoft|aspentech/i, PurdueLevel.LEVEL_3],
      [/cisco|juniper|fortinet|palo alto/i, PurdueLevel.DMZ],
    ];

    for (const [pattern, level] of vendorLevels) {
      if (pattern.test(lower)) return level;
    }

    return null;
  }

  private classifyBySubnet(ip?: string): PurdueLevel | null {
    if (!ip) return null;

    const octets = ip.split('.').map(Number);
    if (octets.length !== 4) return null;

    // Simple heuristic based on common OT network designs
    if (octets[0] === 10) {
      if (octets[1] === 0) return PurdueLevel.LEVEL_0;
      if (octets[1] === 1) return PurdueLevel.LEVEL_1;
      if (octets[1] === 2) return PurdueLevel.LEVEL_2;
      if (octets[1] === 3) return PurdueLevel.LEVEL_3;
    }

    return null;
  }

  classifyBatch(devices: Device[]): ClassificationResult[] {
    return devices.map(device => this.classify(device));
  }

  reclassify(device: Device, criteria: ClassificationCriteria): ClassificationResult {
    // Apply additional criteria for reclassification
    const baseResult = this.classify(device);

    if (criteria.connectedToLevels && criteria.connectedToLevels.length > 0) {
      // Devices typically connect to adjacent levels
      const avgLevel = criteria.connectedToLevels.reduce((a, b) => a + b, 0) / criteria.connectedToLevels.length;
      const suggestedLevel = Math.round(avgLevel) as PurdueLevel;

      baseResult.suggestedLevels.unshift({
        level: suggestedLevel,
        probability: 30,
      });
      baseResult.reasons.push(`Connected to devices at levels: ${criteria.connectedToLevels.join(', ')}`);
    }

    return baseResult;
  }
}

export const purdueClassifier = new PurdueClassifier();

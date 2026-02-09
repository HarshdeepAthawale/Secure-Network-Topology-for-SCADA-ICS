/**
 * Purdue Model Classifier - Assigns devices to Purdue levels
 */
import { Device, DeviceType, PurdueLevel, SecurityZone } from '../../utils/types';
export interface ClassificationResult {
    deviceId: string;
    assignedLevel: PurdueLevel;
    assignedZone: SecurityZone;
    confidence: number;
    reasons: string[];
    suggestedLevels: Array<{
        level: PurdueLevel;
        probability: number;
    }>;
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
export declare class PurdueClassifier {
    private readonly levelPatterns;
    private readonly industrialSubnets;
    classify(device: Device): ClassificationResult;
    private scoreByPatterns;
    private classifyByVendor;
    private classifyBySubnet;
    classifyBatch(devices: Device[]): ClassificationResult[];
    reclassify(device: Device, criteria: ClassificationCriteria): ClassificationResult;
}
export declare const purdueClassifier: PurdueClassifier;
//# sourceMappingURL=purdue-classifier.d.ts.map
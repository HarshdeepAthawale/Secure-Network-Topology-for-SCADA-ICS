/**
 * Device Correlator - Correlates device identity across telemetry sources
 */
import { Device, DeviceType, NetworkInterface } from '../../utils/types';
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
}
export interface CorrelationResult {
    device: Device;
    sources: string[];
    confidence: number;
    correlatedBy: string[];
}
export declare class DeviceCorrelator {
    private knownDevices;
    private macToDeviceId;
    private ipToDeviceId;
    private hostnameToDeviceId;
    correlate(candidates: DeviceCandidate[]): CorrelationResult[];
    private candidatesMatch;
    private mergeAndCorrelate;
    private mergeCandidates;
    private createDevice;
    private updateDevice;
    private indexDevice;
    private calculateConfidence;
    findDevice(criteria: {
        mac?: string;
        ip?: string;
        hostname?: string;
    }): Device | undefined;
    getAllDevices(): Device[];
    private normalizeMac;
}
export declare const deviceCorrelator: DeviceCorrelator;
//# sourceMappingURL=device-correlator.d.ts.map
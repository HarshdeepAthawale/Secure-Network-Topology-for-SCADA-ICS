/**
 * Application constants for SCADA Topology Discovery
 */
import { PurdueLevel, SecurityZone, DeviceType } from './types';
export declare const APP_NAME = "scada-topology-discovery";
export declare const APP_VERSION = "1.0.0";
export declare const PURDUE_LEVEL_DESCRIPTIONS: Record<PurdueLevel, string>;
export declare const PURDUE_LEVEL_NAMES: Record<PurdueLevel, string>;
export declare const PURDUE_TO_ZONE: Record<PurdueLevel, SecurityZone>;
export declare const ZONE_TRUST_LEVELS: Record<SecurityZone, number>;
export declare const DEVICE_TYPE_PURDUE_LEVEL: Record<DeviceType, PurdueLevel>;
export declare const SNMP_OIDS: {
    sysDescr: string;
    sysObjectID: string;
    sysUpTime: string;
    sysContact: string;
    sysName: string;
    sysLocation: string;
    sysServices: string;
    ifNumber: string;
    ifTable: string;
    ifIndex: string;
    ifDescr: string;
    ifType: string;
    ifMtu: string;
    ifSpeed: string;
    ifPhysAddress: string;
    ifAdminStatus: string;
    ifOperStatus: string;
    ifInOctets: string;
    ifOutOctets: string;
    ipAddrTable: string;
    ipNetToMediaTable: string;
    dot1dTpFdbTable: string;
    lldpRemTable: string;
    lldpRemChassisId: string;
    lldpRemPortId: string;
    lldpRemSysName: string;
    entPhysicalTable: string;
    entPhysicalDescr: string;
    entPhysicalSerialNum: string;
    entPhysicalMfgName: string;
    entPhysicalModelName: string;
};
export declare const SYSLOG_FACILITIES: Record<number, string>;
export declare const SYSLOG_SEVERITIES: Record<number, string>;
export declare const IP_PROTOCOLS: Record<number, string>;
export declare const INDUSTRIAL_PORTS: Record<number, {
    protocol: string;
    description: string;
}>;
export declare const RISK_THRESHOLDS: {
    CRITICAL: number;
    HIGH: number;
    MEDIUM: number;
    LOW: number;
};
export declare const RISK_WEIGHTS: {
    vulnerability: number;
    configuration: number;
    exposure: number;
    compliance: number;
};
export declare const TIMEOUTS: {
    SNMP_DEFAULT: number;
    SNMP_BULK: number;
    MQTT_CONNECT: number;
    MQTT_PUBLISH: number;
    DATABASE_QUERY: number;
    HTTP_REQUEST: number;
};
export declare const INTERVALS: {
    COLLECTOR_POLL: number;
    TOPOLOGY_SNAPSHOT: number;
    HEALTH_CHECK: number;
    METRICS_REPORT: number;
    RISK_ASSESSMENT: number;
};
export declare const BATCH_SIZES: {
    SNMP_WALK: number;
    DATABASE_INSERT: number;
    MQTT_PUBLISH: number;
    ALERT_PROCESS: number;
};
export declare const VENDOR_OUI_PREFIXES: Record<string, string>;
export declare const COMPLIANCE_STANDARDS: {
    NERC_CIP: {
        name: string;
        fullName: string;
        relevantControls: string[];
    };
    IEC_62443: {
        name: string;
        fullName: string;
        relevantControls: string[];
    };
    NIST_CSF: {
        name: string;
        fullName: string;
        relevantControls: string[];
    };
};
//# sourceMappingURL=constants.d.ts.map
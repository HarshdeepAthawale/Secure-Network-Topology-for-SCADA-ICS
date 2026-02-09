"use strict";
/**
 * Core TypeScript types and interfaces for SCADA Topology Discovery
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AlertType = exports.AlertSeverity = exports.TelemetrySource = exports.ConnectionType = exports.DeviceStatus = exports.DeviceType = exports.SecurityZone = exports.PurdueLevel = void 0;
// ============================================================================
// Purdue Model Types
// ============================================================================
var PurdueLevel;
(function (PurdueLevel) {
    PurdueLevel[PurdueLevel["LEVEL_0"] = 0] = "LEVEL_0";
    PurdueLevel[PurdueLevel["LEVEL_1"] = 1] = "LEVEL_1";
    PurdueLevel[PurdueLevel["LEVEL_2"] = 2] = "LEVEL_2";
    PurdueLevel[PurdueLevel["LEVEL_3"] = 3] = "LEVEL_3";
    PurdueLevel[PurdueLevel["LEVEL_4"] = 4] = "LEVEL_4";
    PurdueLevel[PurdueLevel["LEVEL_5"] = 5] = "LEVEL_5";
    PurdueLevel[PurdueLevel["DMZ"] = 99] = "DMZ";
})(PurdueLevel || (exports.PurdueLevel = PurdueLevel = {}));
var SecurityZone;
(function (SecurityZone) {
    SecurityZone["PROCESS"] = "process";
    SecurityZone["CONTROL"] = "control";
    SecurityZone["SUPERVISORY"] = "supervisory";
    SecurityZone["OPERATIONS"] = "operations";
    SecurityZone["ENTERPRISE"] = "enterprise";
    SecurityZone["DMZ"] = "dmz";
    SecurityZone["UNTRUSTED"] = "untrusted";
})(SecurityZone || (exports.SecurityZone = SecurityZone = {}));
// ============================================================================
// Device Types
// ============================================================================
var DeviceType;
(function (DeviceType) {
    // Level 0 - Field Devices
    DeviceType["SENSOR"] = "sensor";
    DeviceType["ACTUATOR"] = "actuator";
    DeviceType["DRIVE"] = "variable_drive";
    DeviceType["INSTRUMENT"] = "instrument";
    // Level 1 - Control Devices
    DeviceType["PLC"] = "plc";
    DeviceType["RTU"] = "rtu";
    DeviceType["DCS"] = "dcs";
    DeviceType["CONTROLLER"] = "controller";
    // Level 2 - Supervisory
    DeviceType["SCADA_SERVER"] = "scada_server";
    DeviceType["HMI"] = "hmi";
    DeviceType["ALARM_SERVER"] = "alarm_server";
    DeviceType["DATA_LOGGER"] = "data_logger";
    // Level 3 - Operations
    DeviceType["MES"] = "mes";
    DeviceType["HISTORIAN"] = "historian";
    DeviceType["ENGINEERING_WORKSTATION"] = "engineering_workstation";
    DeviceType["ASSET_MANAGEMENT"] = "asset_management";
    // Level 4/5 - Enterprise
    DeviceType["ERP"] = "erp";
    DeviceType["EMAIL_SERVER"] = "email_server";
    DeviceType["WEB_SERVER"] = "web_server";
    DeviceType["DATABASE_SERVER"] = "database_server";
    // Network Infrastructure
    DeviceType["SWITCH"] = "switch";
    DeviceType["ROUTER"] = "router";
    DeviceType["FIREWALL"] = "firewall";
    DeviceType["GATEWAY"] = "gateway";
    DeviceType["DATA_DIODE"] = "data_diode";
    DeviceType["JUMP_SERVER"] = "jump_server";
    // Unknown
    DeviceType["UNKNOWN"] = "unknown";
})(DeviceType || (exports.DeviceType = DeviceType = {}));
var DeviceStatus;
(function (DeviceStatus) {
    DeviceStatus["ONLINE"] = "online";
    DeviceStatus["OFFLINE"] = "offline";
    DeviceStatus["DEGRADED"] = "degraded";
    DeviceStatus["MAINTENANCE"] = "maintenance";
    DeviceStatus["UNKNOWN"] = "unknown";
})(DeviceStatus || (exports.DeviceStatus = DeviceStatus = {}));
var ConnectionType;
(function (ConnectionType) {
    ConnectionType["ETHERNET"] = "ethernet";
    ConnectionType["SERIAL"] = "serial";
    ConnectionType["MODBUS"] = "modbus";
    ConnectionType["PROFINET"] = "profinet";
    ConnectionType["PROFIBUS"] = "profibus";
    ConnectionType["FIELDBUS"] = "fieldbus";
    ConnectionType["WIRELESS"] = "wireless";
    ConnectionType["FIBER"] = "fiber";
    ConnectionType["UNKNOWN"] = "unknown";
})(ConnectionType || (exports.ConnectionType = ConnectionType = {}));
// ============================================================================
// Telemetry Types
// ============================================================================
var TelemetrySource;
(function (TelemetrySource) {
    TelemetrySource["SNMP"] = "snmp";
    TelemetrySource["ARP"] = "arp";
    TelemetrySource["MAC_TABLE"] = "mac_table";
    TelemetrySource["NETFLOW"] = "netflow";
    TelemetrySource["SYSLOG"] = "syslog";
    TelemetrySource["ROUTING"] = "routing";
    TelemetrySource["OPCUA"] = "opcua";
    TelemetrySource["MODBUS"] = "modbus";
    TelemetrySource["MANUAL"] = "manual";
})(TelemetrySource || (exports.TelemetrySource = TelemetrySource = {}));
// ============================================================================
// Alert Types
// ============================================================================
var AlertSeverity;
(function (AlertSeverity) {
    AlertSeverity["CRITICAL"] = "critical";
    AlertSeverity["HIGH"] = "high";
    AlertSeverity["MEDIUM"] = "medium";
    AlertSeverity["LOW"] = "low";
    AlertSeverity["INFO"] = "info";
})(AlertSeverity || (exports.AlertSeverity = AlertSeverity = {}));
var AlertType;
(function (AlertType) {
    AlertType["SECURITY"] = "security";
    AlertType["CONNECTIVITY"] = "connectivity";
    AlertType["COMPLIANCE"] = "compliance";
    AlertType["PERFORMANCE"] = "performance";
    AlertType["CONFIGURATION"] = "configuration";
    // Additional specific alert types
    AlertType["DEVICE_OFFLINE"] = "device_offline";
    AlertType["SECURITY_VIOLATION"] = "security_violation";
    AlertType["INSECURE_PROTOCOL"] = "insecure_protocol";
    AlertType["NEW_DEVICE"] = "new_device";
    AlertType["CONFIGURATION_CHANGE"] = "configuration_change";
    AlertType["CROSS_ZONE_CONNECTION"] = "cross_zone_connection";
    AlertType["FIRMWARE_OUTDATED"] = "firmware_outdated";
})(AlertType || (exports.AlertType = AlertType = {}));
//# sourceMappingURL=types.js.map
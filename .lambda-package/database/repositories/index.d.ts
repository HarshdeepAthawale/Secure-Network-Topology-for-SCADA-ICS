/**
 * Database Repositories - Central export
 */
export { BaseRepository, FindOptions, PaginatedResult } from './base.repository';
export { DeviceRepository, CreateDeviceDTO, UpdateDeviceDTO, DeviceSearchCriteria, getDeviceRepository, } from './device.repository';
export { ConnectionRepository, CreateConnectionDTO, UpdateConnectionDTO, ConnectionSearchCriteria, getConnectionRepository, } from './connection.repository';
export { AlertRepository, CreateAlertDTO, UpdateAlertDTO, AlertSearchCriteria, getAlertRepository, } from './alert.repository';
export { TelemetryRepository, CreateTelemetryDTO, TelemetrySearchCriteria, getTelemetryRepository, } from './telemetry.repository';
export { TopologySnapshotRepository, CreateTopologySnapshotDTO, getTopologySnapshotRepository, } from './topology-snapshot.repository';
//# sourceMappingURL=index.d.ts.map
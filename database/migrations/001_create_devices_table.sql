-- Migration: 001_create_devices_table
-- Description: Create devices table for asset inventory

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TYPE device_type AS ENUM (
  'sensor', 'actuator', 'variable_drive', 'instrument',
  'plc', 'rtu', 'dcs', 'controller',
  'scada_server', 'hmi', 'alarm_server', 'data_logger',
  'mes', 'historian', 'engineering_workstation', 'asset_management',
  'erp', 'email_server', 'web_server', 'database_server',
  'switch', 'router', 'firewall', 'gateway', 'data_diode', 'jump_server',
  'unknown'
);

CREATE TYPE device_status AS ENUM ('online', 'offline', 'degraded', 'maintenance', 'unknown');
CREATE TYPE purdue_level AS ENUM ('0', '1', '2', '3', '4', '5', '99');
CREATE TYPE security_zone AS ENUM ('process', 'control', 'supervisory', 'operations', 'enterprise', 'dmz', 'untrusted');

CREATE TABLE devices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  hostname VARCHAR(255),
  type device_type NOT NULL DEFAULT 'unknown',
  vendor VARCHAR(100),
  model VARCHAR(100),
  firmware_version VARCHAR(50),
  serial_number VARCHAR(100),
  purdue_level purdue_level NOT NULL,
  security_zone security_zone NOT NULL,
  status device_status NOT NULL DEFAULT 'unknown',
  location JSONB,
  metadata JSONB DEFAULT '{}',
  discovered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_devices_type ON devices(type);
CREATE INDEX idx_devices_purdue_level ON devices(purdue_level);
CREATE INDEX idx_devices_security_zone ON devices(security_zone);
CREATE INDEX idx_devices_status ON devices(status);
CREATE INDEX idx_devices_vendor ON devices(vendor);
CREATE INDEX idx_devices_last_seen ON devices(last_seen_at);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER devices_updated_at
  BEFORE UPDATE ON devices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

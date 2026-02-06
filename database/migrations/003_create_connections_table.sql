-- Migration: 003_create_connections_table
-- Description: Create connections table for network topology

CREATE TYPE connection_type AS ENUM (
  'ethernet', 'serial', 'modbus', 'profinet', 'profibus',
  'fieldbus', 'wireless', 'fiber', 'unknown'
);

CREATE TABLE connections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  target_device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  source_interface VARCHAR(100),
  target_interface VARCHAR(100),
  connection_type connection_type NOT NULL DEFAULT 'ethernet',
  protocol VARCHAR(50),
  port INTEGER CHECK (port >= 1 AND port <= 65535),
  vlan_id INTEGER CHECK (vlan_id >= 1 AND vlan_id <= 4094),
  bandwidth_mbps DECIMAL(10, 2),
  latency_ms DECIMAL(10, 3),
  is_secure BOOLEAN NOT NULL DEFAULT false,
  encryption_type VARCHAR(50),
  discovered_at TIMESTAMP WITH TIME ZONE NOT NULL,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT different_devices CHECK (source_device_id != target_device_id)
);

CREATE INDEX idx_connections_source ON connections(source_device_id);
CREATE INDEX idx_connections_target ON connections(target_device_id);
CREATE INDEX idx_connections_protocol ON connections(protocol);
CREATE INDEX idx_connections_is_secure ON connections(is_secure);
CREATE INDEX idx_connections_last_seen ON connections(last_seen_at);

CREATE TRIGGER connections_updated_at
  BEFORE UPDATE ON connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

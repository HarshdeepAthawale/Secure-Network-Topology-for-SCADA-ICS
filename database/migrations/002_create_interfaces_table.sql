-- Migration: 002_create_interfaces_table
-- Description: Create network interfaces table

CREATE TABLE network_interfaces (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  mac_address VARCHAR(17),
  ip_address INET,
  subnet_mask INET,
  gateway INET,
  vlan_id INTEGER CHECK (vlan_id >= 1 AND vlan_id <= 4094),
  speed_mbps INTEGER,
  duplex VARCHAR(10) CHECK (duplex IN ('full', 'half', 'auto')),
  status VARCHAR(10) NOT NULL CHECK (status IN ('up', 'down', 'unknown')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(device_id, mac_address)
);

CREATE INDEX idx_interfaces_device_id ON network_interfaces(device_id);
CREATE INDEX idx_interfaces_mac_address ON network_interfaces(mac_address);
CREATE INDEX idx_interfaces_ip_address ON network_interfaces(ip_address);
CREATE INDEX idx_interfaces_vlan_id ON network_interfaces(vlan_id);

CREATE TRIGGER interfaces_updated_at
  BEFORE UPDATE ON network_interfaces
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

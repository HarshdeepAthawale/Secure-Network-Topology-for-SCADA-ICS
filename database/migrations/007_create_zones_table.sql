-- Migration: 007_create_zones_table
-- Description: Create security zones table

CREATE TABLE security_zones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(100) NOT NULL UNIQUE,
  purdue_level purdue_level NOT NULL,
  zone_type security_zone NOT NULL,
  description TEXT,
  subnets CIDR[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE firewall_rules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source_zone_id UUID REFERENCES security_zones(id) ON DELETE CASCADE,
  destination_zone_id UUID REFERENCES security_zones(id) ON DELETE CASCADE,
  protocol VARCHAR(20) NOT NULL,
  port INTEGER CHECK (port >= 1 AND port <= 65535),
  action VARCHAR(10) NOT NULL CHECK (action IN ('allow', 'deny')),
  description TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_zones_purdue_level ON security_zones(purdue_level);
CREATE INDEX idx_firewall_rules_zones ON firewall_rules(source_zone_id, destination_zone_id);

CREATE TRIGGER zones_updated_at
  BEFORE UPDATE ON security_zones
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Migration: 005_create_alerts_table
-- Description: Create alerts table for security events

CREATE TYPE alert_type AS ENUM ('security', 'connectivity', 'compliance', 'performance', 'configuration');
CREATE TYPE alert_severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');

CREATE TABLE alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type alert_type NOT NULL,
  severity alert_severity NOT NULL,
  title VARCHAR(200) NOT NULL,
  description TEXT,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  connection_id UUID REFERENCES connections(id) ON DELETE SET NULL,
  details JSONB DEFAULT '{}',
  remediation TEXT,
  acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_by VARCHAR(100),
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_alerts_type ON alerts(type);
CREATE INDEX idx_alerts_severity ON alerts(severity);
CREATE INDEX idx_alerts_device_id ON alerts(device_id);
CREATE INDEX idx_alerts_acknowledged ON alerts(acknowledged);
CREATE INDEX idx_alerts_resolved ON alerts(resolved);
CREATE INDEX idx_alerts_created_at ON alerts(created_at);
CREATE INDEX idx_alerts_active ON alerts(acknowledged, resolved) WHERE acknowledged = false AND resolved = false;

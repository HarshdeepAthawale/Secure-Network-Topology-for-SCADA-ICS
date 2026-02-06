-- Migration: 008_create_topology_snapshots_table
-- Description: Create topology snapshots table

CREATE TABLE topology_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  device_count INTEGER NOT NULL,
  connection_count INTEGER NOT NULL,
  collection_duration_ms INTEGER,
  sources telemetry_source[] DEFAULT '{}',
  snapshot_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_topology_snapshots_timestamp ON topology_snapshots(timestamp);

-- Risk assessments
CREATE TABLE risk_assessments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_id UUID NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  overall_score INTEGER NOT NULL CHECK (overall_score >= 0 AND overall_score <= 100),
  factors JSONB NOT NULL,
  recommendations TEXT[],
  assessed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_risk_assessments_device ON risk_assessments(device_id);
CREATE INDEX idx_risk_assessments_score ON risk_assessments(overall_score);
CREATE INDEX idx_risk_assessments_assessed_at ON risk_assessments(assessed_at);

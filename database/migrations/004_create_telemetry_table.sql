-- Migration: 004_create_telemetry_table
-- Description: Create telemetry table for time-series data

CREATE TYPE telemetry_source AS ENUM ('snmp', 'arp', 'mac_table', 'netflow', 'syslog', 'routing', 'manual');

CREATE TABLE telemetry (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  source telemetry_source NOT NULL,
  device_id UUID REFERENCES devices(id) ON DELETE SET NULL,
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
  data JSONB NOT NULL,
  raw_data TEXT,
  processed BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
) PARTITION BY RANGE (timestamp);

-- Create partitions for recent data (last 90 days monthly)
CREATE TABLE telemetry_current PARTITION OF telemetry
  FOR VALUES FROM (CURRENT_DATE - INTERVAL '30 days') TO (CURRENT_DATE + INTERVAL '1 day');

CREATE INDEX idx_telemetry_source ON telemetry(source);
CREATE INDEX idx_telemetry_device_id ON telemetry(device_id);
CREATE INDEX idx_telemetry_timestamp ON telemetry(timestamp);
CREATE INDEX idx_telemetry_processed ON telemetry(processed) WHERE processed = false;
CREATE INDEX idx_telemetry_data_gin ON telemetry USING GIN (data);

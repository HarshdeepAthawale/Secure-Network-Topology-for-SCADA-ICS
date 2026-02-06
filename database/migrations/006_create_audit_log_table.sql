-- Migration: 006_create_audit_log_table
-- Description: Create audit log table for compliance

CREATE TABLE audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50) NOT NULL,
  entity_id UUID,
  user_id VARCHAR(100),
  ip_address INET,
  user_agent TEXT,
  changes JSONB,
  metadata JSONB DEFAULT '{}'
) PARTITION BY RANGE (timestamp);

CREATE TABLE audit_log_current PARTITION OF audit_log
  FOR VALUES FROM (CURRENT_DATE - INTERVAL '90 days') TO (CURRENT_DATE + INTERVAL '1 day');

CREATE INDEX idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX idx_audit_log_action ON audit_log(action);
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);

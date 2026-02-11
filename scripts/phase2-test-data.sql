-- Phase 2 Visualization: Test Data Generation
-- Generates comprehensive test data for dashboard validation with 100+ devices

-- Clear existing test data (optional - comment out for production)
-- TRUNCATE devices, network_interfaces, connections, telemetry, alerts, risk_assessments CASCADE;

-- 1. Insert Test Devices (150+ devices across all Purdue levels)
-- purdue_level and security_zone use schema enums; device_type must match 001_create_devices_table.sql
INSERT INTO devices (
  id, name, hostname, type, vendor, model, firmware_version, serial_number,
  purdue_level, security_zone, status, location, discovered_at, last_seen_at, created_at, updated_at
)
SELECT
  gen_random_uuid(),
  'Device-L' || (l.level) || '-' || i::text,
  'device-l' || (l.level) || '-' || i::text || '.local',
  t.device_type,
  v.vendor,
  'Model-' || (l.level) || '-' || i::text,
  '1.0.0',
  'SN-' || (l.level) || '-' || i::text,
  (l.level::text)::purdue_level,
  (ARRAY['process', 'control', 'supervisory', 'operations', 'enterprise', 'dmz']::security_zone[])[l.level + 1],
  CASE WHEN random() > 0.15 THEN 'online'::device_status ELSE 'offline'::device_status END,
  jsonb_build_object('lab', 'Test Lab ' || (l.level)::text || '-' || FLOOR(i/5)::text),
  NOW() - INTERVAL '30 days' + (random() * INTERVAL '30 days'),
  NOW() - INTERVAL '1 minute' - (random() * INTERVAL '2 hours'),
  NOW() - INTERVAL '40 days',
  NOW()
FROM
  (SELECT DISTINCT level FROM (
    VALUES (0), (1), (2), (3), (4), (5)
  ) AS levels(level)) l,
  (SELECT unnest(ARRAY['plc'::device_type, 'rtu'::device_type, 'hmi'::device_type, 'switch'::device_type, 'router'::device_type, 'firewall'::device_type]) AS device_type) t,
  (SELECT unnest(ARRAY['Siemens'::text, 'Rockwell'::text, 'ABB'::text, 'GE'::text, 'Honeywell'::text]) AS vendor) v,
  generate_series(1, 25) AS i
WHERE random() > 0.05  -- Add some randomness to avoid exact duplicates
ON CONFLICT DO NOTHING;

-- 2. Insert Network Interfaces for devices
INSERT INTO network_interfaces (
  id, device_id, name, mac_address, ip_address, subnet_mask, gateway, vlan_id, speed_mbps, duplex, status
)
SELECT
  gen_random_uuid(),
  d.id,
  'eth' || ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY d.id),
  '02:' || to_hex(floor(random()*256)::int) || ':' ||
  to_hex(floor(random()*256)::int) || ':' ||
  to_hex(floor(random()*256)::int) || ':' ||
  to_hex(floor(random()*256)::int) || ':' ||
  to_hex(floor(random()*256)::int),
  ('192.168.' || (d.purdue_level::text) || '.' || (ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY d.id))::text)::inet,
  '255.255.255.0'::inet,
  ('192.168.' || (d.purdue_level::text) || '.1')::inet,
  (d.purdue_level::text::int * 100 + ROW_NUMBER() OVER (PARTITION BY d.id ORDER BY d.id))::int,
  CASE WHEN random() > 0.3 THEN 1000 ELSE 100 END,
  'full'::text,
  'up'::text
FROM devices d
LIMIT 300
ON CONFLICT DO NOTHING;

-- 3. Insert Connections between devices (500+ connections)
INSERT INTO connections (
  id, source_device_id, target_device_id, source_interface, target_interface,
  connection_type, protocol, port, vlan_id, bandwidth_mbps, latency_ms,
  is_secure, encryption_type, discovered_at, last_seen_at, metadata
)
SELECT
  gen_random_uuid(),
  src.id,
  dst.id,
  'eth0',
  'eth0',
  (ARRAY['ethernet'::connection_type, 'wireless'::connection_type, 'modbus'::connection_type, 'profinet'::connection_type])[floor(random()*4+1)::int],
  (ARRAY['TCP'::text, 'UDP'::text, 'Modbus'::text, 'OPC-UA'::text, 'MQTT'::text])[floor(random()*5+1)::int],
  CASE
    WHEN floor(random()*100) < 20 THEN 443
    WHEN floor(random()*100) < 40 THEN 80
    WHEN floor(random()*100) < 60 THEN 502
    WHEN floor(random()*100) < 80 THEN 4840
    ELSE 1883
  END::int,
  GREATEST(1, LEAST(4094, (src.purdue_level::text::int * 100 + 1)::int)),
  CASE WHEN random() > 0.3 THEN floor(random()*1000)::int ELSE 10000 END,
  CASE WHEN random() > 0.5 THEN FLOOR(random()*50)::float ELSE FLOOR(random()*200)::float END,
  random() > 0.25,
  CASE WHEN random() > 0.5 THEN 'TLS1.2' ELSE 'None' END::text,
  NOW() - INTERVAL '30 days' + (random() * INTERVAL '30 days'),
  NOW() - INTERVAL '5 minutes' - (random() * INTERVAL '1 hour'),
  jsonb_build_object('source', src.type::text, 'target', dst.type::text)
FROM
  (SELECT * FROM devices WHERE purdue_level::text::int < 5 ORDER BY random() LIMIT 80) src,
  LATERAL (SELECT * FROM devices d2 WHERE d2.purdue_level >= src.purdue_level AND d2.id != src.id ORDER BY random() LIMIT 1) dst
WHERE random() > 0.85
ON CONFLICT DO NOTHING;

-- 4. Insert Risk Assessments for devices
INSERT INTO risk_assessments (
  id, device_id, overall_score, factors, recommendations, assessed_at, created_at
)
SELECT
  gen_random_uuid(),
  d.id,
  FLOOR(random() * 100)::int,
  jsonb_build_object(
    'vulnerability_score', FLOOR(random() * 100),
    'configuration_score', FLOOR(random() * 100),
    'exposure_score', FLOOR(random() * 100),
    'compliance_score', FLOOR(random() * 100),
    'patch_level', FLOOR(random() * 5),
    'open_ports_count', FLOOR(random() * 20)
  ),
  ARRAY[
    'Apply latest security patches',
    'Review firewall rules',
    'Enable network segmentation',
    'Implement access controls',
    'Monitor connection patterns'
  ],
  NOW() - INTERVAL '1 day' - (random() * INTERVAL '7 days'),
  NOW() - INTERVAL '40 days'
FROM devices d
WHERE random() > 0.2  -- 80% of devices have risk assessments
ON CONFLICT DO NOTHING;

-- 5. Insert Security Alerts (alert_type enum: security, connectivity, compliance, performance, configuration)
INSERT INTO alerts (
  id, type, severity, title, description, device_id, connection_id,
  details, remediation, acknowledged, acknowledged_by, acknowledged_at,
  resolved, resolved_at, created_at
)
SELECT
  gen_random_uuid(),
  (ARRAY['security'::alert_type, 'connectivity'::alert_type, 'compliance'::alert_type, 'performance'::alert_type, 'configuration'::alert_type])[floor(random()*5+1)::int],
  (ARRAY['critical'::alert_severity, 'high'::alert_severity, 'medium'::alert_severity, 'low'::alert_severity])[floor(random()*4+1)::int],
  'Security Alert - ' || d.name,
  'Detected potential security issue on device ' || d.name,
  d.id,
  NULL,
  jsonb_build_object(
    'source_ip', '192.168.' || d.purdue_level::text || '.' || FLOOR(random()*254+1)::text,
    'event_count', FLOOR(random()*100+1)::int,
    'risk_score', FLOOR(random()*100)
  ),
  'Review device configuration and apply patches',
  random() > 0.4,
  CASE WHEN random() > 0.6 THEN 'admin@scada.local' ELSE NULL END,
  CASE WHEN random() > 0.6 THEN NOW() - INTERVAL '2 hours' ELSE NULL END,
  random() > 0.7,
  CASE WHEN random() > 0.7 THEN NOW() - INTERVAL '1 hour' ELSE NULL END,
  NOW() - INTERVAL '24 hours' - (random() * INTERVAL '24 hours')
FROM (
  SELECT d.id, d.name, d.purdue_level FROM devices d ORDER BY random() LIMIT 100
) d
ON CONFLICT DO NOTHING;

-- 6. Insert Telemetry Data (last 7 days)
-- Note: If this fails with "no partition of relation telemetry found", the telemetry table is
-- range-partitioned; ensure the partition covers NOW()-30d to NOW()+1d (see migration 004).
INSERT INTO telemetry (
  id, source, device_id, timestamp, data, raw_data, processed, metadata
)
SELECT
  gen_random_uuid(),
  'snmp'::telemetry_source,
  d.device_id,
  NOW() - INTERVAL '7 days' + (random() * INTERVAL '7 days'),
  jsonb_build_object(
    'cpu_usage', FLOOR(random() * 100),
    'memory_usage', FLOOR(random() * 100),
    'disk_usage', FLOOR(random() * 100),
    'network_throughput', FLOOR(random() * 10000),
    'packet_loss', random() * 5,
    'uptime_seconds', FLOOR(random() * 8640000)
  ),
  '{}',
  true,
  jsonb_build_object('collector', 'test-collector', 'version', '1.0')
FROM
  (SELECT id AS device_id FROM devices ORDER BY random() LIMIT 100) d,
  generate_series(0, 50)
ON CONFLICT DO NOTHING;

-- 7. Verify data insertion counts
SELECT
  (SELECT COUNT(*) FROM devices) as device_count,
  (SELECT COUNT(*) FROM network_interfaces) as interface_count,
  (SELECT COUNT(*) FROM connections) as connection_count,
  (SELECT COUNT(*) FROM risk_assessments) as risk_assessment_count,
  (SELECT COUNT(*) FROM alerts) as alert_count,
  (SELECT COUNT(*) FROM telemetry) as telemetry_count;

-- 8. Verify Purdue level distribution
SELECT
  CASE
    WHEN purdue_level::text = '0' THEN 'L0 (ICS)'
    WHEN purdue_level::text = '1' THEN 'L1 (Control)'
    WHEN purdue_level::text = '2' THEN 'L2 (Supervisory)'
    WHEN purdue_level::text = '3' THEN 'L3 (Operations)'
    WHEN purdue_level::text = '4' THEN 'L4 (Enterprise)'
    WHEN purdue_level::text = '5' THEN 'L5 (DMZ)'
    ELSE 'Other'
  END as level,
  COUNT(*) as device_count
FROM devices
GROUP BY purdue_level
ORDER BY purdue_level;

-- 9. Verify connection distribution
SELECT
  protocol,
  COUNT(*) as connection_count,
  ROUND(AVG(latency_ms), 2) as avg_latency_ms,
  SUM(CASE WHEN is_secure THEN 1 ELSE 0 END) as secure_connections
FROM connections
GROUP BY protocol
ORDER BY connection_count DESC;

-- 10. Verify risk assessment distribution
SELECT
  CASE
    WHEN overall_score < 25 THEN '0-25 (Low)'
    WHEN overall_score < 50 THEN '25-50 (Medium)'
    WHEN overall_score < 75 THEN '50-75 (High)'
    ELSE '75-100 (Critical)'
  END as risk_level,
  COUNT(*) as device_count
FROM risk_assessments
GROUP BY 1
ORDER BY device_count DESC;

-- 11. Verify alert distribution
SELECT
  severity,
  COUNT(*) as alert_count,
  SUM(CASE WHEN resolved THEN 1 ELSE 0 END) as resolved_count,
  SUM(CASE WHEN acknowledged THEN 1 ELSE 0 END) as acknowledged_count
FROM alerts
GROUP BY severity
ORDER BY alert_count DESC;

-- Seed: Default Purdue Model Security Zones

INSERT INTO security_zones (name, purdue_level, zone_type, description, subnets) VALUES
  ('Process Zone - Level 0', '0', 'process', 'Field devices: sensors, actuators, variable drives', ARRAY['10.0.0.0/24']::CIDR[]),
  ('Basic Control Zone - Level 1', '1', 'control', 'PLCs, RTUs, DCS controllers', ARRAY['10.1.0.0/24']::CIDR[]),
  ('Supervisory Zone - Level 2', '2', 'supervisory', 'SCADA servers, HMI systems, alarm servers', ARRAY['10.2.0.0/24']::CIDR[]),
  ('Operations Zone - Level 3', '3', 'operations', 'MES, historians, engineering workstations', ARRAY['10.3.0.0/24']::CIDR[]),
  ('Business Zone - Level 4', '4', 'enterprise', 'ERP integration, business planning systems', ARRAY['172.16.0.0/24']::CIDR[]),
  ('Enterprise Zone - Level 5', '5', 'enterprise', 'Corporate IT, internet access', ARRAY['192.168.0.0/24']::CIDR[]),
  ('Industrial DMZ', '99', 'dmz', 'Data diodes, proxies, jump servers', ARRAY['10.99.0.0/24']::CIDR[]);

-- Insert default firewall rules between zones
INSERT INTO firewall_rules (source_zone_id, destination_zone_id, protocol, port, action, description)
SELECT sz1.id, sz2.id, 'tcp', 443, 'allow', 'HTTPS between zones'
FROM security_zones sz1, security_zones sz2
WHERE sz1.purdue_level < sz2.purdue_level;

-- Block direct Level 5 to Level 0-1 access
INSERT INTO firewall_rules (source_zone_id, destination_zone_id, protocol, action, description)
SELECT sz1.id, sz2.id, 'any', 'deny', 'Block direct enterprise to process/control access'
FROM security_zones sz1, security_zones sz2
WHERE sz1.purdue_level = '5' AND sz2.purdue_level IN ('0', '1');

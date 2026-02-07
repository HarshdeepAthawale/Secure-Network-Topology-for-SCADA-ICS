# Phase 2: Visualization - Implementation Plan

**Status**: ⏳ PENDING
**Priority**: MEDIUM
**Estimated Time**: 1 week
**Goal**: Complete advanced Grafana dashboards for operational visibility

---

## Overview

Phase 2 focuses on creating professional visualization dashboards that provide real-time insights into:
- Network topology with interactive features
- Risk assessment and scoring
- Purdue model zone segmentation
- Security posture monitoring

---

## Task 2.1: Advanced Grafana Dashboards

### Dashboard 1: Real-time Topology Dashboard

**File**: `grafana/dashboards/realtime-topology.json`

**Features**:
- Interactive node graph with zoom/pan controls
- WebSocket real-time updates (<5s latency)
- Click-to-drill-down to device details
- Zone/Purdue level filtering
- Connection highlighting (secure vs insecure)
- Search and filter controls
- Device type icons
- Real-time connection animation for new flows

**Panels** (6 total):
1. Main Node Graph (full-screen capable)
   - Nodes colored by Purdue level
   - Edge thickness by connection frequency
   - Highlight insecure connections in red

2. Device Count by Level (mini stat)
   - L0, L1, L2, L3, L4, L5 breakdown

3. Active Connections Counter (mini stat)
   - Total connections in topology

4. Recent Topology Changes Timeline
   - Device additions/removals
   - Connection additions/removals

5. Zone Distribution Pie Chart
   - Process, Control, Supervisory, Enterprise, DMZ

6. Protocol Distribution
   - Modbus, OPC-UA, Ethernet, Serial, etc.

**Data Sources**:
- PostgreSQL queries for device/connection data
- WebSocket for real-time updates

**Performance Targets**:
- Queries execute in <2 seconds
- WebSocket updates within 5 seconds
- Support 100+ devices without degradation

---

### Dashboard 2: Risk Heatmap Dashboard

**File**: `grafana/dashboards/risk-heatmap.json`

**Features**:
- Risk score heatmap visualization
- Zone-based risk aggregation
- Risk trend analysis (7d, 30d, 90d)
- Top 10 highest risk devices table
- Risk distribution histogram
- Risk factor breakdown

**Panels** (8 total):
1. Overall Risk Gauge (0-100)
   - Color zones: Green (<25), Yellow (25-50), Orange (50-75), Red (75+)

2. Risk Heatmap (zones × devices)
   - Each cell colored by risk level
   - Sortable and filterable

3. Risk Score Timeline
   - Overall topology risk trend
   - Breakout by risk factor

4. Risk Factors Breakdown
   - Vulnerability score (0-100)
   - Configuration score (0-100)
   - Exposure score (0-100)
   - Compliance score (0-100)

5. High-Risk Devices Table
   - Device name, ID, risk score
   - Last update timestamp
   - Drill-down to device details

6. Risk Distribution Histogram
   - Count of devices by risk bucket

7. Affected Zones Bar Chart
   - Risk level per zone

8. Recommendations List
   - Top actionable recommendations
   - Priority level color coding

**Data Sources**:
- Risk assessments table
- Device vulnerability data
- Compliance status

---

### Dashboard 3: Zone Overview Dashboard

**File**: `grafana/dashboards/zone-overview.json`

**Features**:
- Purdue model zone segmentation visualization
- Device inventory per zone
- Cross-zone traffic flow diagram
- Firewall rule compliance checks
- Zone-to-zone connection matrix
- Unauthorized connection alerts

**Panels** (10 total):
1. Purdue Model Diagram
   - Visual representation of L0-L5 + DMZ
   - Click zones for drill-down

2-8. Zone Status Panels (7 panels, one per level)
   - Device count
   - Online/offline status
   - Risk level
   - Compliance status

9. Cross-Zone Traffic Sankey Diagram
   - Flow visualization between zones
   - Width represents traffic volume
   - Color by security status

10. Firewall Policy Status Table
    - Rule source/destination zones
    - Allow/deny status
    - Violations count

11. Zone Isolation Score Gauge
    - Percentage of compliant boundaries

12. Inter-Zone Latency Graph
    - Response times between zones
    - Identify bottlenecks

**Data Sources**:
- Security zones table
- Device Purdue level assignments
- Connection cross-zone analysis
- Firewall rules
- Network latency metrics

---

### Enhancement: Alert Timeline Panel

**Updates to**: `grafana/dashboards/security-alerts.json`

**New Features**:
- Alert lifecycle timeline
- Alert status transitions (created → acknowledged → resolved)
- Resolution time tracking
- MTTR (Mean Time To Resolve) calculation
- Alert correlation view
- Incident grouping

---

## Task 2.2: Dashboard Implementation Details

### Variables (for filtering)
```
- Purdue Level: Multi-select (0, 1, 2, 3, 4, 5)
- Security Zone: Multi-select dropdown
- Device Type: Multi-select (PLC, RTU, HMI, Switch, Router, etc.)
- Time Range: Standard (5m, 15m, 1h, 6h, 24h, 7d, 30d)
```

### SQL Query Patterns

```sql
-- Get topology nodes and edges
SELECT d.id, d.name, d.type, d.purdue_level, d.status,
       c.target_device_id, c.is_secure
FROM devices d
LEFT JOIN connections c ON d.id = c.source_device_id

-- Get risk scores by device
SELECT d.id, d.name, r.overall_score, r.vulnerability_score,
       r.configuration_score, r.exposure_score
FROM devices d
JOIN risk_assessments r ON d.id = r.device_id

-- Get zone aggregated stats
SELECT sz.name, COUNT(d.id) as device_count,
       AVG(r.overall_score) as avg_risk
FROM security_zones sz
LEFT JOIN devices d ON d.security_zone = sz.zone_id
LEFT JOIN risk_assessments r ON d.id = r.device_id
GROUP BY sz.zone_id
```

---

## Task 2.3: WebSocket Real-time Integration

### Server-side (already implemented)
- `src/websocket/server.ts` broadcasts:
  - Device status changes
  - New alerts
  - Topology changes
  - Telemetry updates

### Dashboard-side (Grafana)
- Configure WebSocket data source
- Set auto-refresh to use WebSocket updates
- Implement live query mode for panels

---

## Task 2.4: Testing & Validation

### Performance Testing
```bash
# Test with 100+ devices
# Verify <2s query times
# Verify <5s WebSocket latency
# Monitor dashboard rendering time
```

### Visual Testing
```bash
# Verify responsive design (1920x1080, 3840x2160)
# Test on mobile (if applicable)
# Color contrast compliance
# Legend and label clarity
```

### Data Validation
```bash
# Verify correct device counts
# Verify risk score calculations
# Verify zone assignments
# Verify connection integrity
```

---

## Phase 2 Acceptance Criteria

✅ All 3 new dashboards import successfully into Grafana 9.0+
✅ WebSocket integration provides <5s update latency
✅ Dashboards tested with 100+ devices, 500+ connections
✅ All queries optimized (execute in <2s)
✅ Responsive design works on 1920x1080 and 3840x2160 displays
✅ Export functionality works for all panels
✅ Interactive features (drill-down, filtering) work correctly
✅ Real-time updates display without errors
✅ Alert timeline shows accurate resolution times

---

## Phase 2 Verification

```bash
# Start Grafana
npm run grafana:start

# Import dashboards
curl -X POST http://admin:admin@localhost:3000/api/dashboards/db \
  -H "Content-Type: application/json" \
  -d @grafana/dashboards/realtime-topology.json

# Open in browser
open http://localhost:3000/d/scada-realtime-topology
open http://localhost:3000/d/scada-risk-heatmap
open http://localhost:3000/d/scada-zone-overview

# Verify WebSocket updates
# Watch for real-time data changes without page reload
```

---

## Success Metrics

- Dashboard load time <2 seconds
- Query execution <2 seconds
- WebSocket update latency <5 seconds
- Support 100+ devices without degradation
- All visualizations render correctly
- Interactive features responsive

---

## Dependencies

✅ Phase 1: Production Readiness (MUST BE COMPLETE)
- Database layer must be operational
- Test suite must be passing
- Monitoring must be in place

---

## Next Phase

→ **Phase 3: API Documentation** - Complete OpenAPI specification and Swagger UI

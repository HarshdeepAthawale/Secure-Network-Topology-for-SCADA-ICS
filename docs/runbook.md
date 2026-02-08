# Operational Runbook

## Overview

This runbook provides standard procedures for daily, weekly, monthly, and quarterly operations of the SCADA/ICS Network Topology Discovery system.

**Purpose**: Ensure consistent, reliable operations and proactive maintenance
**Target Audience**: Operations Engineers, System Administrators
**Last Updated**: 2026-02-08

---

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Weekly Operations](#weekly-operations)
3. [Monthly Operations](#monthly-operations)
4. [Quarterly Operations](#quarterly-operations)
5. [Incident Response](#incident-response)
6. [Maintenance Windows](#maintenance-windows)
7. [Checklists](#checklists)

---

## Daily Operations

### Morning Checklist (9:00 AM)

**Duration**: 15-20 minutes

**Procedure**:

1. **Review Alerts** (5 minutes)
   ```bash
   # Check for active alarms
   ./scripts/health-check.sh

   # Review CloudWatch alarms
   aws cloudwatch describe-alarms \
     --state-value ALARM \
     --region us-east-1 \
     --query 'MetricAlarms[].[AlarmName, StateReason]'

   # Check email for alert notifications
   ```

2. **Verify Collector Status** (5 minutes)
   ```bash
   # Check all collectors running
   ps aux | grep collector

   # Check collector logs for errors
   tail -20 /var/log/scada/collector.log

   # Count collected devices
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
     -c "SELECT COUNT(*) as device_count FROM devices;"
   ```

3. **Monitor Database Performance** (5 minutes)
   ```bash
   # Check database connections
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
     -c "SELECT count(*) as active_connections FROM pg_stat_activity;"

   # Expected: < 50 connections
   # Alert if > 100

   # Check database size
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
     -c "SELECT pg_size_pretty(pg_database_size(current_database()));"
   ```

4. **Verify Data Ingestion** (5 minutes)
   ```bash
   # Check telemetry data freshness
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
     -c "SELECT MAX(timestamp) as last_update FROM telemetry;"

   # Should be within last 5 minutes
   # If older, investigate Lambda functions
   ```

**Action if Issues Found**:
- ⚠️ Alerts present: Check [Troubleshooting Guide](troubleshooting.md)
- ⚠️ Collectors down: Restart collectors, check logs
- ⚠️ Data not flowing: Check Lambda logs in CloudWatch
- ⚠️ High connections: Kill idle connections, scale if needed

---

### Hourly Checks (During Business Hours)

**Duration**: 5 minutes per hour

**Procedure**:

1. **Check Dashboard**
   - Open Grafana dashboard
   - Verify real-time topology updates
   - Look for anomalies or gaps

2. **Monitor System Logs**
   ```bash
   # Check for new errors in last hour
   tail -50 /var/log/scada/collector.log | grep -i error

   # Check CloudWatch logs
   aws logs tail /aws/lambda/ingest --since 1h --follow
   ```

3. **Verify API Responsiveness**
   ```bash
   # Test API endpoint
   curl -H "X-API-Key: $API_KEY" \
     https://api.example.com/devices?limit=10 \
     -w "Status: %{http_code}, Time: %{time_total}s\n"

   # Expected: Status 200, Time < 1 second
   ```

**Action on Issue**:
- Contact on-call engineer if response time > 5 seconds
- Restart service if errors appear

---

### End of Day Review (5:00 PM)

**Duration**: 10 minutes

**Procedure**:

```bash
# 1. Summarize day's activity
echo "=== Daily Summary ==="
date
echo ""

# Device statistics
psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -c "SELECT COUNT(*) as total_devices,
           COUNT(DISTINCT zone_id) as zones_monitored,
           MAX(discovered_at) as last_discovery
      FROM devices;"

# Data collection summary
psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -c "SELECT COUNT(*) as telemetry_points,
           COUNT(DISTINCT device_id) as devices_reporting
      FROM telemetry
      WHERE timestamp > NOW() - INTERVAL '24 hours';"

# Alert summary
aws cloudwatch describe-alarms \
  --query 'MetricAlarms[] | length(@)'

echo ""
echo "Review complete. System status: OK"
```

2. **Document Issues**
   - Create tickets for any issues found
   - Note for next shift

3. **Backup Verification**
   ```bash
   # Verify daily backup completed
   ls -lh /backups/ | tail -5

   # Check S3 backup
   aws s3 ls s3://scada-topology-backups/config-backups/ \
     --recursive --human-readable --summarize
   ```

---

## Weekly Operations

### Monday Morning (Start of Week)

**Duration**: 30-45 minutes

**Procedure**:

1. **Security Log Review** (15 minutes)
   ```bash
   # Check failed authentication attempts
   aws logs start-query \
     --log-group-name /aws/lambda/query \
     --start-time $(date -d '7 days ago' +%s) \
     --end-time $(date +%s) \
     --query-string 'fields @timestamp, @message | filter @message like /unauthorized|401|403/'

   # Review IAM access logs
   aws s3 ls s3://audit-logs/ --recursive \
     --human-readable --summarize | tail -20
   ```

2. **API Key Audit** (10 minutes)
   ```bash
   # List active API keys
   aws apigateway get-api-keys \
     --include-values \
     --query 'items[].[name, createDate, enabled]'

   # Deactivate unused keys
   aws apigateway update-api-key \
     --api-key api-key-id \
     --patch-operations op=replace,path=/enabled,value=false
   ```

3. **Backup Verification** (10 minutes)
   ```bash
   # Verify all daily backups completed
   aws s3 ls s3://scada-topology-backups/config-backups/ \
     --recursive | wc -l

   # Expected: At least 7 backups (one per day)

   # Verify RDS snapshots
   aws rds describe-db-snapshots \
     --db-instance-identifier scada-topology-db \
     --query 'DBSnapshots[?CreateTime>=`2024-02-01`].[DBSnapshotIdentifier, CreateTime, Status]'
   ```

4. **Certificate Expiration Check** (5 minutes)
   ```bash
   # Check certificate expiration
   openssl x509 -in /path/to/cert.pem -text -noout | grep -A 1 "Not After"

   # Alert if < 30 days
   expiry_date=$(openssl x509 -in /path/to/cert.pem -noout -enddate | cut -d= -f2)
   days_left=$((( $(date -d "$expiry_date" +%s) - $(date +%s) ) / 86400))

   if [ $days_left -lt 30 ]; then
     echo "⚠️ Certificate expires in $days_left days"
   fi
   ```

---

### Friday Afternoon Review

**Duration**: 30 minutes

**Procedure**:

```bash
# Weekly performance summary
psql -h $DB_HOST -U $DB_USER -d $DB_NAME << EOF

-- Device growth
SELECT DATE(discovered_at) as discovery_date, COUNT(*) as new_devices
FROM devices
WHERE discovered_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(discovered_at)
ORDER BY discovery_date;

-- Data collection summary
SELECT
  COUNT(*) as total_telemetry_points,
  COUNT(DISTINCT device_id) as unique_devices,
  MIN(timestamp) as earliest_data,
  MAX(timestamp) as latest_data
FROM telemetry
WHERE timestamp > NOW() - INTERVAL '7 days';

-- Alert summary
SELECT alert_type, COUNT(*) as count
FROM alerts
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY alert_type;

EOF

# Generate weekly report
cat > weekly-report-$(date +%Y%m%d).txt << EOF
=== Weekly Operations Report ===
Week: $(date -d '7 days ago' +%Y-%m-%d) to $(date +%Y-%m-%d)
Generated: $(date)

Devices monitored: [INSERT COUNT]
Data points collected: [INSERT COUNT]
Alerts generated: [INSERT COUNT]
Critical issues: [INSERT NUMBER]
Resolved issues: [INSERT NUMBER]

Recommendations for next week:
- [ITEM 1]
- [ITEM 2]
EOF

# Email report to team
```

---

## Monthly Operations

### Month-End Review (Last Friday)

**Duration**: 1-2 hours

**Procedure**:

1. **Credential Rotation** (30 minutes)
   ```bash
   # Rotate SNMP credentials
   aws secretsmanager rotate-secret \
     --secret-id scada/snmp/credentials \
     --rotation-rules AutomaticallyAfterDays=90

   # Rotate database password
   aws secretsmanager rotate-secret \
     --secret-id rds/scada-topology/password \
     --rotation-rules AutomaticallyAfterDays=90

   # Rotate API keys
   aws apigateway create-api-key --name scada-api-key-$(date +%Y%m%d)
   aws apigateway update-api-key \
     --api-key old-key-id \
     --patch-operations op=replace,path=/enabled,value=false
   ```

2. **Full Database Backup Verification** (20 minutes)
   ```bash
   # Create manual backup
   ./scripts/backup-database.sh

   # Verify backup integrity
   aws s3 ls s3://scada-topology-backups/config-backups/ \
     --recursive --human-readable --summarize

   # Test restore from backup
   # (In test environment only)
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier scada-topology-db-test \
     --db-snapshot-identifier scada-backup-20240208-120000
   ```

3. **Capacity Planning Review** (30 minutes)
   ```bash
   # Analyze database growth
   aws cloudwatch get-metric-statistics \
     --namespace AWS/RDS \
     --metric-name DatabaseSize \
     --dimensions Name=DBInstanceIdentifier,Value=scada-topology-db \
     --statistics Average \
     --start-time $(date -d '30 days ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date +%Y-%m-%dT%H:%M:%S) \
     --period 86400

   # Project storage needs
   current_size=$(psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
     -c "SELECT pg_database_size(current_database())" -t | xargs)
   echo "Current database size: $current_size bytes"

   # If growth > 50%, plan for upgrade
   ```

4. **Security Assessment** (30 minutes)
   ```bash
   # Run security audit
   npm audit --audit-level=moderate

   # Check for vulnerable dependencies
   snyk test --severity-threshold=high

   # Verify security configurations
   # (See security-hardening.md for checklist)
   ```

5. **Generate Monthly Report**
   ```bash
   cat > monthly-report-$(date +%Y%m).txt << EOF
   === Monthly Operations Report ===
   Month: $(date +%B %Y)

   Metrics:
   - Total devices: [COUNT]
   - Total telemetry points: [COUNT]
   - Uptime: [PERCENTAGE]
   - Critical incidents: [NUMBER]
   - Mean time to resolve: [HOURS]

   Backup Status:
   - Successful backups: [NUMBER/30]
   - Total backup size: [SIZE]
   - Last test restore: [DATE]

   Capacity:
   - Database size: [SIZE]
   - Growth rate: [%/month]
   - Estimated storage needs: [MONTHS]

   Security:
   - Vulnerability findings: [NUMBER]
   - Credentials rotated: [YES/NO]
   - Access reviewed: [YES/NO]

   Recommendations:
   - [ITEM 1]
   - [ITEM 2]
   EOF
   ```

---

## Quarterly Operations

### Quarterly Review (End of Quarter)

**Duration**: Half day

**Procedure**:

1. **Disaster Recovery Drill** (2 hours)
   ```bash
   # 1. Prepare test environment
   # 2. Restore from latest backup
   aws rds restore-db-instance-from-db-snapshot \
     --db-instance-identifier scada-topology-dr-test \
     --db-snapshot-identifier latest-snapshot

   # 3. Deploy application to test environment
   # 4. Verify all data is accessible
   # 5. Test failover procedures
   # 6. Document time to recovery
   # 7. Document any issues found
   # 8. Clean up test environment
   ```

2. **Full Security Audit** (2 hours)
   ```bash
   # Review all security configurations
   # See security-hardening.md compliance checklist

   # 1. SNMP Security Review
   # - Verify all devices use SNMPv3
   # - Check auth protocol (SHA-256+)
   # - Check encryption (AES-256)

   # 2. TLS/Certificate Review
   # - Verify all certs valid
   # - Check cipher suites
   # - Certificate pinning status

   # 3. API Security Review
   # - Auth mechanism check
   # - Rate limiting verification
   # - CORS configuration review

   # 4. Database Security Review
   # - Encryption at rest: enabled
   # - Encryption in transit: enabled
   # - Access controls verified
   # - Audit logging enabled

   # 5. Network Security Review
   # - Firewall rules validated
   # - Security groups reviewed
   # - VPC configuration checked

   # 6. Secrets Management Review
   # - All credentials in Secrets Manager
   # - Rotation working
   # - Access controlled
   ```

3. **Performance Optimization Review** (1 hour)
   ```bash
   # Analyze query performance
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
     -c "SELECT * FROM pg_stat_statements
         ORDER BY mean_time DESC LIMIT 20;"

   # Check index usage
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
     -c "SELECT schemaname, tablename, indexname, idx_scan
         FROM pg_stat_user_indexes
         ORDER BY idx_scan DESC;"

   # Identify missing indexes
   psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
     -c "SELECT schemaname, tablename, attname, n_distinct
         FROM pg_stats
         WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
         ORDER BY n_distinct DESC;"
   ```

4. **Generate Quarterly Report**
   ```bash
   cat > quarterly-report-Q$(date +%q%Y).txt << EOF
   === Quarterly Operations Report ===
   Quarter: Q$(date +%q) $(date +%Y)

   Performance Metrics:
   - Average uptime: [PERCENTAGE]
   - Peak devices: [COUNT]
   - Max storage used: [SIZE]
   - P95 API latency: [MS]

   Incidents:
   - Total incidents: [NUMBER]
   - Critical incidents: [NUMBER]
   - Average resolution time: [HOURS]

   Security:
   - Vulnerabilities found: [NUMBER]
   - Vulnerabilities resolved: [NUMBER]
   - Security incidents: [NUMBER]

   Infrastructure:
   - Servers maintained: [COUNT]
   - Databases backed up: [COUNT]
   - Tests completed: [NUMBER]

   Recommendations:
   - [ITEM 1]
   - [ITEM 2]
   - [ITEM 3]
   EOF
   ```

---

## Incident Response

### Critical Incident Response Flow

**Severity Levels**:
- **P1 (Critical)**: System down, data loss, security breach
- **P2 (High)**: Major functionality degraded, limited users affected
- **P3 (Medium)**: Minor functionality issue, workaround available
- **P4 (Low)**: Documentation, minor cosmetic issue

### P1 Incident Response (5 minutes to declare)

```bash
#!/bin/bash
# CRITICAL INCIDENT RESPONSE

# 1. ASSESS & DECLARE (0-2 minutes)
echo "🚨 CRITICAL INCIDENT DETECTED"
date
echo ""

# 2. IMMEDIATE ACTIONS (2-3 minutes)
# Contact on-call team
echo "Sending emergency alerts..."
aws sns publish \
  --topic-arn arn:aws:sns:us-east-1:ACCOUNT_ID:critical-incident \
  --subject "CRITICAL: SCADA System Incident" \
  --message "Critical incident declared at $(date). Initiating response."

# 3. GATHER INFORMATION (3-5 minutes)
echo ""
echo "Gathering diagnostics..."

# Health check
./scripts/health-check.sh > incident-data-health.txt 2>&1

# Database status
psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -c "SELECT * FROM pg_stat_activity;" > incident-data-db.txt 2>&1

# CloudWatch logs
aws logs tail /aws/lambda/ingest --since 1h > incident-data-logs.txt 2>&1

# 4. ISOLATE (if needed)
# Kill problematic connections
psql -h $DB_HOST -U $DB_USER -d $DB_NAME \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity
      WHERE datname = 'scada_topology' AND state = 'idle';"

# 5. NOTIFY STAKEHOLDERS
echo ""
echo "Notifying stakeholders..."
# Send customer notification
# Post status page update
# Brief management

# 6. START INVESTIGATION
echo ""
echo "Investigation started at $(date)"
echo "Incident ticket: [CREATE IN JIRA/YOUR TICKETING SYSTEM]"
```

### P2 Incident Response (Documented Investigation)

```bash
# Follow troubleshooting guide
# Engage team leads
# Document findings
# Implement fix
# Verify resolution
# Post-mortem within 48 hours
```

---

## Maintenance Windows

### Scheduled Maintenance (Sunday 2:00 AM UTC)

**Duration**: 30-60 minutes
**Notice**: 7 days before

**Procedure**:

```bash
# 1. PRE-MAINTENANCE (Friday)
# - Notify stakeholders
# - Create change ticket
# - Backup all data
# - Test changes in staging

# 2. MAINTENANCE WINDOW
# - Post status page: "Maintenance in progress"
# - Pause collectors
# - Stop API server
# - Update dependencies/patches
# - Run database maintenance
#   VACUUM ANALYZE;
#   REINDEX;
# - Restart services
# - Verify functionality

# 3. POST-MAINTENANCE
# - Health check: ./scripts/health-check.sh
# - Verify data freshness
# - Check collector status
# - Resume normal operations
# - Update status page
# - Document changes
```

---

## Checklists

### Daily Operations Checklist

```
MORNING (9:00 AM)
☐ Review CloudWatch alarms
☐ Check collector status
☐ Verify database connections < 50
☐ Confirm data freshness (< 5 min old)
☐ Check API responsiveness

HOURLY (During Business Hours)
☐ Verify dashboard updates
☐ Check system logs for errors
☐ Test API endpoint

EVENING (5:00 PM)
☐ Review daily activity summary
☐ Document any issues
☐ Verify backup completion
☐ Check tomorrow's planned activities
```

### Weekly Checklist

```
MONDAY MORNING
☐ Review security logs
☐ Audit API keys
☐ Verify backup completion
☐ Check certificate expiration (< 30 days)

FRIDAY AFTERNOON
☐ Generate weekly performance report
☐ Review metrics and trends
☐ Plan improvements for next week
☐ Document issues and solutions
```

### Monthly Checklist

```
END OF MONTH
☐ Rotate SNMP credentials
☐ Rotate database password
☐ Rotate API keys
☐ Create full backup
☐ Test restore procedure
☐ Review database growth
☐ Run security audit
☐ Generate monthly report
☐ Update capacity forecast
```

### Quarterly Checklist

```
END OF QUARTER
☐ Disaster recovery drill
☐ Full security audit
☐ Performance optimization review
☐ Quarterly report generation
☐ Policy and procedure review
☐ Team training/knowledge sharing
☐ Budget review
```

---

## Quick Reference

### Common Commands

```bash
# Health check
./scripts/health-check.sh

# Cost analysis
./scripts/cost-tracker.sh

# Backup database
./scripts/backup-database.sh

# View collector status
ps aux | grep collector

# Check database
psql -h $DB_HOST -U $DB_USER -d $DB_NAME

# View logs
tail -f /var/log/scada/collector.log

# Restart collector
systemctl restart scada-collector

# Restart API
systemctl restart scada-api

# View CloudWatch logs
aws logs tail /aws/lambda/ingest --follow
```

### Key Files & Locations

- **Configuration**: `.env`, `docker-compose.yml`
- **Logs**: `/var/log/scada/`, CloudWatch
- **Backups**: `s3://scada-topology-backups/`
- **Database**: PostgreSQL on RDS
- **Monitoring**: Grafana, CloudWatch

### Contact Information

- **On-Call**: [Phone/Slack channel]
- **Team Lead**: [Name/Contact]
- **Manager**: [Name/Contact]
- **Escalation**: [Process]

---

## Document Control

- **Version**: 1.0
- **Last Updated**: 2026-02-08
- **Owner**: Operations Team
- **Review Schedule**: Quarterly
- **Next Review**: 2026-05-08

---

**Always refer to** [Troubleshooting Guide](troubleshooting.md) **for detailed issue resolution**

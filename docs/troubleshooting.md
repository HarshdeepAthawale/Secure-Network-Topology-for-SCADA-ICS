# Troubleshooting Guide

## Overview

This guide provides solutions for common issues encountered with the SCADA/ICS Network Topology Discovery system. Each section includes symptoms, causes, and step-by-step resolution procedures.

---

## 1. Device Discovery Issues

### Issue 1.1: Devices Not Discovered (No Devices Found)

**Symptoms**:
- SNMP collector reports 0 devices
- Topology graph is empty
- CloudWatch logs show "No devices discovered"

**Possible Causes**:
- SNMP credentials incorrect
- Network connectivity issue
- Firewall blocking SNMP port 161
- Devices not responding to SNMP queries
- Incorrect device IP ranges configured

**Resolution Steps**:

**Step 1: Verify SNMP Credentials**
```bash
# Test SNMP connectivity with correct credentials
snmpwalk -v 3 -u snmp_username \
  -a SHA-512 -A "auth_password" \
  -x AES-256 -X "priv_password" \
  -l authPriv 192.168.1.100 sysDescr

# Expected output: device system description
# If failed: check credentials in AWS Secrets Manager
aws secretsmanager get-secret-value --secret-id scada/snmp/credentials
```

**Step 2: Verify Network Connectivity**
```bash
# Test basic connectivity to device
ping 192.168.1.100

# Test SNMP port availability
nc -zv 192.168.1.100 161

# Use telnet (if nc not available)
(echo > /dev/tcp/192.168.1.100/161) 2>/dev/null && echo "Port open" || echo "Port closed"
```

**Step 3: Check Firewall Rules**
```bash
# Verify security group allows SNMP outbound
aws ec2 describe-security-groups --group-ids sg-xxxxxxxx \
  --query 'SecurityGroups[0].IpPermissions'

# Check NACLs
aws ec2 describe-network-acls --network-acl-ids acl-xxxxxxxx

# Manually verify with tcpdump (on collector)
tcpdump -i eth0 -n port 161
```

**Step 4: Check Collector Logs**
```bash
# Review collector logs for SNMP errors
tail -f /var/log/scada/collector.log

# Filter for SNMP-specific errors
grep -i "snmp" /var/log/scada/collector.log | tail -20

# Check Lambda logs in CloudWatch
aws logs tail /aws/lambda/process --follow
```

**Step 5: Verify Device Configuration**
```bash
# Ensure SNMP is enabled on device
# Example for Cisco device:
config t
snmp-server community public RO  # For SNMPv1/v2c
snmp-server group v3access usm priv read v1default  # For SNMPv3

# Verify OID accessibility
snmpget -v 3 -u username -a SHA-512 -A password \
  -x AES-256 -X privkey -l authPriv 192.168.1.100 .1.3.6.1.2.1.1.1.0
```

**Step 6: Test with Known Good Credentials**
```bash
# Create temporary SNMP user on test device
# Try discovery with that user
# If successful, original credentials may be wrong
# If still fails, it's a network/configuration issue
```

**Related CloudWatch Logs**:
```
fields @timestamp, @message, deviceIp
| filter @message like /discovery|snmp|error/
| stats count() by deviceIp, @message
```

---

### Issue 1.2: Partial Device Discovery (Some Devices Missing)

**Symptoms**:
- Only 50% of expected devices discovered
- Same devices always missing
- Pattern suggests network segment or device type issue

**Possible Causes**:
- Timeout issues for slow-responding devices
- Network latency causing packet loss
- Device-specific SNMP limitations
- Incomplete IP range configuration

**Resolution Steps**:

```bash
# 1. Check collector timeout configuration
grep -i "timeout\|retry" docker-compose.yml
# or for Lambda
aws lambda get-function-configuration --function-name process

# 2. Verify IP ranges configured
cat .env | grep -i "snmp\|ip\|device"

# 3. Test specific missing device
snmpwalk -t 10 -r 5 -v 3 -u username -a SHA-512 -A password \
  -x AES-256 -X privkey -l authPriv 192.168.1.250

# 4. Check response times
snmpget -Ot -v 3 -u username -a SHA-512 -A password \
  -x AES-256 -X privkey -l authPriv 192.168.1.100 .1.3.6.1.2.1.1.1.0

# 5. Increase timeout if necessary
export SNMP_TIMEOUT=30000  # 30 seconds
export SNMP_RETRIES=3

# 6. Check for device-specific issues
# Some devices may have SNMP disabled on specific interfaces
# or may require specific community strings
```

---

### Issue 1.3: Duplicate Devices Discovered

**Symptoms**:
- Same device appears multiple times in database
- Device IDs are different but IP/MAC are same
- Topology shows duplicate connections

**Possible Causes**:
- Multiple collectors discovering same device
- Device with multiple IPs/identities
- Correlation engine not merging devices correctly
- Race condition in device insertion

**Resolution Steps**:

```sql
-- 1. Identify duplicate devices
SELECT device_name, device_ip, COUNT(*) as count
FROM devices
GROUP BY device_name, device_ip
HAVING COUNT(*) > 1;

-- 2. Find duplicate device IDs
SELECT id, device_ip, discovered_at
FROM devices
WHERE device_ip = '192.168.1.100'
ORDER BY discovered_at;

-- 3. Check if duplicates are from different collectors
SELECT DISTINCT source_collector, device_ip
FROM devices
WHERE device_ip = '192.168.1.100';

-- 4. Merge duplicate devices (keep latest)
WITH duplicates AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY device_ip ORDER BY discovered_at DESC) as rn
  FROM devices
  WHERE device_ip = '192.168.1.100'
)
DELETE FROM devices WHERE id IN (SELECT id FROM duplicates WHERE rn > 1);

-- 5. Verify connections aren't orphaned
SELECT * FROM connections WHERE source_device_id NOT IN (SELECT id FROM devices);
```

**Prevention**:
```typescript
// Enable device correlation before insertion
const correlateDevice = async (device: Device): Promise<Device> => {
  const existing = await db.query(
    'SELECT * FROM devices WHERE device_ip = $1 OR device_mac = $2',
    [device.ip, device.mac]
  );

  if (existing.rows.length > 0) {
    return existing.rows[0]; // Return existing
  }

  return device; // Insert new
};
```

---

## 2. Data Collection Issues

### Issue 2.1: High Database Latency

**Symptoms**:
- API queries take >2 seconds
- Dashboard panels slow to load
- "Slow query" alerts in CloudWatch

**Possible Causes**:
- Database resource constraints (CPU/memory)
- Too many active connections
- Missing database indexes
- Large result sets without pagination

**Resolution Steps**:

**Step 1: Check Database Resource Usage**
```bash
# Check RDS CPU and memory
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=scada-topology-db \
  --statistics Average,Maximum \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300

# Check database connections
PGPASSWORD="password" psql -h db.example.com -U postgres -d scada_topology \
  -c "SELECT count(*) as active_connections FROM pg_stat_activity;"

# Expected: < 50 connections (adjust based on config)
```

**Step 2: Identify Slow Queries**
```sql
-- Enable query logging if not already done
ALTER SYSTEM SET log_min_duration_statement = 1000;  -- Log queries > 1 second
SELECT pg_reload_conf();

-- Find slow running queries
SELECT * FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 20;

-- Analyze specific slow query
EXPLAIN ANALYZE
SELECT d.device_name, c.connection_type, t.timestamp, t.metric_value
FROM devices d
JOIN connections c ON c.source_device_id = d.id
JOIN telemetry t ON t.device_id = d.id
WHERE d.zone_id = $1
ORDER BY t.timestamp DESC
LIMIT 1000;
```

**Step 3: Add Missing Indexes**
```sql
-- Create indexes on frequently filtered columns
CREATE INDEX idx_devices_zone_id ON devices(zone_id);
CREATE INDEX idx_connections_source ON connections(source_device_id);
CREATE INDEX idx_telemetry_device_time ON telemetry(device_id, timestamp DESC);
CREATE INDEX idx_alerts_timestamp ON alerts(timestamp DESC);

-- Verify index usage
SELECT schemaname, tablename, indexname
FROM pg_indexes
WHERE schemaname != 'pg_catalog'
ORDER BY tablename;
```

**Step 4: Scale Database if Needed**
```bash
# Check current instance class
aws rds describe-db-instances --db-instance-identifier scada-topology-db \
  --query 'DBInstances[0].DBInstanceClass'

# Scale up (requires maintenance window)
aws rds modify-db-instance \
  --db-instance-identifier scada-topology-db \
  --db-instance-class db.r5.xlarge \
  --apply-immediately
```

**Step 5: Implement Query Caching**
```typescript
// Cache frequently accessed queries
import { Cache } from './utils/cache';

const cache = new Cache({
  ttl: 300, // 5 minutes
});

const getDevicesByZone = async (zoneId: string) => {
  const cacheKey = `devices:zone:${zoneId}`;

  let devices = cache.get(cacheKey);
  if (devices) {
    return devices;
  }

  devices = await db.query(
    'SELECT * FROM devices WHERE zone_id = $1',
    [zoneId]
  );

  cache.set(cacheKey, devices);
  return devices;
};
```

**Step 6: Optimize API Pagination**
```typescript
// Always paginate large result sets
router.get('/devices', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 20, 1000);
  const offset = (parseInt(req.query.page) || 0) * limit;

  const devices = await db.query(
    'SELECT * FROM devices LIMIT $1 OFFSET $2',
    [limit, offset]
  );

  res.json({
    data: devices,
    pagination: { limit, offset, total: devices.total },
  });
});
```

**Related CloudWatch Insights Query**:
```
fields @duration, @message, @logStream
| filter @duration > 1000
| stats avg(@duration), max(@duration), count() by @logStream
```

---

### Issue 2.2: Missing Telemetry Data

**Symptoms**:
- Gaps in telemetry data
- Grafana panels show missing data
- Database has no entries for certain devices/timestamps

**Possible Causes**:
- Collector connection failures
- Lambda function timeouts
- Database insertion errors
- Network packet loss

**Resolution Steps**:

```bash
# 1. Check collector health
./scripts/health-check.sh | grep -i "collector\|lambda"

# 2. Review Lambda function logs
aws logs tail /aws/lambda/ingest --follow
aws logs tail /aws/lambda/process --follow

# 3. Check Lambda error rate
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Errors \
  --dimensions Name=FunctionName,Value=ingest \
  --statistics Sum \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300

# 4. Check MQTT message throughput
# Monitor IoT Core metrics
aws cloudwatch get-metric-statistics \
  --namespace AWS/IoT \
  --metric-name PublishIn.Success \
  --statistics Sum \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 300

# 5. Check for database insertion errors
PGPASSWORD="password" psql -h db.example.com -U postgres -d scada_topology \
  -c "SELECT COUNT(*) FROM telemetry WHERE timestamp > NOW() - INTERVAL '1 hour';"
```

---

## 3. WebSocket Issues

### Issue 3.1: WebSocket Connection Failures

**Symptoms**:
- Real-time updates not appearing
- "Connection refused" errors in browser console
- WebSocket connections timeout

**Possible Causes**:
- WebSocket server not running
- Firewall blocking port 443/80
- Invalid SSL certificate
- Rate limiting or connection limits

**Resolution Steps**:

```bash
# 1. Verify WebSocket server status
ps aux | grep -i "websocket\|node" | grep -v grep

# 2. Check if port is listening
netstat -tlnp | grep -E "443|3001"
# or
ss -tlnp | grep -E "443|3001"

# 3. Test WebSocket connectivity
curl -i -N -H "Connection: Upgrade" \
  -H "Upgrade: websocket" \
  -H "Sec-WebSocket-Key: SGVsbG8sIHdvcmxkIQ==" \
  -H "Sec-WebSocket-Version: 13" \
  https://api.example.com/ws

# 4. Check SSL certificate validity
openssl s_client -connect api.example.com:443 << /dev/null

# 5. Review WebSocket server logs
journalctl -u scada-websocket -n 50 --follow
# or
docker logs scada-websocket

# 6. Check rate limiting
# Ensure WebSocket connections aren't rate-limited
grep -i "ratelimit" docker-compose.yml
```

**Server-side Check**:
```typescript
// Check WebSocket server status
import { Server } from 'ws';

const wss = new Server({ port: 3001 });

wss.on('connection', (ws) => {
  console.log('Client connected');
  console.log(`Current connections: ${wss.clients.size}`);

  ws.on('close', () => {
    console.log(`Current connections: ${wss.clients.size}`);
  });
});

// Monitor connection limits
setInterval(() => {
  console.log(`Active connections: ${wss.clients.size}`);
  if (wss.clients.size > 1000) {
    console.warn('High WebSocket connection count');
  }
}, 60000);
```

---

### Issue 3.2: Real-Time Updates Lag

**Symptoms**:
- Updates delayed by 10+ seconds
- Manual refresh shows updated data
- Performance degrades with more clients

**Possible Causes**:
- WebSocket server resource constraints
- Too many clients connected
- Large message sizes
- Database query delays in update pipeline

**Resolution Steps**:

```typescript
// 1. Monitor WebSocket message throughput
const wsMetrics = {
  messagesSent: 0,
  messagesPerSecond: 0,
};

setInterval(() => {
  wsMetrics.messagesPerSecond = wsMetrics.messagesSent;
  wsMetrics.messagesSent = 0;
}, 1000);

// 2. Implement message batching
const messageQueue: any[] = [];
const flushInterval = 1000; // 1 second

const queueUpdate = (update: any) => {
  messageQueue.push(update);
};

setInterval(() => {
  if (messageQueue.length === 0) return;

  const batch = {
    updates: messageQueue.splice(0, messageQueue.length),
    timestamp: Date.now(),
  };

  wss.clients.forEach((client) => {
    if (client.readyState === OPEN) {
      client.send(JSON.stringify(batch));
    }
  });
}, flushInterval);

// 3. Compress messages
import { gzip } from 'zlib';

const compressMessage = async (message: string) => {
  return new Promise((resolve, reject) => {
    gzip(message, (err, compressed) => {
      if (err) reject(err);
      else resolve(compressed);
    });
  });
};

// 4. Scale WebSocket server
// Run multiple instances with load balancing
// Use sticky sessions to maintain connection affinity
```

---

## 4. Lambda Function Issues

### Issue 4.1: Lambda Timeout

**Symptoms**:
- Lambda functions timeout after 15 minutes
- Data ingestion incomplete
- CloudWatch shows "Task timed out" errors

**Possible Causes**:
- Processing large batches of data
- Database query performance
- Memory allocation too low
- Inefficient code

**Resolution Steps**:

```bash
# 1. Check Lambda timeout configuration
aws lambda get-function-configuration --function-name process \
  --query 'Timeout'

# 2. Increase timeout (max 15 minutes)
aws lambda update-function-configuration \
  --function-name process \
  --timeout 900  # 15 minutes

# 3. Check memory allocation
aws lambda get-function-configuration --function-name process \
  --query 'MemorySize'

# 4. Increase memory (improves CPU)
aws lambda update-function-configuration \
  --function-name process \
  --memory-size 3008  # Maximum

# 5. Check CloudWatch logs for slow operations
aws logs tail /aws/lambda/process --follow \
  --pattern "Duration"
```

**Code Optimization**:
```typescript
// 1. Process in smaller batches
const processBatch = async (items: Item[], batchSize = 100) => {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    await Promise.all(batch.map(processItem));
  }
};

// 2. Use connection pooling
const pool = new Pool({
  max: 10,
  min: 2,
  idle: 1000,
});

// 3. Implement request timeout
const executeWithTimeout = async <T>(
  fn: () => Promise<T>,
  timeoutMs: number = 10000
): Promise<T> => {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), timeoutMs)
    ),
  ]);
};

// 4. Monitor execution time
const startTime = Date.now();
try {
  await processData();
} finally {
  const duration = Date.now() - startTime;
  console.log(`Execution time: ${duration}ms`);
  if (duration > 300000) {
    // 5 minutes
    console.warn('Lambda execution approaching timeout');
  }
}
```

---

### Issue 4.2: Lambda Out of Memory (OOM)

**Symptoms**:
- "Process out of memory" errors
- Lambda function abruptly terminated
- No error message in logs

**Possible Causes**:
- Memory leak in application
- Processing too much data at once
- Insufficient memory allocation

**Resolution Steps**:

```bash
# 1. Check current memory allocation
aws lambda get-function-configuration --function-name process \
  --query 'MemorySize'

# 2. Increase memory
aws lambda update-function-configuration \
  --function-name process \
  --memory-size 3008  # Maximum

# 3. Analyze memory usage with Node.js profiler
# Install clinic
npm install -g clinic

# 4. Run locally to test memory usage
clinic doctor -- npm start

# 5. Check for memory leaks
# Monitor heap size
const heapSize = () => {
  const used = process.memoryUsage();
  console.log('Memory Usage:', {
    rss: `${Math.round(used.rss / 1024 / 1024)} MB`,
    heapTotal: `${Math.round(used.heapTotal / 1024 / 1024)} MB`,
    heapUsed: `${Math.round(used.heapUsed / 1024 / 1024)} MB`,
    external: `${Math.round(used.external / 1024 / 1024)} MB`,
  });
};
```

**Memory Optimization**:
```typescript
// 1. Stream large files instead of loading entire
const readLargeFile = async (filePath: string) => {
  return fs.createReadStream(filePath, {
    highWaterMark: 64 * 1024, // 64KB chunks
  });
};

// 2. Clear large objects after use
let largeData = fetchLargeData();
processData(largeData);
largeData = null; // Explicit garbage collection hint

// 3. Use generators for iterating large datasets
function* processItems(items: Item[]) {
  for (const item of items) {
    yield processItem(item);
  }
}

// 4. Implement object pooling
const objectPool: Buffer[] = [];

const getBuffer = (): Buffer => {
  return objectPool.pop() || Buffer.allocUnsafe(1024);
};

const releaseBuffer = (buffer: Buffer) => {
  objectPool.push(buffer);
};
```

---

## 5. API Errors

### Issue 5.1: 401 Unauthorized

**Symptoms**:
- "401 Unauthorized" response
- "Invalid API key" errors
- JWT token validation failures

**Possible Causes**:
- Missing or invalid API key
- Expired JWT token
- Incorrect authentication header format

**Resolution Steps**:

```bash
# 1. Verify API key exists
aws secretsmanager list-secrets \
  --filters Key=name,Values=api \
  --region us-east-1

# 2. Check API key format
# Should be: Authorization: Bearer <token>
# or: X-API-Key: <key>

curl -H "Authorization: Bearer your-jwt-token" \
  https://api.example.com/devices

# 3. Decode JWT token to check expiration
# Use https://jwt.io or:
node -e "console.log(JSON.parse(Buffer.from('eyJ...', 'base64').toString()))"

# 4. Generate new API key if expired
aws apigateway create-api-key \
  --name scada-api-key \
  --enabled
```

**Code Debug**:
```typescript
// Test authentication
const testAuth = async () => {
  const token = process.env.API_TOKEN;

  const response = await fetch('https://api.example.com/devices', {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });

  if (response.status === 401) {
    console.error('Authentication failed');
    console.error('Token:', token?.substring(0, 20) + '...');
  }

  return response.json();
};
```

---

### Issue 5.2: 429 Too Many Requests

**Symptoms**:
- "429 Too Many Requests" responses
- Rate limiting triggered unexpectedly
- Legitimate requests being blocked

**Possible Causes**:
- Exceeding rate limit quota
- Multiple clients using same API key
- DDoS or attack pattern

**Resolution Steps**:

```bash
# 1. Check rate limit configuration
aws apigateway get-stage \
  --rest-api-id rest-api-id \
  --stage-name prod \
  --query 'ThrottleSettings'

# 2. Check current request count
aws cloudwatch get-metric-statistics \
  --namespace AWS/ApiGateway \
  --metric-name Count \
  --dimensions Name=ApiName,Value=scada-api \
  --statistics Sum \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
  --period 60

# 3. Increase rate limits if legitimate
aws apigateway update-stage \
  --rest-api-id rest-api-id \
  --stage-name prod \
  --patch-operations \
    op=replace,path=/*\/throttle/rateLimit,value=2000 \
    op=replace,path=/*\/throttle/burstLimit,value=5000

# 4. Implement exponential backoff in client
```

**Client-side Retry Logic**:
```typescript
const retryWithBackoff = async (
  fn: () => Promise<Response>,
  maxRetries = 5
) => {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fn();

      if (response.status !== 429) {
        return response;
      }

      const waitTime = Math.pow(2, attempt) * 1000; // Exponential backoff
      console.log(`Rate limited. Retrying in ${waitTime}ms`);
      await new Promise((resolve) => setTimeout(resolve, waitTime));
    } catch (error) {
      if (attempt === maxRetries - 1) throw error;
    }
  }
};
```

---

## 6. Performance Optimization

### Optimization 6.1: Database Performance

```sql
-- Analyze table statistics
ANALYZE devices;
ANALYZE connections;
ANALYZE telemetry;

-- Vacuum and reindex
VACUUM ANALYZE devices;
REINDEX TABLE devices;

-- Check query plans
EXPLAIN (ANALYZE, BUFFERS) SELECT * FROM devices WHERE zone_id = 1;

-- Create materialized views for common queries
CREATE MATERIALIZED VIEW device_summary AS
SELECT zone_id, COUNT(*) as device_count, MAX(discovered_at) as last_update
FROM devices
GROUP BY zone_id;

-- Index materialized view
CREATE INDEX idx_device_summary_zone ON device_summary(zone_id);

-- Refresh materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY device_summary;
```

### Optimization 6.2: Lambda Performance

```typescript
// 1. Keep connections warm
const pool = new Pool({
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// 2. Reuse database connections
export const getConnection = () => pool;

// 3. Optimize Lambda package size
// Remove dev dependencies, unused packages
npm install --omit=dev

// 4. Use Lambda layers for dependencies
// Separates code from libraries for faster uploads

// 5. Enable Lambda provisioned concurrency
aws lambda put-provisioned-concurrency-config \
  --function-name process \
  --provisioned-concurrent-executions 10
```

### Optimization 6.3: API Performance

```typescript
// 1. Implement caching headers
res.set('Cache-Control', 'public, max-age=300'); // 5 minutes

// 2. Use compression
import compression from 'compression';
app.use(compression());

// 3. Implement pagination
// Always limit result sets

// 4. Use select instead of *
// Only fetch required columns
SELECT device_name, device_ip FROM devices;

// 5. Implement query result caching
const cache = new Cache({ ttl: 300 });
const cachedQuery = await cache.remember(
  'devices:all',
  () => db.query('SELECT * FROM devices')
);
```

---

## 7. Monitoring & Alerting

### Key Metrics to Monitor

```bash
# Database metrics
aws cloudwatch list-metrics --namespace AWS/RDS
# Focus on: CPUUtilization, DatabaseConnections, ReadLatency, WriteLatency

# Lambda metrics
aws cloudwatch list-metrics --namespace AWS/Lambda
# Focus on: Duration, Errors, Throttles, ConcurrentExecutions

# API Gateway metrics
aws cloudwatch list-metrics --namespace AWS/ApiGateway
# Focus on: Count, 4XXError, 5XXError, Latency

# IoT Core metrics
aws cloudwatch list-metrics --namespace AWS/IoT
# Focus on: PublishIn.Success, Publish.Out.Success, Connect.Success
```

### Creating Alarms

```bash
# Database high CPU
aws cloudwatch put-metric-alarm \
  --alarm-name scada-rds-high-cpu \
  --alarm-description "Alert when RDS CPU exceeds 80%" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:scada-alerts

# Lambda errors
aws cloudwatch put-metric-alarm \
  --alarm-name scada-lambda-errors \
  --alarm-description "Alert on Lambda errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --alarm-actions arn:aws:sns:us-east-1:ACCOUNT_ID:scada-alerts
```

---

## 8. Common Solutions Quick Reference

| Issue | Quick Fix |
|-------|-----------|
| Devices not discovered | Test SNMP: `snmpwalk -v 3 -u user ... device-ip` |
| High latency | Check DB: `SELECT count(*) FROM pg_stat_activity` |
| WebSocket lag | Check connections: `netstat -an \| grep -i listen` |
| Lambda timeout | Increase timeout: `aws lambda update-function-configuration --timeout 900` |
| 401 Unauthorized | Regenerate token/API key |
| 429 Too Many Requests | Implement exponential backoff, increase rate limits |
| Memory issues | Increase Lambda memory, check for memory leaks |
| Missing data | Check collector logs, verify connectivity |

---

## 9. Getting Help

### Internal Resources
- **Runbook**: See [docs/runbook.md](runbook.md)
- **Architecture**: See [docs/architecture.md](architecture.md)
- **Deployment**: See [docs/deployment.md](deployment.md)
- **Security**: See [docs/security-hardening.md](security-hardening.md)

### CloudWatch Insights Queries

**Failed API Requests**:
```
fields @timestamp, @message, @duration
| filter @message like /error|failed/
| stats count() by @message
```

**Slow Queries**:
```
fields @duration, @message
| filter @duration > 1000
| stats avg(@duration), max(@duration), count() by @logStream
```

**Lambda Errors**:
```
fields @timestamp, @message, @functionName
| filter @message like /error|exception/
| stats count() by @functionName
```

---

## 10. Contact & Escalation

- **Team Chat**: #scada-topology-support
- **Email**: scada-team@company.com
- **On-Call**: Use PagerDuty escalation policy
- **Emergency**: Contact infrastructure team

---

**Last Updated**: 2026-02-08
**Version**: 1.0

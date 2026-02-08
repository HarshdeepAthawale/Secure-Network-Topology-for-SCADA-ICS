# Security Hardening Guide

## Overview

This guide provides comprehensive security hardening procedures for the SCADA/ICS Network Topology Discovery system. It covers configuration best practices, compliance requirements, and operational security procedures.

**Compliance Standards**:
- NIST Cybersecurity Framework (CSF)
- IEC 62443 (Industrial Automation and Control Systems Security)
- NERC CIP (North American Electric Reliability Corporation Critical Infrastructure Protection)
- CIS Benchmarks

---

## 1. SNMPv3 Configuration

### 1.1 Authentication Settings

SNMP devices MUST be configured with SNMPv3 authentication:

```bash
# Example SNMPv3 user creation (device-side)
snmpusm -v 3 -u initial_user -n "" -a SHA-256 \
  -A "authentication_passphrase" \
  -l authPriv 192.168.1.1 create username
```

**Authentication Requirements**:
- ✅ Use SHA-256 or SHA-512 for authentication (minimum)
- ✅ Enforce minimum 16-character passwords
- ❌ Disable SNMPv1 and SNMPv2c entirely
- ✅ Use authPriv security level (authentication + encryption)
- ✅ Set reasonable authentication timeout (30 seconds)

### 1.2 Encryption Settings

```bash
# SNMPv3 encryption configuration
snmp_priv_protocol=AES-256
snmp_priv_password=your_encryption_key_minimum_16_chars
snmp_auth_protocol=SHA-512
```

**Encryption Requirements**:
- ✅ Use AES-256 for encryption
- ❌ Never use DES or 3DES (deprecated)
- ✅ Rotate encryption keys quarterly
- ✅ Use strong, randomly generated keys
- ✅ Store keys in AWS Secrets Manager (not environment variables)

### 1.3 SNMP Collector Security

```typescript
// Example: Secure SNMP collector configuration
const snmpConfig = {
  version: '3',
  userName: 'secure_snmp_user',
  authProtocol: 'sha256',  // or sha512
  authPassphrase: process.env.SNMP_AUTH_PASS,
  privProtocol: 'aes256',
  privPassphrase: process.env.SNMP_PRIV_PASS,
  securityLevel: 'authPriv',
  timeout: 30000,
  retries: 2,
};
```

### 1.4 SNMP Access Control

**Permitted sources**:
- Restrict SNMP access to collector IPs only
- Use security groups / NACLs to enforce
- Monitor for unauthorized SNMP queries
- Log all SNMP access attempts

---

## 2. TLS/HTTPS Configuration

### 2.1 Certificate Management

```bash
# Generate certificates with appropriate validity
openssl req -x509 -newkey rsa:4096 \
  -keyout private.key -out cert.pem \
  -days 365 -nodes \
  -subj "/CN=api.example.com/O=Company/C=US"
```

**Certificate Requirements**:
- ✅ Minimum TLS 1.2 (prefer TLS 1.3)
- ✅ Certificates valid for maximum 1 year
- ✅ Implement certificate pinning for critical connections
- ✅ Monitor certificate expiration (alert at 30 days)
- ✅ Use ECDSA or RSA 4096-bit minimum
- ✅ Obtain certificates from trusted CAs

### 2.2 Allowed Cipher Suites

Only permit the following cipher suites:

```
TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384
TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256
TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384
TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256
TLS_DHE_RSA_WITH_AES_256_GCM_SHA384
TLS_DHE_RSA_WITH_AES_128_GCM_SHA256
```

**Disable**:
- ❌ SSLv2, SSLv3, TLS 1.0, TLS 1.1
- ❌ RC4, DES, 3DES, MD5
- ❌ Export-grade ciphers
- ❌ NULL cipher suites
- ❌ Anonymous Diffie-Hellman

### 2.3 MQTT/TLS Configuration

```javascript
// Secure MQTT with TLS 1.3
const mqttOptions = {
  protocol: 'mqtts',
  port: 8883,
  ca: fs.readFileSync('ca.crt'),
  cert: fs.readFileSync('client.crt'),
  key: fs.readFileSync('client.key'),
  rejectUnauthorized: true,
  minVersion: 'TLSv1.3',
  // Cipher suites - whitelist only strong ones
  ciphers: [
    'TLS_AES_256_GCM_SHA384',
    'TLS_CHACHA20_POLY1305_SHA256',
  ].join(':'),
};
```

### 2.4 Certificate Pinning

```typescript
// Example: Certificate pinning for AWS IoT
const pinnedCertificate = fs.readFileSync('aws-iot-ca.pem');

const mqtt = mqtt.connect(IoTEndpoint, {
  rejectUnauthorized: true,
  ca: [pinnedCertificate],
  cert: clientCertificate,
  key: clientPrivateKey,
});
```

---

## 3. API Gateway Security

### 3.1 Authentication

**Implement multi-factor authentication**:

```bash
# API key requirement
curl -H "X-API-Key: your-api-key-here" \
  https://api.example.com/devices
```

**JWT Token Configuration**:
- ✅ Maximum token expiration: 1 hour
- ✅ Refresh token rotation: 30 days
- ✅ Token signing: RS256 algorithm (RSA signature)
- ✅ Revocation list monitoring
- ✅ Support mutual TLS (mTLS) for client authentication

```typescript
// JWT verification example
import jwt from 'jsonwebtoken';

const verifyToken = (token: string): JwtPayload | null => {
  try {
    const decoded = jwt.verify(token, process.env.JWT_PUBLIC_KEY, {
      algorithms: ['RS256'],
      maxAge: '1h',
    });
    return decoded as JwtPayload;
  } catch (error) {
    logger.error('JWT verification failed', error);
    return null;
  }
};
```

### 3.2 Rate Limiting

```typescript
// Rate limiting configuration
const rateLimitConfig = {
  authenticated: {
    windowMs: 60 * 1000,  // 1 minute
    maxRequests: 100,      // 100 requests/minute per API key
  },
  anonymous: {
    windowMs: 60 * 1000,
    maxRequests: 10,       // 10 requests/minute
  },
  // Implement exponential backoff
  backoffMultiplier: 2,
};
```

### 3.3 CORS Configuration

```typescript
// Strict CORS policy
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || [],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
  credentials: true,
  maxAge: 86400, // 24 hours
  optionsSuccessStatus: 200,
};

// Never use wildcard (*) for sensitive endpoints
// Only allow specific origins
```

### 3.4 Input Validation

```typescript
// Zod schema validation example
import { z } from 'zod';

const QueryDeviceSchema = z.object({
  id: z.string().uuid(),
  filter: z.string().max(100),
  limit: z.number().int().min(1).max(1000).default(100),
});

export const validateQueryParams = (data: unknown) => {
  return QueryDeviceSchema.parse(data);
};
```

---

## 4. Database Security

### 4.1 Connection Security

```bash
# RDS connection string with SSL
PGURI="postgresql://user:pass@db.example.com:5432/scada_topology?sslmode=require&sslrootcert=rds-ca-bundle.pem"
```

**Requirements**:
- ✅ Require SSL/TLS for all database connections
- ✅ Use IAM authentication for AWS RDS
- ✅ Set `sslmode=require` or `sslmode=verify-full`
- ✅ Never store passwords in environment variables
- ✅ Rotate database passwords every 90 days
- ✅ Use AWS Secrets Manager for credential storage

```typescript
// Secure RDS connection with IAM auth
import { createConnection } from 'mysql2/promise';
import { Signer } from '@aws-sdk/rds-signer';

const signer = new Signer({
  region: 'us-east-1',
  hostname: 'db-instance.xxxxxx.us-east-1.rds.amazonaws.com',
  port: 5432,
  username: 'admin',
});

const token = signer.getAuthToken({
  username: 'admin',
});

const connection = await createConnection({
  host: 'db-instance.xxxxxx.us-east-1.rds.amazonaws.com',
  user: 'admin',
  password: token,
  database: 'scada_topology',
  ssl: 'Amazon RDS',
});
```

### 4.2 Data Encryption

```sql
-- Enable encryption at rest (RDS parameter group)
rds_encryption = 1;

-- Verify encryption status
SELECT datname,
       pg_database.datacl,
       has_database_privilege('public', datname, 'CONNECT')
FROM pg_database
WHERE datname = 'scada_topology';
```

**Encryption Requirements**:
- ✅ Enable RDS encryption at rest (AWS KMS)
- ✅ Enable encryption in transit (SSL/TLS)
- ✅ Enable automated backups with encryption
- ✅ Encrypt backup snapshots
- ✅ Use customer-managed KMS keys (not AWS-managed)

### 4.3 Audit Logging

```sql
-- Enable PostgreSQL audit logging
CREATE EXTENSION IF NOT EXISTS pgaudit;

CREATE ROLE audit;
GRANT EXECUTE ON FUNCTION pgaudit.audit_object(text, text, text, text) TO audit;

ALTER SYSTEM SET pgaudit.log = 'DDL, ROLE, MISC';
ALTER SYSTEM SET pgaudit.log_level = warning;
ALTER SYSTEM SET pgaudit.log_statement = on;

SELECT pg_reload_conf();
```

**Log Requirements**:
- ✅ Enable query logging for sensitive operations
- ✅ Log DDL statements (CREATE, ALTER, DROP)
- ✅ Log authentication attempts
- ✅ Log role changes
- ✅ Retain logs for minimum 90 days
- ✅ Monitor log file size and rotation

### 4.4 Row-Level Security (RLS)

```sql
-- Example: Row-level security for tenant isolation
CREATE POLICY tenant_isolation ON devices
  USING (tenant_id = current_setting('app.current_tenant')::uuid);

ALTER TABLE devices ENABLE ROW LEVEL SECURITY;
```

### 4.5 Database Hardening

```sql
-- Disable unnecessary extensions
DROP EXTENSION IF EXISTS plpython3u;
DROP EXTENSION IF EXISTS plpython2u;

-- Restrict database parameter changes
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_min_duration_statement = 1000;

-- Set connection limits
ALTER SYSTEM SET max_connections = 100;
ALTER SYSTEM SET max_parallel_workers = 4;

-- Implement SSL requirement
ALTER SYSTEM SET ssl = on;
ALTER SYSTEM SET ssl_protocols = 'TLSv1.3';
```

---

## 5. Network Security

### 5.1 Network Segmentation

```bash
# AWS Security Group configuration
# Collectors should be in DMZ with minimal exposure

# Inbound rules:
# - Allow SNMP (161 UDP) from monitored devices only
# - Allow MQTT (8883 TCP) from IoT Core only
# - Allow DNS (53 UDP) for query resolution

# Outbound rules:
# - Allow SNMP (161 UDP) to device subnets
# - Allow MQTT (8883 TCP) to IoT Core endpoint
# - Allow HTTPS (443) for AWS API calls
# - Allow DNS (53 UDP) for name resolution
```

### 5.2 VPC Configuration

```hcl
# Terraform: Secure VPC setup
resource "aws_vpc" "scada" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "scada-vpc"
  }
}

# Private subnet for collectors
resource "aws_subnet" "collectors" {
  vpc_id            = aws_vpc.scada.id
  cidr_block        = "10.0.1.0/24"
  availability_zone = "us-east-1a"

  tags = {
    Name = "collectors-subnet"
  }
}

# Database subnet (private)
resource "aws_subnet" "database" {
  vpc_id            = aws_vpc.scada.id
  cidr_block        = "10.0.2.0/24"
  availability_zone = "us-east-1b"

  tags = {
    Name = "database-subnet"
  }
}
```

### 5.3 Firewall Rules

**Default-deny policy**:

```bash
# AWS Network ACL configuration
# Inbound: Deny all by default
# Inbound exceptions:
#   - SNMP (161) from device ranges
#   - MQTT (8883) from specific IPs
#   - HTTPS (443) from API consumers
#   - SSH (22) from bastion host only (for troubleshooting)

# Outbound: Allow all (can be more restrictive)
```

### 5.4 DDoS Protection

- ✅ Enable AWS Shield Standard (automatic)
- ✅ Enable AWS Shield Advanced for critical components
- ✅ Configure AWS WAF for API Gateway
- ✅ Implement rate limiting at all layers
- ✅ Use CloudFront for static content distribution

```hcl
# Terraform: WAF configuration
resource "aws_wafv2_web_acl" "scada_api" {
  name  = "scada-api-waf"
  scope = "REGIONAL"

  default_action {
    allow {}
  }

  rule {
    name     = "RateLimitRule"
    priority = 1

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "RateLimitRule"
      sampled_requests_enabled   = true
    }
  }
}
```

---

## 6. Secrets Management

### 6.1 AWS Secrets Manager

**All credentials MUST be stored in AWS Secrets Manager**:

```bash
# Create a secret
aws secretsmanager create-secret \
  --name scada/snmp/credentials \
  --description "SNMPv3 credentials for device collectors" \
  --secret-string '{
    "username": "snmp_user",
    "auth_password": "...",
    "priv_password": "..."
  }' \
  --region us-east-1

# Retrieve secret
aws secretsmanager get-secret-value \
  --secret-id scada/snmp/credentials \
  --region us-east-1
```

### 6.2 Credential Rotation

```typescript
// Automatic credential rotation (30-day cycle)
const rotateCredentials = async () => {
  const secretsManager = new SecretsManagerClient({ region: 'us-east-1' });

  const secret = await secretsManager.send(
    new GetSecretValueCommand({
      SecretId: 'scada/snmp/credentials',
    })
  );

  const credentials = JSON.parse(secret.SecretString!);

  // Generate new credentials
  const newPassword = generateSecurePassword(32);

  // Update secret
  await secretsManager.send(
    new UpdateSecretCommand({
      SecretId: 'scada/snmp/credentials',
      SecretString: JSON.stringify({
        ...credentials,
        auth_password: newPassword,
      }),
    })
  );

  logger.info('Credentials rotated successfully');
};

// Schedule rotation
schedule('0 0 * * *', rotateCredentials); // Daily check
```

### 6.3 Access Control

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "AWS": "arn:aws:iam::ACCOUNT_ID:role/scada-lambda-role"
      },
      "Action": "secretsmanager:GetSecretValue",
      "Resource": "arn:aws:secretsmanager:us-east-1:ACCOUNT_ID:secret:scada/*"
    }
  ]
}
```

### 6.4 Environment Variables - DO NOT USE

```bash
# ❌ NEVER DO THIS:
export DB_PASSWORD="secret_password"
export SNMP_AUTH_PASS="snmp_secret"

# ✅ INSTEAD, retrieve from Secrets Manager:
SNMP_CREDS=$(aws secretsmanager get-secret-value --secret-id scada/snmp/credentials)
```

---

## 7. AWS IAM Security

### 7.1 Least Privilege Principles

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "SnmpCollectorPolicy",
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": "arn:aws:secretsmanager:*:*:secret:scada/snmp/*",
      "Condition": {
        "StringEquals": {
          "aws:RequestedRegion": "us-east-1"
        }
      }
    },
    {
      "Sid": "IoTPublish",
      "Effect": "Allow",
      "Action": [
        "iot:Publish"
      ],
      "Resource": "arn:aws:iot:us-east-1:*:topic/scada/telemetry"
    }
  ]
}
```

### 7.2 MFA Requirements

- ✅ Enable MFA for all AWS console users
- ✅ Require MFA for sensitive operations
- ✅ Use hardware MFA tokens for admin accounts
- ✅ Monitor MFA usage

### 7.3 Key Rotation

```bash
# Rotate AWS access keys every 90 days
# For programmatic access, use temporary credentials

# AWS STS for temporary credentials
aws sts assume-role \
  --role-arn arn:aws:iam::ACCOUNT_ID:role/scada-collector-role \
  --role-session-name scada-collector-session \
  --duration-seconds 3600
```

### 7.4 CloudTrail Logging

```hcl
# Terraform: CloudTrail configuration
resource "aws_cloudtrail" "scada" {
  name           = "scada-cloudtrail"
  s3_bucket_name = aws_s3_bucket.audit_logs.id
  depends_on     = [aws_s3_bucket_policy.audit_logs]

  enable_log_file_validation = true
  is_multi_region_trail      = true

  event_selector {
    include_management_events = true
    read_write_type           = "All"

    data_resource {
      type   = "AWS::Lambda::Function"
      values = ["arn:aws:lambda:*:*:function/*"]
    }
  }
}
```

---

## 8. Application Security

### 8.1 Dependency Management

```bash
# Regular security audits
npm audit

# Update dependencies
npm update

# Fix vulnerabilities
npm audit fix

# Use snyk for continuous monitoring
snyk test
```

### 8.2 Code Review Security

- ✅ Require peer review of all code changes
- ✅ Enforce branch protection rules
- ✅ Scan for secrets in commits
- ✅ Check for vulnerable dependencies
- ✅ Use static analysis tools (ESLint, SonarQube)

```bash
# Pre-commit hook for secret detection
git clone https://github.com/gitleaks/gitleaks
gitleaks detect --source . --report-path=gitleaks-report.json
```

### 8.3 Error Handling and Logging

```typescript
// Secure error handling - never leak sensitive data
try {
  await database.query('...');
} catch (error) {
  // ✅ Log error details securely
  logger.error('Database query failed', {
    code: (error as any).code,
    message: 'Query execution error', // Don't expose query details
    timestamp: new Date().toISOString(),
  });

  // ✅ Send generic error to client
  res.status(500).json({
    error: 'An internal error occurred',
    requestId: req.id,
  });

  // ❌ Never do this:
  // res.status(500).json(error);
}
```

### 8.4 Secure Logging

```typescript
// Never log sensitive data
const secureLog = (message: string, data: unknown) => {
  const sanitized = sanitizeForLogging(data);
  logger.info(message, sanitized);
};

const sanitizeForLogging = (obj: any): any => {
  const sensitive = ['password', 'token', 'secret', 'key', 'auth'];

  if (typeof obj !== 'object') return obj;

  const cleaned: any = Array.isArray(obj) ? [...obj] : { ...obj };

  for (const key in cleaned) {
    if (sensitive.some((s) => key.toLowerCase().includes(s))) {
      cleaned[key] = '[REDACTED]';
    } else if (typeof cleaned[key] === 'object') {
      cleaned[key] = sanitizeForLogging(cleaned[key]);
    }
  }

  return cleaned;
};
```

---

## 9. Compliance Checklist

Use this checklist to verify security hardening:

### SNMP Security
- [ ] All devices use SNMPv3
- [ ] Authentication enabled (SHA-256 minimum)
- [ ] Privacy/encryption enabled (AES-256)
- [ ] All SNMPv1/v2c access disabled
- [ ] SNMP credentials rotated every 90 days

### TLS/Encryption
- [ ] All APIs use HTTPS/TLS 1.2+
- [ ] All certificate validity ≤ 1 year
- [ ] Certificate expiration monitoring enabled
- [ ] Only strong cipher suites allowed
- [ ] MQTT connections use TLS 1.2+

### API Security
- [ ] API key authentication required
- [ ] JWT tokens with max 1-hour expiration
- [ ] Rate limiting enforced
- [ ] CORS properly configured
- [ ] Input validation on all endpoints
- [ ] Output encoding to prevent XSS

### Database Security
- [ ] All connections require SSL
- [ ] Encryption at rest enabled
- [ ] Encryption in transit enabled
- [ ] Audit logging enabled
- [ ] Row-level security implemented
- [ ] Passwords rotated every 90 days
- [ ] IAM database authentication enabled

### Network Security
- [ ] Default-deny firewall policy
- [ ] Security groups properly configured
- [ ] VPC endpoint for AWS services
- [ ] NACLs restrict unnecessary traffic
- [ ] DDoS protection enabled
- [ ] WAF rules configured

### Secrets Management
- [ ] No secrets in .env files
- [ ] All credentials in Secrets Manager
- [ ] Credential rotation automated
- [ ] Secret access audited
- [ ] Resource-based policies enforced
- [ ] API keys rotated quarterly

### AWS IAM
- [ ] Least privilege roles configured
- [ ] MFA enabled for console users
- [ ] CloudTrail logging enabled
- [ ] Access keys rotated every 90 days
- [ ] Cross-account access reviewed
- [ ] No root account usage

### Logging & Monitoring
- [ ] CloudWatch alarms configured
- [ ] Security events monitored
- [ ] Failed login attempts logged
- [ ] API errors tracked
- [ ] Database queries audited
- [ ] Log retention: minimum 90 days

### Incident Response
- [ ] Incident response plan documented
- [ ] Contact procedures defined
- [ ] Recovery procedures tested
- [ ] Backup restoration tested
- [ ] Post-incident review process established

---

## 10. Security Testing

### 10.1 Vulnerability Scanning

```bash
# Dependency vulnerability scanning
npm audit

# Container image scanning
aws ecr start-image-scan \
  --repository-name scada-topology \
  --image-id imageTag=latest

# SAST (Static Application Security Testing)
snyk test --severity-threshold=high
```

### 10.2 Penetration Testing

- Schedule annual penetration tests
- Test all entry points (APIs, WebSocket, collectors)
- Verify authentication/authorization
- Test rate limiting effectiveness
- Verify encryption in transit and at rest

### 10.3 Configuration Review

```bash
# Regular security configuration audits
aws ec2 describe-security-groups
aws rds describe-db-instances
aws lambda list-functions
aws s3api list-buckets

# Verify encryption status
aws s3api head-bucket --bucket scada-topology-backups
aws rds describe-db-instances --query 'DBInstances[].StorageEncrypted'
```

---

## 11. Incident Response

### 11.1 Security Incident Procedures

1. **Detection**: Monitor CloudWatch alarms, logs, and security alerts
2. **Isolation**: Disable affected accounts/resources immediately
3. **Preservation**: Collect logs and evidence before remediation
4. **Investigation**: Determine scope and impact
5. **Remediation**: Implement fixes and deploy patches
6. **Verification**: Confirm incident is resolved
7. **Post-Mortem**: Review incident and update procedures

### 11.2 Escalation Path

```
Severity 1 (Critical):
  - Immediate notification to security team
  - Escalate to CTO/Management within 15 minutes
  - Activate incident response team

Severity 2 (High):
  - Notify security team within 1 hour
  - Management notification within 4 hours

Severity 3 (Medium):
  - Notify security team within business hours
  - Ticket creation and tracking

Severity 4 (Low):
  - Regular tracking and review
```

### 11.3 Contact Information

- **Security Team Email**: security@company.com
- **Emergency Hotline**: +1-XXX-XXX-XXXX
- **Incident Response Lead**: [Name/Contact]
- **Infrastructure Team**: [Contact]

---

## 12. Regular Security Tasks

### Daily
- [ ] Review CloudWatch alarms
- [ ] Check authentication failures
- [ ] Monitor API error rates
- [ ] Verify backup completion

### Weekly
- [ ] Review security logs
- [ ] Audit access logs
- [ ] Check certificate expiration (due in 30 days)
- [ ] Review failed API requests

### Monthly
- [ ] Rotate credentials (if not automated)
- [ ] Update certificates
- [ ] Full backup verification
- [ ] Capacity planning review
- [ ] Security audit

### Quarterly
- [ ] Disaster recovery drill
- [ ] Security assessment
- [ ] Penetration test review
- [ ] Policy updates
- [ ] Compliance checklist review

### Annually
- [ ] Full security audit
- [ ] Penetration test
- [ ] Policy review and update
- [ ] Compliance certification
- [ ] Staff security training

---

## References

- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [IEC 62443 Standard](https://www.iec.ch/webstore/publication/62443)
- [NERC CIP Standards](https://www.nerc.net/pages/default.aspx?x=1)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [AWS Security Best Practices](https://aws.amazon.com/security/best-practices/)
- [PostgreSQL Security](https://www.postgresql.org/docs/current/sql-syntax.html)

---

**Last Updated**: 2026-02-08
**Version**: 1.0
**Maintained By**: Security Team

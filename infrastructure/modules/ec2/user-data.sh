#!/bin/bash
set -e

# Install dependencies (Node 18 via AWS-built binary for AL2; yum nodejs18 not reliably available)
yum update -y
yum install -y git jq
curl -sL "https://d3rnber7ry90et.cloudfront.net/linux-x86_64/node-v18.17.1.tar.gz" -o /tmp/node.tar.gz
mkdir -p /usr/local/node18
tar -xzf /tmp/node.tar.gz -C /tmp
mv /tmp/node-v18.17.1/* /usr/local/node18/
rm -rf /tmp/node.tar.gz /tmp/node-v18.17.1
ln -sf /usr/local/node18/bin/node /usr/local/bin/node
ln -sf /usr/local/node18/bin/npm /usr/local/bin/npm

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# Create application directory
mkdir -p /opt/scada
cd /opt/scada

# Deployment: S3 tarball (preferred) or git repo or minimal structure
if [ -n "${s3_deploy_bucket}" ] && [ -n "${s3_deploy_key}" ]; then
  aws s3 cp "s3://${s3_deploy_bucket}/${s3_deploy_key}" /tmp/scada-app.tar.gz --region "${region}"
  tar -xzf /tmp/scada-app.tar.gz -C /opt/scada
  rm -f /tmp/scada-app.tar.gz
elif [ -n "${repo_url}" ]; then
  git clone -b "${branch}" "${repo_url}" .
  npm install --production
  npm run build
else
  mkdir -p src/ec2 certs dist/ec2
fi
mkdir -p /opt/scada/logs
chown -R ec2-user:ec2-user /opt/scada

# IoT certificates: fetch from Secrets Manager (cert + private key; describe-certificate does not return key)
mkdir -p /opt/scada/certs
curl -o /opt/scada/certs/AmazonRootCA1.pem https://www.amazontrust.com/repository/AmazonRootCA1.pem

if [ -n "${ec2_iot_secret_arn}" ]; then
  aws secretsmanager get-secret-value --secret-id "${ec2_iot_secret_arn}" --region "${region}" --query SecretString --output text | jq -r '.certificatePem' > /opt/scada/certs/certificate.pem.crt
  aws secretsmanager get-secret-value --secret-id "${ec2_iot_secret_arn}" --region "${region}" --query SecretString --output text | jq -r '.privateKey' > /opt/scada/certs/private.pem.key
else
  if [ -n "${iot_certificate_arn}" ]; then
    echo "${iot_certificate_arn}" | awk -F'/' '{print $NF}' > /tmp/cert_id
    aws iot describe-certificate --certificate-id "`cat /tmp/cert_id`" --region "${region}" --query certificateDescription.certificatePem --output text > /opt/scada/certs/certificate.pem.crt 2>/dev/null || true
  fi
fi

# RDS credentials: fetch and write to env file for systemd (so DB_* are available to the service)
aws secretsmanager get-secret-value --secret-id "${db_secret_arn}" --region "${region}" --query SecretString --output text > /tmp/db-secret.json 2>/dev/null || true
if [ -f /tmp/db-secret.json ] && [ -s /tmp/db-secret.json ]; then
  DB_HOST=$(jq -r '.host // empty' /tmp/db-secret.json)
  DB_PORT=$(jq -r '.port // 5432' /tmp/db-secret.json)
  DB_NAME=$(jq -r '.database // empty' /tmp/db-secret.json)
  DB_USER=$(jq -r '.username // empty' /tmp/db-secret.json)
  DB_PASS=$(jq -r '.password // empty' /tmp/db-secret.json)
  cat > /opt/scada/db.env << DBENV
DB_HOST=$${DB_HOST}
DB_PORT=$${DB_PORT}
DB_NAME=$${DB_NAME}
DB_USER=$${DB_USER}
DB_PASSWORD=$${DB_PASS}
DB_SSL=true
DBENV
  chmod 600 /opt/scada/db.env
  chown ec2-user:ec2-user /opt/scada/db.env 2>/dev/null || true
fi

# Systemd unit: use dist/ path (built artifact); load DB env from file if present
# Terraform templatefile substitutes ${iot_endpoint} and ${name_prefix} before EC2 runs this script
cat > /etc/systemd/system/scada-mqtt-ingest.service << SVCEOF
[Unit]
Description=SCADA MQTT to RDS Service
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/scada
EnvironmentFile=-/opt/scada/db.env
Environment=IOT_ENDPOINT=${iot_endpoint}
Environment=MQTT_TOPIC=scada/telemetry
Environment=IOT_CERT_PATH=/opt/scada/certs/certificate.pem.crt
Environment=IOT_KEY_PATH=/opt/scada/certs/private.pem.key
Environment=IOT_CA_PATH=/opt/scada/certs/AmazonRootCA1.pem
Environment=IOT_CLIENT_ID=${name_prefix}-ec2-ingest
Environment=NODE_ENV=production
Environment=DB_SSL_REJECT_UNAUTHORIZED=false
ExecStart=/usr/local/bin/node dist/ec2/mqtt-to-rds-service.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
SVCEOF

# Fallback: if dist/ec2/mqtt-to-rds-service.js does not exist, try src/ec2 (repo without build)
if [ ! -f /opt/scada/dist/ec2/mqtt-to-rds-service.js ]; then
  sed -i 's|dist/ec2/mqtt-to-rds-service.js|src/ec2/mqtt-to-rds-service.js|g' /etc/systemd/system/scada-mqtt-ingest.service
fi

chmod 600 /opt/scada/certs/*.key 2>/dev/null || true
chmod 644 /opt/scada/certs/*.crt /opt/scada/certs/*.pem 2>/dev/null || true

systemctl daemon-reload
systemctl enable scada-mqtt-ingest
systemctl start scada-mqtt-ingest || true
systemctl status scada-mqtt-ingest || true

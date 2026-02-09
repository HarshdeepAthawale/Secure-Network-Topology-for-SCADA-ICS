#!/bin/bash
set -e

# Install dependencies
yum update -y
yum install -y nodejs18 npm git jq

# Install AWS CLI v2
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
./aws/install
rm -rf aws awscliv2.zip

# Create application directory
mkdir -p /opt/scada
cd /opt/scada

# Clone repository if provided
if [ -n "${repo_url}" ]; then
  git clone -b ${branch} ${repo_url} .
else
  # Create minimal structure if no repo
  mkdir -p src/ec2
  mkdir -p certs
fi

# Download IoT certificates
mkdir -p /opt/scada/certs

# Download Amazon Root CA
curl -o /opt/scada/certs/AmazonRootCA1.pem https://www.amazontrust.com/repository/AmazonRootCA1.pem

# Get IoT certificate and keys from certificate ARN
# Note: In production, store these in Secrets Manager for better security
# The certificate ARN is passed via Terraform variable
if [ -n "${iot_certificate_arn}" ]; then
  # Extract certificate ID from ARN (format: arn:aws:iot:region:account:cert/certificate-id)
  # Use $$ to escape $ for Terraform templatefile
  CERT_ID_VAR=$$(echo "${iot_certificate_arn}" | awk -F'/' '{print $$NF}')
  
  # Download certificate PEM
  aws iot describe-certificate \
    --certificate-id "$${CERT_ID_VAR}" \
    --region "${region}" \
    --query certificateDescription.certificatePem \
    --output text > /opt/scada/certs/certificate.pem.crt 2>/dev/null || {
    echo "Warning: Could not download certificate PEM. You may need to download it manually."
  }
  
  # Download private key (if available)
  aws iot describe-certificate \
    --certificate-id "$${CERT_ID_VAR}" \
    --region "${region}" \
    --query certificateDescription.keyPair.privateKey \
    --output text > /opt/scada/certs/private.pem.key 2>/dev/null || {
    echo "Warning: Could not download private key. You may need to download it manually."
  }
fi

# Get RDS database credentials from Secrets Manager
aws secretsmanager get-secret-value --secret-id ${db_secret_arn} --region ${region} --query SecretString --output text > /tmp/db-secret.json || true

# Install application dependencies
if [ -f package.json ]; then
  npm install --production
fi

# Create systemd service
cat > /etc/systemd/system/scada-mqtt-ingest.service <<EOF
[Unit]
Description=SCADA MQTT to RDS Service
After=network.target

[Service]
Type=simple
User=ec2-user
WorkingDirectory=/opt/scada
Environment=IOT_ENDPOINT=${iot_endpoint}
Environment=MQTT_TOPIC=scada/telemetry
Environment=IOT_CERT_PATH=/opt/scada/certs/certificate.pem.crt
Environment=IOT_KEY_PATH=/opt/scada/certs/private.pem.key
Environment=IOT_CA_PATH=/opt/scada/certs/AmazonRootCA1.pem
Environment=IOT_CLIENT_ID=${name_prefix}-ec2-ingest
Environment=NODE_ENV=production
ExecStart=/usr/bin/node src/ec2/mqtt-to-rds-service.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

# Set proper permissions on certificates
chmod 600 /opt/scada/certs/*.key 2>/dev/null || true
chmod 644 /opt/scada/certs/*.crt /opt/scada/certs/*.pem 2>/dev/null || true

# Enable and start service
systemctl daemon-reload
systemctl enable scada-mqtt-ingest
systemctl start scada-mqtt-ingest

# Log status
systemctl status scada-mqtt-ingest || true

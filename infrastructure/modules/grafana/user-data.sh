#!/bin/bash
set -e

# Install Docker and jq
yum update -y
yum install -y docker jq
systemctl enable docker
systemctl start docker

# Create Grafana provisioning dirs
mkdir -p /opt/grafana/provisioning/datasources
mkdir -p /opt/grafana/provisioning/dashboards
mkdir -p /opt/grafana/data
chown -R ec2-user:ec2-user /opt/grafana

# Fetch RDS secret and write datasource YAML
aws secretsmanager get-secret-value --secret-id "${db_secret_arn}" --region "${region}" --query SecretString --output text > /tmp/db-secret.json
DB_HOST=$(jq -r '.host // empty' /tmp/db-secret.json)
DB_PORT=$(jq -r '.port // 5432' /tmp/db-secret.json)
DB_NAME=$(jq -r '.database // empty' /tmp/db-secret.json)
DB_USER=$(jq -r '.username // empty' /tmp/db-secret.json)
DB_PASS=$(jq -r '.password // empty' /tmp/db-secret.json)
# Escape single quotes in password for YAML
DB_PASS_ESC=$(echo "$DB_PASS" | sed "s/'/''/g")

cat > /opt/grafana/provisioning/datasources/postgres.yaml << EOF
apiVersion: 1

datasources:
  - name: PostgreSQL
    type: postgres
    uid: postgres
    url: $${DB_HOST}:$${DB_PORT}
    database: $${DB_NAME}
    user: $${DB_USER}
    secureJsonData:
      password: '$${DB_PASS_ESC}'
    jsonData:
      sslmode: require
      maxOpenConns: 10
      maxIdleConns: 5
      connMaxLifetime: 14400
      postgresVersion: 1500
      timescaledb: false
    isDefault: true
    editable: false
EOF
chown ec2-user:ec2-user /opt/grafana/provisioning/datasources/postgres.yaml

# Download dashboards from S3 if bucket/key provided
if [ -n "${s3_dashboards_bucket}" ] && [ -n "${s3_dashboards_key}" ]; then
  aws s3 cp "s3://${s3_dashboards_bucket}/${s3_dashboards_key}" /tmp/grafana-dashboards.zip --region "${region}"
  unzip -o /tmp/grafana-dashboards.zip -d /tmp/grafana-dashboards-extract
  if [ -d /tmp/grafana-dashboards-extract/dashboards ]; then
    cp -r /tmp/grafana-dashboards-extract/dashboards/* /opt/grafana/provisioning/dashboards/
  else
    cp -r /tmp/grafana-dashboards-extract/* /opt/grafana/provisioning/dashboards/
  fi
  chown -R ec2-user:ec2-user /opt/grafana/provisioning/dashboards
  rm -rf /tmp/grafana-dashboards.zip /tmp/grafana-dashboards-extract
fi

# Run Grafana container (same image and plugins as local docker-compose)
docker run -d \
  --name grafana \
  --restart unless-stopped \
  -p 3000:3000 \
  -e GF_SECURITY_ADMIN_USER=admin \
  -e GF_SECURITY_ADMIN_PASSWORD="${grafana_admin_password_esc}" \
  -e GF_INSTALL_PLUGINS=grafana-clock-panel,grafana-piechart-panel,marcusolsson-treemap-panel \
  -e GF_FEATURE_TOGGLES_ENABLE=nodeGraph \
  -e GF_SERVER_HTTP_ADDR=0.0.0.0 \
  -v /opt/grafana/provisioning/datasources:/etc/grafana/provisioning/datasources:ro \
  -v /opt/grafana/provisioning/dashboards:/etc/grafana/provisioning/dashboards:ro \
  -v /opt/grafana/data:/var/lib/grafana \
  grafana/grafana:10.2.0

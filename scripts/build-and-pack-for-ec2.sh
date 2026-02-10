#!/bin/bash
# Build the app and pack dist/, node_modules/, and package.json for EC2 S3 deploy.
# Output: scada-app.tar.gz in project root (or OUT_DIR).
# Usage: ./scripts/build-and-pack-for-ec2.sh [OUT_DIR]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
OUT_DIR="${1:-$ROOT}"
cd "$ROOT"

echo "Building..."
npm ci
npm run build

echo "Packing for EC2 (dist + node_modules + package.json)..."
tar -czvf "$OUT_DIR/scada-app.tar.gz" \
  dist \
  node_modules \
  package.json \
  package-lock.json

echo "Created: $OUT_DIR/scada-app.tar.gz"
echo "Upload: aws s3 cp $OUT_DIR/scada-app.tar.gz s3://YOUR_DEPLOY_BUCKET/deploys/scada-app-$(date +%Y%m%d-%H%M).tar.gz --region YOUR_REGION"
echo "Then set ec2_s3_deploy_bucket and ec2_s3_deploy_key and replace EC2 instance (terraform taint module.ec2.aws_instance.mqtt_ingest && terraform apply)."

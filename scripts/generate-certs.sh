#!/bin/bash
# Generate TLS certificates for MQTT/IoT communication

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$PROJECT_ROOT/certs"

THING_NAME="${1:-scada-collector}"
DAYS_VALID="${2:-365}"

echo "=========================================="
echo "SCADA Topology Discovery - Certificate Gen"
echo "Thing Name: $THING_NAME"
echo "Valid for: $DAYS_VALID days"
echo "=========================================="

mkdir -p "$CERTS_DIR"
cd "$CERTS_DIR"

# Download Amazon Root CA
echo "Downloading Amazon Root CA..."
curl -s -o root-CA.crt https://www.amazontrust.com/repository/AmazonRootCA1.pem

# Generate private key
echo "Generating private key..."
openssl genrsa -out private.pem.key 2048

# Generate CSR
echo "Generating certificate signing request..."
openssl req -new -key private.pem.key -out device.csr \
  -subj "/CN=$THING_NAME/O=SCADA Topology Discovery/C=US"

# Self-sign for development (in production, use AWS IoT)
echo "Generating self-signed certificate..."
openssl x509 -req -in device.csr -signkey private.pem.key \
  -out device.pem.crt -days "$DAYS_VALID"

# Set permissions
chmod 600 private.pem.key
chmod 644 device.pem.crt root-CA.crt

echo ""
echo "Certificates generated in: $CERTS_DIR"
echo "  - root-CA.crt     : Amazon Root CA"
echo "  - device.pem.crt  : Device certificate"
echo "  - private.pem.key : Private key"
echo ""
echo "NOTE: For production, register the certificate with AWS IoT Core"

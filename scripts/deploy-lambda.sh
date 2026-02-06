#!/bin/bash
# Build and deploy Lambda functions

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

ENVIRONMENT="${1:-dev}"
FUNCTION="${2:-all}"

echo "=========================================="
echo "SCADA Topology Discovery - Lambda Deploy"
echo "Environment: $ENVIRONMENT"
echo "Function: $FUNCTION"
echo "=========================================="

cd "$PROJECT_ROOT"

# Build TypeScript
echo "Building TypeScript..."
npm run build

# Create deployment package
echo "Creating deployment package..."
DIST_DIR="$PROJECT_ROOT/dist"
PACKAGE_DIR="$PROJECT_ROOT/.lambda-package"
rm -rf "$PACKAGE_DIR"
mkdir -p "$PACKAGE_DIR"

# Copy compiled code
cp -r "$DIST_DIR"/* "$PACKAGE_DIR/"

# Copy production dependencies
cp package.json "$PACKAGE_DIR/"
cd "$PACKAGE_DIR"
npm install --production --ignore-scripts

# Create zip
cd "$PACKAGE_DIR"
zip -r "$PROJECT_ROOT/lambda-package.zip" .

# Deploy to AWS
FUNCTIONS=("ingest" "process" "query" "export")
if [ "$FUNCTION" != "all" ]; then
  FUNCTIONS=("$FUNCTION")
fi

for fn in "${FUNCTIONS[@]}"; do
  FUNCTION_NAME="scada-$ENVIRONMENT-$fn"
  echo "Deploying $FUNCTION_NAME..."

  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --zip-file "fileb://$PROJECT_ROOT/lambda-package.zip" \
    --publish || echo "Warning: Function $FUNCTION_NAME may not exist yet"
done

# Cleanup
rm -rf "$PACKAGE_DIR"

echo "Lambda deployment complete!"

#!/bin/bash
# Bootstrap AWS Infrastructure for Terraform State Management
# Run this ONCE before deploying the main infrastructure

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BOOTSTRAP_DIR="$PROJECT_ROOT/infrastructure/bootstrap"

AWS_REGION="${AWS_REGION:-ap-south-1}"

echo "=============================================="
echo "SCADA Topology Discovery - Bootstrap Setup"
echo "=============================================="
echo "AWS Region: $AWS_REGION"
echo ""

# Verify AWS credentials
echo "Verifying AWS credentials..."
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account: $AWS_ACCOUNT"
echo ""

# Initialize and apply bootstrap infrastructure
cd "$BOOTSTRAP_DIR"

echo "Initializing Terraform bootstrap..."
terraform init -upgrade

echo ""
echo "Planning bootstrap infrastructure..."
terraform plan -var="aws_region=$AWS_REGION" -out=bootstrap.tfplan

echo ""
read -p "Apply bootstrap infrastructure? (yes/no): " confirm
if [ "$confirm" = "yes" ]; then
    echo "Applying bootstrap infrastructure..."
    terraform apply bootstrap.tfplan

    echo ""
    echo "=============================================="
    echo "Bootstrap Complete!"
    echo "=============================================="
    terraform output

    # Get bucket name for main config
    BUCKET_NAME=$(terraform output -raw state_bucket_name)

    echo ""
    echo "NEXT STEPS:"
    echo "1. Update infrastructure/main.tf with the backend config shown above"
    echo "2. Run: ./scripts/deploy-infrastructure.sh dev apply"
    echo ""
else
    echo "Bootstrap cancelled."
    rm -f bootstrap.tfplan
fi

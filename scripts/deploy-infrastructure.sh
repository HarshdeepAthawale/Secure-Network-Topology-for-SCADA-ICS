#!/bin/bash
# Deploy AWS Infrastructure using Terraform

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
INFRA_DIR="$PROJECT_ROOT/infrastructure"

ENVIRONMENT="${1:-dev}"
ACTION="${2:-plan}"

echo "=============================================="
echo "  SCADA Topology Discovery - Infrastructure   "
echo "=============================================="
echo ""
echo "Environment: $ENVIRONMENT"
echo "Action:      $ACTION"
echo ""

# Verify AWS credentials
echo "Verifying AWS credentials..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
    echo "ERROR: AWS credentials not configured."
    echo "Run 'aws configure' to set up credentials."
    exit 1
fi

AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
AWS_REGION=$(aws configure get region || echo "ap-south-1")
AWS_USER=$(aws sts get-caller-identity --query Arn --output text | rev | cut -d'/' -f1 | rev)

echo "AWS Account: $AWS_ACCOUNT"
echo "AWS Region:  $AWS_REGION"
echo "AWS User:    $AWS_USER"
echo ""

cd "$INFRA_DIR"

# Check if bootstrap has been run
if [ "$ACTION" != "output" ] && [ ! -f ".terraform/terraform.tfstate" ]; then
    echo "Checking for Terraform state backend..."
    if ! aws s3 ls "s3://scada-topology-terraform-state-$AWS_ACCOUNT" > /dev/null 2>&1; then
        echo ""
        echo "WARNING: Terraform state bucket not found."
        echo "If this is your first deployment, run:"
        echo "  ./scripts/bootstrap-infrastructure.sh"
        echo ""
        echo "Then update infrastructure/main.tf with the S3 backend."
        echo ""
    fi
fi

# Initialize Terraform
echo "Initializing Terraform..."
terraform init -upgrade

# Select/create workspace
terraform workspace select "$ENVIRONMENT" 2>/dev/null || terraform workspace new "$ENVIRONMENT"

# Execute action
case "$ACTION" in
  plan)
    echo "Planning infrastructure changes..."
    terraform plan -var="environment=$ENVIRONMENT" -out=tfplan
    ;;
  apply)
    echo "Applying infrastructure changes..."
    terraform apply -var="environment=$ENVIRONMENT" -auto-approve
    ;;
  destroy)
    echo "WARNING: Destroying infrastructure..."
    read -p "Are you sure? (yes/no): " confirm
    if [ "$confirm" = "yes" ]; then
      terraform destroy -var="environment=$ENVIRONMENT" -auto-approve
    fi
    ;;
  output)
    terraform output -json
    ;;
  *)
    echo "Usage: $0 <environment> <plan|apply|destroy|output>"
    exit 1
    ;;
esac

echo "Done!"

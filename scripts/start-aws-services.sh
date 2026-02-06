#!/bin/bash
# =============================================================================
# SCADA Topology - Start AWS Services Script
# Restarts AWS resources after being stopped to save costs
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
AWS_REGION="${AWS_REGION:-ap-south-1}"
ENVIRONMENT="${ENVIRONMENT:-dev}"
NAME_PREFIX="scada-${ENVIRONMENT}"
RDS_IDENTIFIER="${NAME_PREFIX}-postgres"

# -----------------------------------------------------------------------------
# Helper Functions
# -----------------------------------------------------------------------------
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo ""
    echo "============================================================"
    echo -e "${BLUE}$1${NC}"
    echo "============================================================"
}

check_aws_cli() {
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI is not installed. Please install it first."
        exit 1
    fi

    if ! aws sts get-caller-identity &> /dev/null; then
        log_error "AWS credentials not configured. Run 'aws configure' first."
        exit 1
    fi

    log_success "AWS CLI configured for account: $(aws sts get-caller-identity --query Account --output text)"
}

# -----------------------------------------------------------------------------
# Start RDS Instance
# -----------------------------------------------------------------------------
start_rds() {
    print_header "Starting RDS Instance"

    # Check if RDS instance exists
    RDS_STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier "$RDS_IDENTIFIER" \
        --region "$AWS_REGION" \
        --query 'DBInstances[0].DBInstanceStatus' \
        --output text 2>/dev/null || echo "not-found")

    if [ "$RDS_STATUS" = "not-found" ]; then
        log_warn "RDS instance '$RDS_IDENTIFIER' not found."
        log_info "Run 'terraform apply' to create the infrastructure first."
        return 1
    fi

    if [ "$RDS_STATUS" = "available" ]; then
        log_success "RDS instance is already running."
        return 0
    fi

    if [ "$RDS_STATUS" = "starting" ]; then
        log_info "RDS instance is already starting..."
        return 0
    fi

    if [ "$RDS_STATUS" = "stopped" ]; then
        log_info "Starting RDS instance: $RDS_IDENTIFIER"
        aws rds start-db-instance \
            --db-instance-identifier "$RDS_IDENTIFIER" \
            --region "$AWS_REGION" > /dev/null
        log_success "RDS start initiated. It will be available in 5-10 minutes."
        return 0
    fi

    log_warn "RDS instance is in '$RDS_STATUS' state. Please wait or check AWS Console."
    return 1
}

# -----------------------------------------------------------------------------
# Wait for RDS to be Available
# -----------------------------------------------------------------------------
wait_for_rds() {
    print_header "Waiting for RDS to be Available"

    log_info "This may take 5-10 minutes..."

    TIMEOUT=600  # 10 minutes
    ELAPSED=0
    INTERVAL=30

    while [ $ELAPSED -lt $TIMEOUT ]; do
        RDS_STATUS=$(aws rds describe-db-instances \
            --db-instance-identifier "$RDS_IDENTIFIER" \
            --region "$AWS_REGION" \
            --query 'DBInstances[0].DBInstanceStatus' \
            --output text 2>/dev/null || echo "not-found")

        if [ "$RDS_STATUS" = "available" ]; then
            log_success "RDS instance is now available!"

            # Get endpoint
            RDS_ENDPOINT=$(aws rds describe-db-instances \
                --db-instance-identifier "$RDS_IDENTIFIER" \
                --region "$AWS_REGION" \
                --query 'DBInstances[0].Endpoint.Address' \
                --output text)

            log_info "RDS Endpoint: $RDS_ENDPOINT"
            return 0
        fi

        echo -ne "\r  Status: $RDS_STATUS | Elapsed: ${ELAPSED}s / ${TIMEOUT}s"
        sleep $INTERVAL
        ELAPSED=$((ELAPSED + INTERVAL))
    done

    echo ""
    log_error "Timeout waiting for RDS. Check AWS Console for status."
    return 1
}

# -----------------------------------------------------------------------------
# Recreate NAT Gateways via Terraform
# -----------------------------------------------------------------------------
recreate_infrastructure() {
    print_header "Recreating Infrastructure (NAT Gateways, etc.)"

    # Check if NAT Gateway exists
    NAT_GATEWAYS=$(aws ec2 describe-nat-gateways \
        --region "$AWS_REGION" \
        --filter "Name=state,Values=available" \
        --query "NatGateways[?Tags[?Key=='Project' && Value=='scada-topology-discovery']].NatGatewayId" \
        --output text 2>/dev/null || echo "")

    if [ -n "$NAT_GATEWAYS" ]; then
        log_info "NAT Gateway already exists: $NAT_GATEWAYS"
    else
        log_warn "NAT Gateway not found. Running Terraform to recreate..."

        cd "$(dirname "$0")/../infrastructure"

        # Initialize if needed
        if [ ! -d ".terraform" ]; then
            log_info "Initializing Terraform..."
            terraform init
        fi

        log_info "Applying Terraform (this will recreate missing resources)..."
        terraform apply -auto-approve -var="environment=${ENVIRONMENT}"

        log_success "Infrastructure recreated."
    fi
}

# -----------------------------------------------------------------------------
# Enable Lambda Triggers
# -----------------------------------------------------------------------------
enable_lambda_triggers() {
    print_header "Enabling Lambda Event Sources"

    LAMBDA_FUNCTIONS=("${NAME_PREFIX}-ingest" "${NAME_PREFIX}-process" "${NAME_PREFIX}-query" "${NAME_PREFIX}-export")

    for FUNC in "${LAMBDA_FUNCTIONS[@]}"; do
        # Check if function exists
        if aws lambda get-function --function-name "$FUNC" --region "$AWS_REGION" &> /dev/null; then
            # Get disabled event source mappings
            MAPPINGS=$(aws lambda list-event-source-mappings \
                --function-name "$FUNC" \
                --region "$AWS_REGION" \
                --query 'EventSourceMappings[?State==`Disabled`].UUID' \
                --output text 2>/dev/null || echo "")

            for UUID in $MAPPINGS; do
                log_info "Enabling event source for $FUNC: $UUID"
                aws lambda update-event-source-mapping \
                    --uuid "$UUID" \
                    --enabled true \
                    --region "$AWS_REGION" > /dev/null 2>&1 || true
            done
        fi
    done

    log_info "Lambda triggers enabled (if any existed)."
}

# -----------------------------------------------------------------------------
# Enable IoT Rules
# -----------------------------------------------------------------------------
enable_iot_rules() {
    print_header "Enabling IoT Rules"

    IOT_RULES=$(aws iot list-topic-rules \
        --region "$AWS_REGION" \
        --query "rules[?contains(ruleName, 'scada')].ruleName" \
        --output text 2>/dev/null || echo "")

    if [ -z "$IOT_RULES" ]; then
        log_info "No IoT rules found for this project."
        return
    fi

    for RULE in $IOT_RULES; do
        log_info "Enabling IoT rule: $RULE"
        aws iot enable-topic-rule \
            --rule-name "$RULE" \
            --region "$AWS_REGION" 2>/dev/null || true
    done

    log_success "IoT rules enabled."
}

# -----------------------------------------------------------------------------
# Check Overall Status
# -----------------------------------------------------------------------------
check_status() {
    print_header "Service Status Check"

    echo ""
    echo "Checking all services..."
    echo ""

    # RDS Status
    RDS_STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier "$RDS_IDENTIFIER" \
        --region "$AWS_REGION" \
        --query 'DBInstances[0].DBInstanceStatus' \
        --output text 2>/dev/null || echo "not-found")
    echo -e "  RDS Instance:     ${RDS_STATUS}"

    # NAT Gateway
    NAT_COUNT=$(aws ec2 describe-nat-gateways \
        --region "$AWS_REGION" \
        --filter "Name=state,Values=available" \
        --query "length(NatGateways[?Tags[?Key=='Project' && Value=='scada-topology-discovery']])" \
        --output text 2>/dev/null || echo "0")
    echo -e "  NAT Gateways:     ${NAT_COUNT} available"

    # Lambda Functions
    for FUNC in "${NAME_PREFIX}-ingest" "${NAME_PREFIX}-process"; do
        if aws lambda get-function --function-name "$FUNC" --region "$AWS_REGION" &> /dev/null; then
            echo -e "  Lambda ($FUNC): active"
        else
            echo -e "  Lambda ($FUNC): not found"
        fi
    done

    # IoT Rules
    IOT_ENABLED=$(aws iot list-topic-rules \
        --region "$AWS_REGION" \
        --query "length(rules[?contains(ruleName, 'scada') && ruleDisabled==\`false\`])" \
        --output text 2>/dev/null || echo "0")
    echo -e "  IoT Rules:        ${IOT_ENABLED} enabled"

    echo ""
}

# -----------------------------------------------------------------------------
# Deploy from Scratch
# -----------------------------------------------------------------------------
deploy_fresh() {
    print_header "Fresh Deployment"

    cd "$(dirname "$0")/../infrastructure"

    # Bootstrap if needed
    if ! aws s3 ls "s3://scada-topology-terraform-state-$(aws sts get-caller-identity --query Account --output text)" &> /dev/null; then
        log_info "Running bootstrap..."
        bash ../scripts/bootstrap-infrastructure.sh
    fi

    # Initialize Terraform
    log_info "Initializing Terraform..."
    terraform init

    # Plan
    log_info "Creating plan..."
    terraform plan -var="environment=${ENVIRONMENT}" -out=tfplan

    # Apply
    read -p "Apply this plan? (y/N): " CONFIRM
    if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
        terraform apply tfplan
        log_success "Infrastructure deployed!"
    else
        log_info "Deployment cancelled."
    fi
}

# -----------------------------------------------------------------------------
# Main Menu
# -----------------------------------------------------------------------------
main() {
    echo ""
    echo "============================================================"
    echo -e "${GREEN}  SCADA Topology - AWS Start Services Script${NC}"
    echo "============================================================"
    echo ""

    check_aws_cli

    echo ""
    echo "Select an option:"
    echo "  1) Start RDS only"
    echo "  2) Start RDS and wait until available"
    echo "  3) Full start (RDS + recreate NAT + enable triggers)"
    echo "  4) Check current service status"
    echo "  5) Fresh deployment (terraform apply)"
    echo "  6) Exit"
    echo ""
    read -p "Enter choice [1-6]: " CHOICE

    case $CHOICE in
        1)
            start_rds
            ;;
        2)
            start_rds
            wait_for_rds
            ;;
        3)
            start_rds
            recreate_infrastructure
            enable_lambda_triggers
            enable_iot_rules
            check_status
            ;;
        4)
            check_status
            ;;
        5)
            deploy_fresh
            ;;
        6)
            log_info "Exiting."
            exit 0
            ;;
        *)
            log_error "Invalid choice."
            exit 1
            ;;
    esac

    echo ""
    log_success "Done!"
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

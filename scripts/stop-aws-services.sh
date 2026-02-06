#!/bin/bash
# =============================================================================
# SCADA Topology - Stop AWS Services Script
# Stops/pauses AWS resources to minimize costs when not in use
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
# Stop RDS Instance
# -----------------------------------------------------------------------------
stop_rds() {
    print_header "Stopping RDS Instance"

    # Check if RDS instance exists
    RDS_STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier "$RDS_IDENTIFIER" \
        --region "$AWS_REGION" \
        --query 'DBInstances[0].DBInstanceStatus' \
        --output text 2>/dev/null || echo "not-found")

    if [ "$RDS_STATUS" = "not-found" ]; then
        log_warn "RDS instance '$RDS_IDENTIFIER' not found. Skipping."
        return
    fi

    if [ "$RDS_STATUS" = "stopped" ]; then
        log_info "RDS instance is already stopped."
        return
    fi

    if [ "$RDS_STATUS" = "stopping" ]; then
        log_info "RDS instance is already stopping..."
        return
    fi

    if [ "$RDS_STATUS" = "available" ]; then
        log_info "Stopping RDS instance: $RDS_IDENTIFIER"
        aws rds stop-db-instance \
            --db-instance-identifier "$RDS_IDENTIFIER" \
            --region "$AWS_REGION" > /dev/null
        log_success "RDS stop initiated. It will stop within a few minutes."
        log_warn "Note: RDS auto-starts after 7 days. Re-run this script weekly if needed."
    else
        log_warn "RDS instance is in '$RDS_STATUS' state. Cannot stop."
    fi
}

# -----------------------------------------------------------------------------
# Delete NAT Gateways (Optional - Major Cost Saver)
# -----------------------------------------------------------------------------
delete_nat_gateways() {
    print_header "Checking NAT Gateways"

    # Find NAT Gateways with our project tag
    NAT_GATEWAYS=$(aws ec2 describe-nat-gateways \
        --region "$AWS_REGION" \
        --filter "Name=state,Values=available" \
        --query "NatGateways[?Tags[?Key=='Project' && Value=='scada-topology-discovery']].NatGatewayId" \
        --output text 2>/dev/null || echo "")

    if [ -z "$NAT_GATEWAYS" ]; then
        log_info "No active NAT Gateways found for this project."
        return
    fi

    log_warn "Found NAT Gateway(s): $NAT_GATEWAYS"
    log_warn "NAT Gateways cost ~\$32/month even when idle!"
    echo ""
    read -p "Delete NAT Gateways to save costs? (y/N): " CONFIRM

    if [ "$CONFIRM" = "y" ] || [ "$CONFIRM" = "Y" ]; then
        for NAT_ID in $NAT_GATEWAYS; do
            log_info "Deleting NAT Gateway: $NAT_ID"
            aws ec2 delete-nat-gateway \
                --nat-gateway-id "$NAT_ID" \
                --region "$AWS_REGION" > /dev/null
            log_success "NAT Gateway $NAT_ID deletion initiated."
        done
        log_warn "You'll need to run 'terraform apply' to recreate NAT Gateways when starting."
    else
        log_info "Keeping NAT Gateways."
    fi
}

# -----------------------------------------------------------------------------
# Release Elastic IPs (if not attached)
# -----------------------------------------------------------------------------
release_unused_eips() {
    print_header "Checking Unused Elastic IPs"

    # Find unattached EIPs with our project tag
    UNUSED_EIPS=$(aws ec2 describe-addresses \
        --region "$AWS_REGION" \
        --query "Addresses[?AssociationId==null && Tags[?Key=='Project' && Value=='scada-topology-discovery']].AllocationId" \
        --output text 2>/dev/null || echo "")

    if [ -z "$UNUSED_EIPS" ]; then
        log_info "No unused Elastic IPs found."
        return
    fi

    log_warn "Found unused Elastic IP(s): $UNUSED_EIPS"
    log_warn "Unused EIPs cost ~\$3.60/month each!"

    for EIP_ID in $UNUSED_EIPS; do
        log_info "Releasing Elastic IP: $EIP_ID"
        aws ec2 release-address \
            --allocation-id "$EIP_ID" \
            --region "$AWS_REGION" 2>/dev/null || log_warn "Could not release $EIP_ID"
    done
}

# -----------------------------------------------------------------------------
# Stop/Scale Down Lambda (Disable Triggers)
# -----------------------------------------------------------------------------
disable_lambda_triggers() {
    print_header "Disabling Lambda Event Sources"

    LAMBDA_FUNCTIONS=("${NAME_PREFIX}-ingest" "${NAME_PREFIX}-process" "${NAME_PREFIX}-query" "${NAME_PREFIX}-export")

    for FUNC in "${LAMBDA_FUNCTIONS[@]}"; do
        # Check if function exists
        if aws lambda get-function --function-name "$FUNC" --region "$AWS_REGION" &> /dev/null; then
            # Get event source mappings
            MAPPINGS=$(aws lambda list-event-source-mappings \
                --function-name "$FUNC" \
                --region "$AWS_REGION" \
                --query 'EventSourceMappings[?State==`Enabled`].UUID' \
                --output text 2>/dev/null || echo "")

            for UUID in $MAPPINGS; do
                log_info "Disabling event source for $FUNC: $UUID"
                aws lambda update-event-source-mapping \
                    --uuid "$UUID" \
                    --enabled false \
                    --region "$AWS_REGION" > /dev/null 2>&1 || true
            done
        fi
    done

    log_info "Lambda triggers disabled (if any existed)."
}

# -----------------------------------------------------------------------------
# Disable IoT Rules
# -----------------------------------------------------------------------------
disable_iot_rules() {
    print_header "Disabling IoT Rules"

    IOT_RULES=$(aws iot list-topic-rules \
        --region "$AWS_REGION" \
        --query "rules[?contains(ruleName, 'scada')].ruleName" \
        --output text 2>/dev/null || echo "")

    if [ -z "$IOT_RULES" ]; then
        log_info "No IoT rules found for this project."
        return
    fi

    for RULE in $IOT_RULES; do
        log_info "Disabling IoT rule: $RULE"
        aws iot disable-topic-rule \
            --rule-name "$RULE" \
            --region "$AWS_REGION" 2>/dev/null || true
    done

    log_success "IoT rules disabled."
}

# -----------------------------------------------------------------------------
# Show Current Cost Summary
# -----------------------------------------------------------------------------
show_cost_summary() {
    print_header "Cost Summary"

    echo "Estimated monthly costs when RUNNING:"
    echo "  - RDS (db.t3.medium):     ~\$50-60/month"
    echo "  - NAT Gateway:            ~\$32/month + data transfer"
    echo "  - CloudWatch Logs:        ~\$5-10/month"
    echo "  - S3 Storage:             ~\$1-5/month"
    echo "  - Lambda (on invocation): ~\$0-5/month"
    echo "  - IoT Core (on usage):    ~\$0-5/month"
    echo "  ----------------------------------------"
    echo "  TOTAL (running):          ~\$90-120/month"
    echo ""
    echo "After stopping services:"
    echo "  - RDS stopped:            \$0 (storage still ~\$10/month)"
    echo "  - NAT deleted:            \$0"
    echo "  - Other services idle:    ~\$5-15/month"
    echo "  ----------------------------------------"
    echo "  TOTAL (stopped):          ~\$15-25/month"
}

# -----------------------------------------------------------------------------
# Full Infrastructure Destroy (Nuclear Option)
# -----------------------------------------------------------------------------
destroy_all() {
    print_header "DESTROY ALL INFRASTRUCTURE"

    log_error "WARNING: This will PERMANENTLY DELETE all AWS resources!"
    log_error "You will lose all data in RDS and S3!"
    echo ""
    read -p "Type 'DESTROY' to confirm: " CONFIRM

    if [ "$CONFIRM" != "DESTROY" ]; then
        log_info "Destruction cancelled."
        return
    fi

    cd "$(dirname "$0")/../infrastructure"

    log_warn "Running terraform destroy..."
    terraform destroy -auto-approve -var="environment=${ENVIRONMENT}"

    log_success "All infrastructure destroyed."
    log_info "Monthly AWS cost: \$0"
}

# -----------------------------------------------------------------------------
# Main Menu
# -----------------------------------------------------------------------------
main() {
    echo ""
    echo "============================================================"
    echo -e "${RED}  SCADA Topology - AWS Cost Saver Script${NC}"
    echo "============================================================"
    echo ""

    check_aws_cli

    echo ""
    echo "Select an option:"
    echo "  1) Stop RDS only (saves ~\$50/month)"
    echo "  2) Stop RDS + Delete NAT Gateway (saves ~\$80/month)"
    echo "  3) Full stop (RDS + NAT + disable triggers)"
    echo "  4) DESTROY ALL (terraform destroy - \$0/month)"
    echo "  5) Show cost summary only"
    echo "  6) Exit"
    echo ""
    read -p "Enter choice [1-6]: " CHOICE

    case $CHOICE in
        1)
            stop_rds
            show_cost_summary
            ;;
        2)
            stop_rds
            delete_nat_gateways
            release_unused_eips
            show_cost_summary
            ;;
        3)
            stop_rds
            delete_nat_gateways
            release_unused_eips
            disable_lambda_triggers
            disable_iot_rules
            show_cost_summary
            ;;
        4)
            destroy_all
            ;;
        5)
            show_cost_summary
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
    log_success "Done! Run './start-aws-services.sh' to bring services back up."
}

# Run if executed directly
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    main "$@"
fi

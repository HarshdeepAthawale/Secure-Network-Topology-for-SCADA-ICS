#!/bin/bash

#############################################################################
# SCADA Topology Discovery - Database Backup Script
#
# Purpose: Create RDS snapshots, backup configuration, and verify integrity
# Usage:   ./scripts/backup-database.sh
#          RETENTION_DAYS=30 ./scripts/backup-database.sh
#          DRY_RUN=1 ./scripts/backup-database.sh
#
# Features:
#   - Creates RDS snapshots with automatic naming
#   - Backs up configuration files to S3
#   - Verifies backup integrity
#   - Manages old snapshots (retention policy)
#   - Logs all operations
#############################################################################

set -o pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Load environment variables
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi

# Configuration
AWS_REGION="${AWS_REGION:-us-east-1}"
DB_INSTANCE_ID="${DB_INSTANCE_ID:-scada-topology-db}"
BACKUP_BUCKET="${BACKUP_BUCKET:-scada-topology-backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"
DRY_RUN="${DRY_RUN:-0}"
VERBOSE="${VERBOSE:-0}"
LOG_DIR="${LOG_DIR:-./backup-logs}"

# Timestamp
TIMESTAMP=$(date -u +%Y-%m-%dT%H:%M:%SZ)
DATE_HUMAN=$(date '+%Y-%m-%d %H:%M:%S')
BACKUP_ID=$(date +%Y%m%d-%H%M%S)
SNAPSHOT_ID="scada-backup-$BACKUP_ID"

# Ensure log directory exists
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/backup-$BACKUP_ID.log"

# Logging function
log() {
  local level="$1"
  shift
  local message="$@"
  local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

  echo "[$timestamp] [$level] $message" | tee -a "$LOG_FILE"
}

log_error() {
  echo -e "${RED}[$TIMESTAMP] [ERROR] $@${NC}" | tee -a "$LOG_FILE"
}

log_success() {
  echo -e "${GREEN}[$TIMESTAMP] [SUCCESS] $@${NC}" | tee -a "$LOG_FILE"
}

log_warning() {
  echo -e "${YELLOW}[$TIMESTAMP] [WARNING] $@${NC}" | tee -a "$LOG_FILE"
}

log_info() {
  echo -e "${BLUE}[$TIMESTAMP] [INFO] $@${NC}" | tee -a "$LOG_FILE"
}

# Validation
validate_tools() {
  log_info "Validating required tools..."

  if ! command -v aws &> /dev/null; then
    log_error "aws-cli is not installed"
    return 1
  fi

  if ! command -v tar &> /dev/null; then
    log_error "tar is not installed"
    return 1
  fi

  if ! command -v gzip &> /dev/null; then
    log_error "gzip is not installed"
    return 1
  fi

  log_success "All required tools found"
  return 0
}

# Validate AWS credentials
validate_aws() {
  log_info "Validating AWS credentials..."

  if ! aws sts get-caller-identity --region "$AWS_REGION" &>/dev/null; then
    log_error "AWS credentials validation failed"
    return 1
  fi

  log_success "AWS credentials valid"
  return 0
}

# Create RDS snapshot
create_snapshot() {
  log_info "Creating RDS snapshot: $SNAPSHOT_ID"

  if [ "$DRY_RUN" = "1" ]; then
    log_warning "DRY RUN: Would create snapshot $SNAPSHOT_ID"
    return 0
  fi

  if aws rds create-db-snapshot \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --db-snapshot-identifier "$SNAPSHOT_ID" \
    --region "$AWS_REGION" \
    --tags "Key=CreatedBy,Value=backup-script" "Key=BackupDate,Value=$DATE_HUMAN" &>> "$LOG_FILE"; then
    log_success "Snapshot creation initiated"
    return 0
  else
    log_error "Failed to create snapshot"
    return 1
  fi
}

# Wait for snapshot to complete
wait_snapshot() {
  log_info "Waiting for snapshot to complete..."

  if [ "$DRY_RUN" = "1" ]; then
    log_warning "DRY RUN: Skipping snapshot wait"
    return 0
  fi

  local max_wait=3600  # 1 hour timeout
  local elapsed=0
  local check_interval=30

  while [ $elapsed -lt $max_wait ]; do
    status=$(aws rds describe-db-snapshots \
      --db-snapshot-identifier "$SNAPSHOT_ID" \
      --region "$AWS_REGION" \
      --query 'DBSnapshots[0].Status' \
      --output text 2>/dev/null)

    case "$status" in
      available)
        log_success "Snapshot completed and available"

        # Get snapshot details
        snapshot_size=$(aws rds describe-db-snapshots \
          --db-snapshot-identifier "$SNAPSHOT_ID" \
          --region "$AWS_REGION" \
          --query 'DBSnapshots[0].AllocatedStorage' \
          --output text 2>/dev/null)

        log_info "Snapshot size: ${snapshot_size}GB"
        return 0
        ;;
      creating|backing-up)
        log_info "Snapshot status: $status (elapsed: ${elapsed}s)"
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
        ;;
      failed|deleting|invalid|incompatible)
        log_error "Snapshot failed with status: $status"
        return 1
        ;;
      *)
        log_warning "Unknown snapshot status: $status"
        sleep $check_interval
        elapsed=$((elapsed + check_interval))
        ;;
    esac
  done

  log_error "Snapshot creation timeout after ${max_wait}s"
  return 1
}

# Backup configuration files
backup_configuration() {
  log_info "Backing up configuration files..."

  if [ "$DRY_RUN" = "1" ]; then
    log_warning "DRY RUN: Would backup configuration files"
    return 0
  fi

  local config_backup="config-backup-$BACKUP_ID.tar.gz"
  local temp_dir=$(mktemp -d)

  # Copy configuration files to temp directory
  [ -d infrastructure ] && cp -r infrastructure "$temp_dir/" 2>/dev/null || true
  [ -d grafana ] && cp -r grafana "$temp_dir/" 2>/dev/null || true
  [ -d database/migrations ] && cp -r database/migrations "$temp_dir/db-migrations" 2>/dev/null || true
  [ -f .env ] && cp .env "$temp_dir/.env-backup" 2>/dev/null || true
  [ -f package.json ] && cp package.json "$temp_dir/" 2>/dev/null || true

  # Create compressed archive
  if tar -czf "$config_backup" -C "$temp_dir" . 2>> "$LOG_FILE"; then
    log_success "Configuration backup created: $config_backup"

    # Upload to S3
    if aws s3 cp "$config_backup" "s3://$BACKUP_BUCKET/config-backups/" \
      --region "$AWS_REGION" \
      --sse AES256 \
      --storage-class STANDARD_IA 2>> "$LOG_FILE"; then
      log_success "Configuration backup uploaded to S3"
      rm -f "$config_backup"
    else
      log_warning "Failed to upload configuration backup to S3"
    fi
  else
    log_error "Failed to create configuration backup"
  fi

  # Cleanup
  rm -rf "$temp_dir"
}

# Verify backup integrity
verify_backup() {
  log_info "Verifying backup integrity..."

  if [ "$DRY_RUN" = "1" ]; then
    log_warning "DRY RUN: Skipping backup verification"
    return 0
  fi

  # Verify RDS snapshot
  if aws rds describe-db-snapshots \
    --db-snapshot-identifier "$SNAPSHOT_ID" \
    --region "$AWS_REGION" \
    --query 'DBSnapshots[0].[DBSnapshotIdentifier,Status,CreateTime]' \
    --output text 2>/dev/null | grep -q "available"; then
    log_success "RDS snapshot verified"
  else
    log_error "Failed to verify RDS snapshot"
    return 1
  fi

  # Verify S3 backup exists
  if aws s3 ls "s3://$BACKUP_BUCKET/config-backups/config-backup-$BACKUP_ID.tar.gz" \
    --region "$AWS_REGION" 2>/dev/null | grep -q "config-backup"; then
    log_success "S3 configuration backup verified"
  else
    log_warning "Could not verify S3 configuration backup"
  fi

  return 0
}

# Clean up old snapshots based on retention policy
cleanup_old_snapshots() {
  log_info "Checking for old snapshots (retention: $RETENTION_DAYS days)..."

  if [ "$DRY_RUN" = "1" ]; then
    log_warning "DRY RUN: Would delete old snapshots older than $RETENTION_DAYS days"
    return 0
  fi

  local cutoff_date=$(date -u -d "$RETENTION_DAYS days ago" -Iseconds)
  local deleted_count=0

  # Get old snapshots
  old_snapshots=$(aws rds describe-db-snapshots \
    --db-instance-identifier "$DB_INSTANCE_ID" \
    --region "$AWS_REGION" \
    --query "DBSnapshots[?CreateTime<'$cutoff_date'].DBSnapshotIdentifier" \
    --output text 2>/dev/null)

  if [ -z "$old_snapshots" ]; then
    log_info "No old snapshots to delete"
    return 0
  fi

  for snapshot_id in $old_snapshots; do
    # Only delete snapshots we created
    if [[ "$snapshot_id" =~ ^scada-backup- ]]; then
      log_info "Deleting old snapshot: $snapshot_id"

      if aws rds delete-db-snapshot \
        --db-snapshot-identifier "$snapshot_id" \
        --region "$AWS_REGION" 2>> "$LOG_FILE"; then
        log_success "Deleted: $snapshot_id"
        deleted_count=$((deleted_count + 1))
      else
        log_warning "Failed to delete: $snapshot_id"
      fi
    fi
  done

  if [ $deleted_count -gt 0 ]; then
    log_success "Deleted $deleted_count old snapshots"
  fi
}

# Generate backup report
generate_report() {
  local report_file="$LOG_DIR/backup-report-$BACKUP_ID.json"

  # Get snapshot details
  snapshot_info=$(aws rds describe-db-snapshots \
    --db-snapshot-identifier "$SNAPSHOT_ID" \
    --region "$AWS_REGION" \
    --query 'DBSnapshots[0]' \
    --output json 2>/dev/null)

  if [ -z "$snapshot_info" ]; then
    snapshot_info='{"status":"not_found"}'
  fi

  # Create JSON report
  cat > "$report_file" << EOF
{
  "timestamp": "$TIMESTAMP",
  "backup_id": "$BACKUP_ID",
  "snapshot_id": "$SNAPSHOT_ID",
  "database": "$DB_INSTANCE_ID",
  "region": "$AWS_REGION",
  "backup_type": "rds_snapshot_and_config",
  "retention_days": $RETENTION_DAYS,
  "dry_run": $([[ "$DRY_RUN" == "1" ]] && echo "true" || echo "false"),
  "backup_status": "completed",
  "log_file": "$LOG_FILE",
  "snapshot_details": $snapshot_info
}
EOF

  log_success "Backup report generated: $report_file"
}

# Main execution
main() {
  log_info "=========================================="
  log_info "SCADA Topology Database Backup Started"
  log_info "=========================================="
  log_info "Backup ID: $BACKUP_ID"
  log_info "Snapshot ID: $SNAPSHOT_ID"
  log_info "Database: $DB_INSTANCE_ID"
  log_info "Region: $AWS_REGION"
  log_info "Log File: $LOG_FILE"

  if [ "$DRY_RUN" = "1" ]; then
    log_warning "Running in DRY RUN mode - no changes will be made"
  fi

  echo ""

  # Execute backup steps
  if ! validate_tools; then
    log_error "Tool validation failed"
    exit 1
  fi

  if ! validate_aws; then
    log_error "AWS validation failed"
    exit 1
  fi

  if ! create_snapshot; then
    log_error "Snapshot creation failed"
    exit 1
  fi

  if ! wait_snapshot; then
    log_error "Snapshot wait failed"
    exit 1
  fi

  if ! backup_configuration; then
    log_error "Configuration backup failed (non-fatal)"
  fi

  if ! verify_backup; then
    log_error "Backup verification failed"
    exit 1
  fi

  cleanup_old_snapshots

  generate_report

  log_info "=========================================="
  log_success "Backup completed successfully"
  log_info "=========================================="
  log_info "Summary:"
  log_info "  - RDS Snapshot: $SNAPSHOT_ID"
  log_info "  - Configuration Backup: S3://$BACKUP_BUCKET/config-backups/"
  log_info "  - Log File: $LOG_FILE"
  log_info "  - Report: $LOG_DIR/backup-report-$BACKUP_ID.json"
  echo ""

  exit 0
}

main "$@"

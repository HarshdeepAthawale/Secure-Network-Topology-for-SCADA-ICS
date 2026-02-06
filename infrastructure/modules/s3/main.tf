# S3 Buckets Module

resource "aws_s3_bucket" "telemetry" {
  bucket = "${var.name_prefix}-telemetry-${data.aws_caller_identity.current.account_id}"
  tags   = { Purpose = "telemetry-storage" }
}

resource "aws_s3_bucket" "reports" {
  bucket = "${var.name_prefix}-reports-${data.aws_caller_identity.current.account_id}"
  tags   = { Purpose = "report-storage" }
}

data "aws_caller_identity" "current" {}

resource "aws_s3_bucket_versioning" "telemetry" {
  bucket = aws_s3_bucket.telemetry.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_versioning" "reports" {
  bucket = aws_s3_bucket.reports.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "telemetry" {
  bucket = aws_s3_bucket.telemetry.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "reports" {
  bucket = aws_s3_bucket.reports.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "telemetry" {
  bucket = aws_s3_bucket.telemetry.id

  rule {
    id     = "transition-to-ia"
    status = "Enabled"

    filter {
      prefix = ""
    }

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    expiration {
      days = 365
    }
  }
}

resource "aws_s3_bucket_public_access_block" "telemetry" {
  bucket                  = aws_s3_bucket.telemetry.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "reports" {
  bucket                  = aws_s3_bucket.reports.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

variable "name_prefix" { type = string }
variable "environment" { type = string }

output "telemetry_bucket_name" { value = aws_s3_bucket.telemetry.bucket }
output "telemetry_bucket_arn" { value = aws_s3_bucket.telemetry.arn }
output "reports_bucket_name" { value = aws_s3_bucket.reports.bucket }
output "reports_bucket_arn" { value = aws_s3_bucket.reports.arn }

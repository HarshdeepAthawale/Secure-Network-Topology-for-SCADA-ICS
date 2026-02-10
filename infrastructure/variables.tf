# SCADA Topology Discovery - Terraform Variables

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"

  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "scada_topology"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  default     = "scada_admin"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "alert_email" {
  description = "Email address for alerts"
  type        = string
  default     = ""
}

variable "enable_deletion_protection" {
  description = "Enable deletion protection for critical resources"
  type        = bool
  default     = true
}

variable "log_retention_days" {
  description = "CloudWatch log retention in days"
  type        = number
  default     = 90
}

variable "ec2_instance_type" {
  description = "EC2 instance type for MQTT ingest service"
  type        = string
  default     = "t3.small"
}

variable "ec2_s3_deploy_bucket" {
  description = "S3 bucket for EC2 app tarball (optional; if set, user-data downloads and extracts)"
  type        = string
  default     = ""
}

variable "ec2_s3_deploy_key" {
  description = "S3 key for EC2 app tarball (e.g. deployments/scada-app.tar.gz)"
  type        = string
  default     = ""
}

variable "grafana_instance_type" {
  description = "EC2 instance type for Grafana"
  type        = string
  default     = "t3.small"
}

variable "grafana_admin_password" {
  description = "Grafana admin UI password (use a strong value in production)"
  type        = string
  default     = "admin"
  sensitive   = true
}

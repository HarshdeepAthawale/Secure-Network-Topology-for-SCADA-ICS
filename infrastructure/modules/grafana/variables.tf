variable "name_prefix" {
  type        = string
  description = "Name prefix for resources (e.g. scada-prod)"
}

variable "vpc_id" {
  type        = string
  description = "VPC ID for the Grafana EC2 instance"
}

variable "subnet_id" {
  type        = string
  description = "Private subnet ID for the Grafana EC2 instance"
}

variable "rds_security_group_id" {
  type        = string
  description = "RDS security group ID (for egress to PostgreSQL)"
}

variable "db_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for RDS credentials (host, port, database, username, password)"
}

variable "region" {
  type        = string
  description = "AWS region"
}

variable "instance_type" {
  type        = string
  description = "EC2 instance type for Grafana"
  default     = "t3.small"
}

variable "grafana_admin_password" {
  type        = string
  description = "Grafana admin password (use strong value in prod)"
  default     = "admin"
  sensitive   = true
}

variable "s3_dashboards_bucket" {
  type        = string
  description = "S3 bucket containing grafana-dashboards/dashboards.zip"
  default     = ""
}

variable "s3_dashboards_key" {
  type        = string
  description = "S3 key for dashboards zip (e.g. grafana-dashboards/dashboards.zip)"
  default     = ""
}

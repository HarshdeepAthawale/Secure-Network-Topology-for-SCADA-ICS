# SCADA Topology Discovery - Terraform Outputs

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "iot_endpoint" {
  description = "AWS IoT Core endpoint"
  value       = module.iot.iot_endpoint
}

output "iot_thing_name" {
  description = "IoT Thing name for collector"
  value       = module.iot.thing_name
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = module.rds.endpoint
  sensitive   = true
}

output "s3_telemetry_bucket" {
  description = "S3 bucket for telemetry data"
  value       = module.s3.telemetry_bucket_name
}

output "s3_reports_bucket" {
  description = "S3 bucket for reports"
  value       = module.s3.reports_bucket_name
}

output "lambda_ingest_arn" {
  description = "Ingest Lambda function ARN"
  value       = module.lambda.ingest_function_arn
}

output "api_endpoint" {
  description = "API Gateway endpoint"
  value       = module.lambda.api_endpoint
}

output "cloudwatch_dashboard_url" {
  description = "CloudWatch dashboard URL"
  value       = module.cloudwatch.dashboard_url
}

output "grafana_instance_id" {
  description = "Grafana EC2 instance ID (use with SSM port forwarding to access Grafana at localhost:3000)"
  value       = module.grafana.instance_id
}

output "grafana_ssm_port_forward_command" {
  description = "Example AWS CLI command to port-forward Grafana to localhost:3000"
  value       = "aws ssm start-session --target ${module.grafana.instance_id} --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters '{\"host\":[\"localhost\"],\"portNumber\":[\"3000\"],\"localPortNumber\":[\"3000\"]}' --region ${var.aws_region}"
}

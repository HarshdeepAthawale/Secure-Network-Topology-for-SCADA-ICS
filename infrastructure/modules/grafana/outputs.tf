output "instance_id" {
  description = "Grafana EC2 instance ID (use for SSM port forwarding)"
  value       = aws_instance.grafana.id
}

output "security_group_id" {
  description = "Security group ID of the Grafana EC2 instance (for RDS ingress rule)"
  value       = aws_security_group.grafana.id
}

output "instance_private_ip" {
  description = "Private IP of the Grafana EC2 instance"
  value       = aws_instance.grafana.private_ip
}

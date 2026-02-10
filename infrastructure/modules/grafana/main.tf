# Grafana EC2 Module - private instance, access via SSM port forwarding

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# IAM Role for Grafana EC2
resource "aws_iam_role" "grafana" {
  name = "${var.name_prefix}-grafana-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# IAM Policy: Secrets Manager (RDS credentials) and optional S3 (dashboards)
resource "aws_iam_role_policy" "grafana" {
  name = "grafana-policy"
  role = aws_iam_role.grafana.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Effect = "Allow"
          Action = [
            "secretsmanager:GetSecretValue"
          ]
          Resource = "arn:aws:secretsmanager:*:*:secret:${var.name_prefix}/*"
        }
      ],
      var.s3_dashboards_bucket != "" ? [
        {
          Effect   = "Allow"
          Action   = ["s3:GetObject"]
          Resource = "arn:aws:s3:::${var.s3_dashboards_bucket}/*"
        }
      ] : []
    )
  })
}

resource "aws_iam_role_policy_attachment" "grafana_ssm" {
  role       = aws_iam_role.grafana.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "grafana" {
  name = "${var.name_prefix}-grafana-profile"
  role = aws_iam_role.grafana.name
}

# Security Group for Grafana EC2
resource "aws_security_group" "grafana" {
  name        = "${var.name_prefix}-grafana-sg"
  description = "Security group for Grafana EC2 (access via SSM only)"
  vpc_id      = var.vpc_id

  # Outbound PostgreSQL to RDS
  egress {
    description     = "PostgreSQL to RDS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.rds_security_group_id]
  }

  # Outbound HTTPS for SSM, Secrets Manager, S3
  egress {
    description = "HTTPS for AWS services"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound HTTP for yum (package install)
  egress {
    description = "HTTP for package installation"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-grafana-sg"
  }
}

# EC2 Instance
resource "aws_instance" "grafana" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.grafana.id]
  iam_instance_profile   = aws_iam_instance_profile.grafana.name

  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    db_secret_arn           = var.db_secret_arn
    region                  = var.region
    grafana_admin_password_esc = replace(replace(var.grafana_admin_password, "\\", "\\\\"), "\"", "\\\"")
    s3_dashboards_bucket     = var.s3_dashboards_bucket != "" ? var.s3_dashboards_bucket : ""
    s3_dashboards_key       = var.s3_dashboards_key != "" ? var.s3_dashboards_key : ""
  }))

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  tags = {
    Name = "${var.name_prefix}-grafana"
  }
}

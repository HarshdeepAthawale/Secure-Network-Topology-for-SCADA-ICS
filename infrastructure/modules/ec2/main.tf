# EC2 Instance Module for MQTT to RDS Service

data "aws_ami" "amazon_linux" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["amzn2-ami-hvm-*-x86_64-gp2"]
  }
}

# IAM Role for EC2 Instance
resource "aws_iam_role" "ec2_mqtt_ingest" {
  name = "${var.name_prefix}-ec2-mqtt-ingest-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# IAM Policy for EC2 Instance
resource "aws_iam_role_policy" "ec2_mqtt_ingest" {
  name = "mqtt-ingest-policy"
  role = aws_iam_role.ec2_mqtt_ingest.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [
        {
          Effect = "Allow"
          Action = [
            "iot:Connect",
            "iot:Subscribe",
            "iot:Receive"
          ]
          Resource = [
            "arn:aws:iot:*:*:client/${var.name_prefix}-ec2-*",
            "arn:aws:iot:*:*:topicfilter/scada/telemetry",
            "arn:aws:iot:*:*:topic/scada/telemetry"
          ]
        },
        {
          Effect = "Allow"
          Action = [
            "secretsmanager:GetSecretValue"
          ]
          Resource = "arn:aws:secretsmanager:*:*:secret:${var.name_prefix}/*"
        },
        {
          Effect = "Allow"
          Action = [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents"
          ]
          Resource = "arn:aws:logs:*:*:*"
        }
      ],
      var.s3_deploy_bucket != "" ? [
        {
          Effect   = "Allow"
          Action   = ["s3:GetObject"]
          Resource = "arn:aws:s3:::${var.s3_deploy_bucket}/*"
        }
      ] : []
    )
  })
}

resource "aws_iam_role_policy_attachment" "ec2_ssm" {
  role       = aws_iam_role.ec2_mqtt_ingest.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2_mqtt_ingest" {
  name = "${var.name_prefix}-ec2-mqtt-ingest-profile"
  role = aws_iam_role.ec2_mqtt_ingest.name
}

# Security Group for EC2 Instance
resource "aws_security_group" "ec2_mqtt_ingest" {
  name        = "${var.name_prefix}-ec2-mqtt-ingest-sg"
  description = "Security group for EC2 MQTT ingest service"
  vpc_id      = var.vpc_id

  # Outbound HTTPS for AWS IoT Core
  egress {
    description = "HTTPS to AWS IoT Core"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  # Outbound PostgreSQL to RDS
  egress {
    description     = "PostgreSQL to RDS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [var.rds_security_group_id]
  }

  # Outbound HTTP/HTTPS for package installation
  egress {
    description = "HTTP/HTTPS for package installation"
    from_port   = 80
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "${var.name_prefix}-ec2-mqtt-ingest-sg"
  }
}

# EC2 Instance
resource "aws_instance" "mqtt_ingest" {
  ami                    = data.aws_ami.amazon_linux.id
  instance_type          = var.instance_type
  subnet_id              = var.subnet_id
  vpc_security_group_ids = [aws_security_group.ec2_mqtt_ingest.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2_mqtt_ingest.name

  user_data = base64encode(templatefile("${path.module}/user-data.sh", {
    iot_endpoint        = var.iot_endpoint
    iot_certificate_arn = var.iot_certificate_arn
    ec2_iot_secret_arn  = var.ec2_iot_secret_arn
    iot_thing_name      = var.iot_thing_name
    db_secret_arn       = var.db_secret_arn
    region              = var.region
    name_prefix         = var.name_prefix
    repo_url            = var.repo_url != "" ? var.repo_url : ""
    branch              = var.branch != "" ? var.branch : "master"
    s3_deploy_bucket    = var.s3_deploy_bucket != "" ? var.s3_deploy_bucket : ""
    s3_deploy_key       = var.s3_deploy_key != "" ? var.s3_deploy_key : ""
  }))

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  tags = {
    Name = "${var.name_prefix}-mqtt-ingest"
  }
}

# CloudWatch Log Group
resource "aws_cloudwatch_log_group" "ec2_service" {
  name              = "/aws/ec2/${var.name_prefix}-mqtt-ingest"
  retention_in_days = 7
}

variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "subnet_id" {
  type = string
}

variable "rds_security_group_id" {
  type = string
}

variable "iot_endpoint" {
  type = string
}

variable "iot_certificate_arn" {
  type = string
}

variable "ec2_iot_secret_arn" {
  type        = string
  description = "Secrets Manager ARN for EC2 IoT cert + private key"
}

variable "iot_thing_name" {
  type = string
}

variable "db_secret_arn" {
  type = string
}

variable "region" {
  type = string
}

variable "instance_type" {
  type    = string
  default = "t3.small"
}

variable "repo_url" {
  type    = string
  default = ""
}

variable "branch" {
  type    = string
  default = "master"
}

variable "s3_deploy_bucket" {
  type    = string
  default = ""
}

variable "s3_deploy_key" {
  type    = string
  default = ""
}

output "instance_id" {
  value = aws_instance.mqtt_ingest.id
}

output "instance_private_ip" {
  value = aws_instance.mqtt_ingest.private_ip
}

output "security_group_id" {
  value = aws_security_group.ec2_mqtt_ingest.id
}

# IoT Core Module

data "aws_iot_endpoint" "main" {
  endpoint_type = "iot:Data-ATS"
}

resource "aws_iot_thing" "collector" {
  name = "${var.name_prefix}-collector"
}

resource "aws_iot_certificate" "collector" {
  active = true
}

resource "aws_iot_thing_principal_attachment" "collector" {
  thing     = aws_iot_thing.collector.name
  principal = aws_iot_certificate.collector.arn
}

resource "aws_iot_policy" "collector" {
  name = "${var.name_prefix}-collector-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["iot:Connect"]
        Resource = "arn:aws:iot:*:*:client/${var.name_prefix}-*"
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Publish"]
        Resource = [
          "arn:aws:iot:*:*:topic/scada/telemetry",
          "arn:aws:iot:*:*:topic/scada/alerts"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Subscribe"]
        Resource = [
          "arn:aws:iot:*:*:topicfilter/scada/commands/*",
          "arn:aws:iot:*:*:topicfilter/scada/telemetry"
        ]
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Receive"]
        Resource = [
          "arn:aws:iot:*:*:topic/scada/commands/*",
          "arn:aws:iot:*:*:topic/scada/telemetry"
        ]
      }
    ]
  })
}

# IoT Thing for EC2 Instance
resource "aws_iot_thing" "ec2_ingest" {
  name = "${var.name_prefix}-ec2-ingest"
}

resource "aws_iot_certificate" "ec2_ingest" {
  active = true
}

resource "aws_iot_thing_principal_attachment" "ec2_ingest" {
  thing     = aws_iot_thing.ec2_ingest.name
  principal = aws_iot_certificate.ec2_ingest.arn
}

# IoT Policy for EC2 Instance (subscribe to telemetry)
resource "aws_iot_policy" "ec2_ingest" {
  name = "${var.name_prefix}-ec2-ingest-policy"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["iot:Connect"]
        Resource = "arn:aws:iot:*:*:client/${var.name_prefix}-ec2-*"
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Subscribe"]
        Resource = "arn:aws:iot:*:*:topicfilter/scada/telemetry"
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Receive"]
        Resource = "arn:aws:iot:*:*:topic/scada/telemetry"
      }
    ]
  })
}

resource "aws_iot_policy_attachment" "ec2_ingest" {
  policy = aws_iot_policy.ec2_ingest.name
  target = aws_iot_certificate.ec2_ingest.arn
}

# Store EC2 IoT cert + private key in Secrets Manager (describe-certificate does not return private key)
resource "aws_secretsmanager_secret" "ec2_iot_cert" {
  name = "${var.name_prefix}/ec2-iot-cert"
}

resource "aws_secretsmanager_secret_version" "ec2_iot_cert" {
  secret_id = aws_secretsmanager_secret.ec2_iot_cert.id
  secret_string = jsonencode({
    certificatePem = aws_iot_certificate.ec2_ingest.certificate_pem
    privateKey     = aws_iot_certificate.ec2_ingest.private_key
  })
}

resource "aws_iot_policy_attachment" "collector" {
  policy = aws_iot_policy.collector.name
  target = aws_iot_certificate.collector.arn
}

resource "aws_iot_topic_rule" "telemetry" {
  name        = "${replace(var.name_prefix, "-", "_")}_telemetry"
  enabled     = true
  sql         = "SELECT * FROM 'scada/telemetry'"
  sql_version = "2016-03-23"

  lambda {
    function_arn = var.lambda_function_arn != "" ? var.lambda_function_arn : "arn:aws:lambda:us-east-1:000000000000:function:placeholder"
  }

  cloudwatch_logs {
    log_group_name = "/aws/iot/${var.name_prefix}/telemetry"
    role_arn       = aws_iam_role.iot_logging.arn
  }

  error_action {
    cloudwatch_logs {
      log_group_name = "/aws/iot/${var.name_prefix}/errors"
      role_arn       = aws_iam_role.iot_logging.arn
    }
  }
}

resource "aws_iam_role" "iot_logging" {
  name = "${var.name_prefix}-iot-logging"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "iot.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "iot_logging" {
  name = "cloudwatch-logs"
  role = aws_iam_role.iot_logging.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = ["logs:CreateLogStream", "logs:PutLogEvents"]
      Resource = "arn:aws:logs:*:*:log-group:/aws/iot/${var.name_prefix}/*"
    }]
  })
}

variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "lambda_function_arn" {
  type    = string
  default = ""
}

output "iot_endpoint" {
  value = data.aws_iot_endpoint.main.endpoint_address
}

output "thing_name" {
  value = aws_iot_thing.collector.name
}

output "certificate_arn" {
  value = aws_iot_certificate.collector.arn
}

output "certificate_pem" {
  value     = aws_iot_certificate.collector.certificate_pem
  sensitive = true
}

output "private_key" {
  value     = aws_iot_certificate.collector.private_key
  sensitive = true
}

output "telemetry_rule_arn" {
  value = aws_iot_topic_rule.telemetry.arn
}

output "ec2_thing_name" {
  value = aws_iot_thing.ec2_ingest.name
}

output "ec2_certificate_arn" {
  value = aws_iot_certificate.ec2_ingest.arn
}

output "ec2_certificate_pem" {
  value     = aws_iot_certificate.ec2_ingest.certificate_pem
  sensitive = true
}

output "ec2_private_key" {
  value     = aws_iot_certificate.ec2_ingest.private_key
  sensitive = true
}

output "ec2_iot_secret_arn" {
  value = aws_secretsmanager_secret.ec2_iot_cert.arn
}

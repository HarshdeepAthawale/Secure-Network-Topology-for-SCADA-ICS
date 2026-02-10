# Lambda Functions Module

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# IAM Role for Lambda
resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_custom" {
  name = "custom-permissions"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["s3:GetObject", "s3:PutObject", "s3:ListBucket"]
        Resource = ["arn:aws:s3:::${var.name_prefix}-*", "arn:aws:s3:::${var.name_prefix}-*/*"]
      },
      {
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = "arn:aws:secretsmanager:*:*:secret:${var.name_prefix}/*"
      },
      {
        Effect   = "Allow"
        Action   = ["sqs:SendMessage", "sqs:ReceiveMessage", "sqs:DeleteMessage"]
        Resource = "arn:aws:sqs:*:*:${var.name_prefix}-*"
      },
      {
        Effect   = "Allow"
        Action   = ["iot:Publish"]
        Resource = "arn:aws:iot:*:*:topic/scada/telemetry"
      }
    ]
  })
}

# Ingest Lambda
resource "aws_lambda_function" "ingest" {
  function_name = "${var.name_prefix}-ingest"
  role          = aws_iam_role.lambda.arn
  handler       = "lambda/ingest/handler.handler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/placeholder.zip")

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_groups
  }

  environment {
    variables = {
      NODE_ENV    = var.environment
      LOG_LEVEL   = "info"
    }
  }

  tags = { Function = "ingest" }
}

# Process Lambda
resource "aws_lambda_function" "process" {
  function_name = "${var.name_prefix}-process"
  role          = aws_iam_role.lambda.arn
  handler       = "lambda/process/handler.handler"
  runtime       = "nodejs18.x"
  timeout       = 300
  memory_size   = 512

  filename         = "${path.module}/placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/placeholder.zip")

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_groups
  }

  environment {
    variables = {
      NODE_ENV  = var.environment
      LOG_LEVEL = "info"
    }
  }

  tags = { Function = "process" }
}

# Query Lambda
resource "aws_lambda_function" "query" {
  function_name = "${var.name_prefix}-query"
  role          = aws_iam_role.lambda.arn
  handler       = "lambda/query/handler.handler"
  runtime       = "nodejs18.x"
  timeout       = 30
  memory_size   = 256

  filename         = "${path.module}/placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/placeholder.zip")

  vpc_config {
    subnet_ids         = var.subnet_ids
    security_group_ids = var.security_groups
  }

  environment {
    variables = {
      NODE_ENV  = var.environment
      LOG_LEVEL = "info"
    }
  }

  tags = { Function = "query" }
}

# Generator Lambda - Generates data and publishes to IoT Core
resource "aws_lambda_function" "generator" {
  function_name = "${var.name_prefix}-generator"
  role          = aws_iam_role.lambda.arn
  handler       = "lambda/generator/handler.handler"
  runtime       = "nodejs18.x"
  timeout       = 60
  memory_size   = 256

  filename         = "${path.module}/placeholder.zip"
  source_code_hash = filebase64sha256("${path.module}/placeholder.zip")

  environment {
    variables = {
      NODE_ENV        = var.environment
      LOG_LEVEL       = "info"
      IOT_ENDPOINT    = var.iot_endpoint
      TELEMETRY_TOPIC = "scada/telemetry"
    }
  }

  tags = { Function = "generator" }
}

# EventBridge Rule to trigger generator Lambda every 10 seconds
resource "aws_cloudwatch_event_rule" "generator_schedule" {
  name                = "${var.name_prefix}-generator-schedule"
  description         = "Trigger data generator Lambda every minute"
  schedule_expression = "rate(1 minute)"
}

resource "aws_cloudwatch_event_target" "generator_target" {
  rule      = aws_cloudwatch_event_rule.generator_schedule.name
  target_id = "GeneratorLambdaTarget"
  arn       = aws_lambda_function.generator.arn
}

resource "aws_lambda_permission" "eventbridge_generator" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.generator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.generator_schedule.arn
}

# API Gateway
resource "aws_apigatewayv2_api" "main" {
  name          = "${var.name_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["*"]
  }
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true
}

resource "aws_apigatewayv2_integration" "query" {
  api_id             = aws_apigatewayv2_api.main.id
  integration_type   = "AWS_PROXY"
  integration_uri    = aws_lambda_function.query.invoke_arn
  integration_method = "POST"
}

resource "aws_apigatewayv2_route" "query" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "ANY /{proxy+}"
  target    = "integrations/${aws_apigatewayv2_integration.query.id}"
}

resource "aws_lambda_permission" "api_gateway" {
  function_name = aws_lambda_function.query.function_name
  action        = "lambda:InvokeFunction"
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

# IoT Rule Permission
resource "aws_lambda_permission" "iot" {
  function_name = aws_lambda_function.ingest.function_name
  action        = "lambda:InvokeFunction"
  principal     = "iot.amazonaws.com"
  source_arn    = var.iot_rule_arn
}

# Placeholder zip is pre-created manually

variable "name_prefix" { type = string }
variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "subnet_ids" { type = list(string) }
variable "security_groups" { type = list(string) }
variable "iot_rule_arn" { type = string }
variable "iot_endpoint" { type = string }

output "ingest_function_arn" { value = aws_lambda_function.ingest.arn }
output "process_function_arn" { value = aws_lambda_function.process.arn }
output "query_function_arn" { value = aws_lambda_function.query.arn }
output "generator_function_arn" { value = aws_lambda_function.generator.arn }
output "function_names" { value = [aws_lambda_function.ingest.function_name, aws_lambda_function.process.function_name, aws_lambda_function.query.function_name, aws_lambda_function.generator.function_name] }
output "api_endpoint" { value = aws_apigatewayv2_stage.main.invoke_url }
output "api_name" { value = aws_apigatewayv2_api.main.name }

# SCADA Topology Discovery - Main Terraform Configuration

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # S3 Backend for Remote State Management
  backend "s3" {
    bucket         = "scada-topology-terraform-state-047385030558"
    key            = "infrastructure/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "scada-topology-discovery"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Local values
locals {
  name_prefix = "scada-${var.environment}"
  common_tags = {
    Project     = "scada-topology-discovery"
    Environment = var.environment
  }
}

# VPC Module
module "vpc" {
  source = "./modules/vpc"

  name_prefix = local.name_prefix
  vpc_cidr    = var.vpc_cidr
  environment = var.environment
}

# IoT Core
module "iot" {
  source = "./modules/iot"

  name_prefix        = local.name_prefix
  environment        = var.environment
  lambda_function_arn = "" # Will be updated after Lambda is created
}

# Lambda Functions
module "lambda" {
  source = "./modules/lambda"

  name_prefix     = local.name_prefix
  environment     = var.environment
  vpc_id          = module.vpc.vpc_id
  subnet_ids      = module.vpc.private_subnet_ids
  security_groups = [module.vpc.lambda_security_group_id]
  iot_rule_arn    = module.iot.telemetry_rule_arn
  iot_endpoint    = module.iot.iot_endpoint
}

# RDS PostgreSQL
module "rds" {
  source = "./modules/rds"

  name_prefix       = local.name_prefix
  environment       = var.environment
  vpc_id            = module.vpc.vpc_id
  subnet_ids        = module.vpc.database_subnet_ids
  security_group_id = module.vpc.rds_security_group_id
  db_name           = var.db_name
  db_username       = var.db_username
  instance_class    = var.db_instance_class
}

# S3 Buckets
module "s3" {
  source = "./modules/s3"

  name_prefix = local.name_prefix
  environment = var.environment
}

# EC2 Instance for MQTT to RDS Service
module "ec2" {
  source = "./modules/ec2"

  name_prefix            = local.name_prefix
  vpc_id                 = module.vpc.vpc_id
  subnet_id              = module.vpc.private_subnet_ids[0]
  rds_security_group_id  = module.vpc.rds_security_group_id
  iot_endpoint           = module.iot.iot_endpoint
  iot_certificate_arn    = module.iot.ec2_certificate_arn
  iot_thing_name         = module.iot.ec2_thing_name
  ec2_iot_secret_arn     = module.iot.ec2_iot_secret_arn
  db_secret_arn          = module.rds.secret_arn
  region                 = var.aws_region
  instance_type          = var.ec2_instance_type
  s3_deploy_bucket       = var.ec2_s3_deploy_bucket
  s3_deploy_key          = var.ec2_s3_deploy_key
}

# Allow EC2 MQTT ingest to reach RDS (VPC module only allows Lambda by default)
resource "aws_security_group_rule" "rds_ingress_from_ec2" {
  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = module.ec2.security_group_id
  security_group_id        = module.vpc.rds_security_group_id
  description              = "PostgreSQL from EC2 MQTT ingest"
}

# CloudWatch
module "cloudwatch" {
  source = "./modules/cloudwatch"

  name_prefix           = local.name_prefix
  environment           = var.environment
  lambda_function_names = [for name in ["ingest", "process", "query", "generator"] : "${local.name_prefix}-${name}"]
  alert_email           = var.alert_email
  rds_instance_id       = module.rds.instance_id
  api_gateway_name      = module.lambda.api_name
}

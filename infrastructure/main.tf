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

  name_prefix = local.name_prefix
  environment = var.environment
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

# CloudWatch
module "cloudwatch" {
  source = "./modules/cloudwatch"

  name_prefix           = local.name_prefix
  environment           = var.environment
  lambda_function_names = module.lambda.function_names
  alert_email           = var.alert_email
  rds_instance_id       = module.rds.instance_id
  api_gateway_name      = module.lambda.api_name
}

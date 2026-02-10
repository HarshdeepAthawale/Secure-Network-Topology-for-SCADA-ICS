# Infrastructure operations

## Terraform environment strategy

The Terraform state may contain a **mix of dev and prod** resource names (e.g. some Lambda/CloudWatch/IoT resources as `scada-dev-*`, while VPC, RDS, and EC2 are prod). A full `terraform plan -var=environment=prod` (no target) can show a large number of add/change/destroy actions (e.g. 57 add, 15 change, 11 destroy) as the configuration is brought in line with `environment=prod`.

### Option 1: Targeted applies (current approach)

- Use **targeted applies** for pipeline-related changes to avoid touching unrelated resources.
- Typical workflow:
  - EC2 module: `terraform apply -var=environment=prod -target=module.ec2 -auto-approve`
  - After replacing EC2, re-apply the RDS ingress rule: `terraform apply -var=environment=prod -target=aws_security_group_rule.rds_ingress_from_ec2 -auto-approve`
- **Caveat**: After an EC2 instance replace, the RDS security group can lose the EC2 ingress rule (Terraform in-place update). Always re-apply `aws_security_group_rule.rds_ingress_from_ec2` after an EC2 replace.
- State remains mixed; `terraform plan -var=environment=prod` will continue to show many changes unless you are ready to align everything.

### Option 2: Full prod alignment

- When ready to make all resources consistently `scada-prod-*`:
  1. Run `terraform plan -var=environment=prod` (no `-target`) and review the plan.
  2. Expect renames/replacements (e.g. Lambda, API Gateway, IoT, CloudWatch log groups). Ensure no critical resources are destroyed without replacement.
  3. Apply in a maintenance window: `terraform apply -var=environment=prod`.
- Use this only after reviewing the full plan and accepting renames/destroys.

## EC2 and S3 deploy

- To deploy application code via S3: set `ec2_s3_deploy_bucket` and `ec2_s3_deploy_key` (e.g. in `terraform.tfvars`). See `terraform.tfvars.example` for a template.
- After changing these or user-data, replace the EC2 instance (taint + apply EC2 module, then re-apply RDS ingress rule).

## Useful commands

- Plan (full): `terraform plan -var=environment=prod`
- Plan (EC2 only): `terraform plan -var=environment=prod -target=module.ec2`
- Apply EC2: `terraform apply -var=environment=prod -target=module.ec2 -auto-approve`
- Apply RDS ingress from EC2: `terraform apply -var=environment=prod -target=aws_security_group_rule.rds_ingress_from_ec2 -auto-approve`
- Taint EC2 (force replace): `terraform taint 'module.ec2.aws_instance.mqtt_ingest'`

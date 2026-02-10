# Deployment Complete

## Current production pipeline (verified)

- **Lambda** generator publishes to IoT Core (`scada/telemetry`). EventBridge schedule every 10s (or 1 min depending on config).
- **IoT Core** MQTT broker; EC2 thing/cert/policy for subscribe.
- **EC2** instance runs `scada-mqtt-ingest` (Node MQTT → RDS). Certs and DB credentials from **Secrets Manager**; app code from **S3 tarball** or user-data (S3 deploy preferred).
- **RDS** PostgreSQL; ingress from EC2 security group (port 5432).

### Prod EC2 instance (current)

- **Instance ID**: `i-03db8c84f2f50596b` (Name: `scada-prod-mqtt-ingest`)
- **Deploy**: User-data downloads `s3://scada-dev-reports-047385030558/deploys/scada-app.tar.gz`, extracts to `/opt/scada`, fetches IoT cert from Secrets Manager (`scada-prod/ec2-iot-cert`), writes `/opt/scada/db.env` from RDS secret, installs Node 18 (AL2-compatible binary), creates `/opt/scada/logs`, and starts `scada-mqtt-ingest`.
- **Secrets**: IoT cert/private key from `scada-prod/ec2-iot-cert`; RDS from `scada-prod/database/credentials`.
- **Service**: `systemctl status scada-mqtt-ingest`; logs: `journalctl -u scada-mqtt-ingest -n 100`.

### How to verify the pipeline

1. **From your machine**
   - Run: `AWS_REGION=ap-south-1 NAME_PREFIX=scada-prod ./scripts/verify-pipeline.sh`
   - Confirms Lambda log group, EC2 instance, RDS endpoint. RDS row counts may time out from outside the VPC (RDS is private).

2. **From the EC2 instance (SSM or bastion)**
   - In **AWS Console → Systems Manager → Fleet Manager**, start a session on the instance (or `aws ssm start-session --target i-03db8c84f2f50596b --region ap-south-1`).
   - Run: `sudo /opt/scada/scripts/verify-ec2-from-instance.sh scada-prod` (if the script is on the instance), or manually:
     - `sudo systemctl status scada-mqtt-ingest`
     - `sudo journalctl -u scada-mqtt-ingest -n 60`
     - RDS row counts: use DB credentials from `/opt/scada/db.env` or Secrets Manager and `psql` (e.g. `yum install -y postgresql15` then connect with `sslmode=require`).

3. **Success criteria**
   - Lambda publishing; EC2 service `active (running)`; journal shows "Database connection pool established" and message processing; RDS tables (`devices`, `connections`, `telemetry`, `alerts`) have recent data.

### Replacing the EC2 instance (e.g. after user-data or Terraform changes)

1. Set S3 deploy vars if using tarball: `ec2_s3_deploy_bucket`, `ec2_s3_deploy_key` (e.g. in `terraform.tfvars`).
2. `terraform taint 'module.ec2.aws_instance.mqtt_ingest'`
3. `terraform apply -var=environment=prod -target=module.ec2 -auto-approve`
4. Re-apply RDS ingress from EC2: `terraform apply -var=environment=prod -target=aws_security_group_rule.rds_ingress_from_ec2 -auto-approve`
5. Wait ~5 minutes for user-data (Node install, S3 download, certs, systemd), then verify via SSM as above.

## Terraform and operations

- **State**: May be mixed dev/prod (e.g. some Lambda/IoT names `scada-dev-*`, VPC/RDS/EC2 prod). See `infrastructure/OPERATIONS.md` (or `infrastructure/README.md`) for strategy.
- **Targeted applies**: Pipeline changes often use `-target=module.ec2` and `-target=aws_security_group_rule.rds_ingress_from_ec2` to limit scope. After EC2 replace, always re-apply the RDS ingress rule.

## Key resources (prod)

- **Lambda**: `scada-prod-generator` (or dev name if state mixed)
- **EC2**: `i-03db8c84f2f50596b` (scada-prod-mqtt-ingest)
- **IoT endpoint**: a1r81dm4t7lp48-ats.iot.ap-south-1.amazonaws.com
- **S3 deploy**: s3://scada-dev-reports-047385030558/deploys/scada-app.tar.gz
- **Region**: ap-south-1

## Success criteria

- [x] Lambda generator deployed and publishing
- [x] IoT Core configured; EC2 thing/cert/policy
- [x] EC2 instance with user-data (Secrets Manager cert + DB, S3 tarball, Node 18, systemd)
- [x] EC2 service `scada-mqtt-ingest` active; DB connection established
- [x] RDS ingress from EC2; data flow Lambda → IoT → EC2 → RDS
- [x] Grafana in AWS: EC2 instance in VPC with RDS datasource; access via SSM port forwarding

## Grafana in AWS

Grafana runs on a dedicated EC2 instance in the same VPC (private subnet). It connects to RDS using credentials from Secrets Manager and loads dashboards from an S3-provisioned zip. Access is via **SSM port forwarding** only (no public endpoint).

### Get the Grafana instance ID

- **Terraform**: After `terraform apply`, run `terraform output grafana_instance_id`.
- **Console**: EC2 → Instances → filter by name `scada-{env}-grafana`.
- **CLI**: `aws ec2 describe-instances --filters "Name=tag:Name,Values=scada-prod-grafana" --query 'Reservations[0].Instances[0].InstanceId' --output text --region ap-south-1`

### Access Grafana (SSM port forward)

From a machine with AWS CLI and SSM access (same account/region):

```bash
aws ssm start-session --target <grafana-instance-id> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["localhost"],"portNumber":["3000"],"localPortNumber":["3000"]}' \
  --region ap-south-1
```

Then open **http://localhost:3000** in a browser. Log in with user `admin` and the password set in Terraform (`grafana_admin_password` variable; default `admin`—use a strong value in production).

Example one-liner from Terraform output:

```bash
terraform output -raw grafana_ssm_port_forward_command
```

### Verification

1. **Instance and container**: SSM into the Grafana instance and run `sudo docker ps`; the `grafana` container should be running.
2. **Datasource**: In Grafana UI, go to **Configuration → Data sources**. The **PostgreSQL** datasource (uid `postgres`) should show **Save & test** as successful.
3. **Dashboards**: Open **Dashboards → SCADA** (or browse). Set the time range to include recent data; topology and security dashboards should show data from RDS.

### Terraform

- **Module**: `infrastructure/modules/grafana` (IAM role, security group, EC2, user-data that installs Docker, fetches RDS secret, provisions datasource and dashboards from S3, runs Grafana container).
- **RDS**: An ingress rule allows the Grafana EC2 security group to connect to RDS on port 5432.
- **Variables**: `grafana_instance_type` (default `t3.small`), `grafana_admin_password` (sensitive).
- **Outputs**: `grafana_instance_id`, `grafana_ssm_port_forward_command`.

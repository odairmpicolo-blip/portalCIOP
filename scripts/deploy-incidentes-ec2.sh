#!/usr/bin/env bash
# Fallback EC2: instância em sa-east-1 com cron diário (TCGL → DSQL).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
REGION="${AWS_REGION:-sa-east-1}"
INSTANCE_TYPE="${INCIDENTES_EC2_TYPE:-t3.small}"
KEY_NAME="${INCIDENTES_EC2_KEY_NAME:-}"
REPO_URL="${INCIDENTES_REPO_URL:-https://github.com/odairmpicolo-blip/portal-teste.git}"
BRANCH="${INCIDENTES_REPO_BRANCH:-main}"
SG_NAME="portal-ciop-incidentes-sync"

AWS="${AWS_CLI:-aws}"

if ! command -v "$AWS" >/dev/null 2>&1; then
  echo "AWS CLI não encontrado."
  exit 1
fi

if ! "$AWS" sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
  echo "Credenciais AWS ausentes. Rode: aws login"
  exit 1
fi

ACCOUNT_ID=$("$AWS" sts get-caller-identity --query Account --output text)
CLUSTER_ID="${DSQL_CLUSTER_ID:-ort34httzig7iktrneb4ytcy5u}"

SG_ID=$("$AWS" ec2 describe-security-groups \
  --filters "Name=group-name,Values=$SG_NAME" \
  --region "$REGION" \
  --query "SecurityGroups[0].GroupId" \
  --output text 2>/dev/null || true)
if [[ -z "$SG_ID" || "$SG_ID" == "None" ]]; then
  SG_ID=$("$AWS" ec2 create-security-group \
    --group-name "$SG_NAME" \
    --description "Portal CIOP sync incidentes TCGL" \
    --region "$REGION" \
    --query GroupId --output text)
  "$AWS" ec2 authorize-security-group-egress \
    --group-id "$SG_ID" \
    --ip-permissions IpProtocol=-1 IpRanges='[{CidrIp=0.0.0.0/0}]' \
    --region "$REGION" 2>/dev/null || true
fi

AMI=$("$AWS" ec2 describe-images \
  --owners amazon \
  --filters "Name=name,Values=al2023-ami-2023.*-x86_64" "Name=state,Values=available" \
  --region "$REGION" \
  --query "sort_by(Images,&CreationDate)[-1].ImageId" \
  --output text)

USER_DATA=$(sed "s|__REPO_URL__|${REPO_URL}|g; s|__BRANCH__|${BRANCH}|g" \
  "$ROOT/scripts/ec2/bootstrap.sh" | base64 | tr -d '\n')

ROLE_NAME="portal-ciop-incidentes-ec2-role"
if ! "$AWS" iam get-role --role-name "$ROLE_NAME" >/dev/null 2>&1; then
  TRUST='{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}'
  "$AWS" iam create-role --role-name "$ROLE_NAME" --assume-role-policy-document "$TRUST"
  POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": "dsql:DbConnectAdmin",
    "Resource": "arn:aws:dsql:${REGION}:${ACCOUNT_ID}:cluster/${CLUSTER_ID}"
  }]
}
EOF
)
  "$AWS" iam put-role-policy --role-name "$ROLE_NAME" --policy-name dsql-connect --policy-document "$POLICY"
  sleep 8
fi

PROFILE_NAME="portal-ciop-incidentes-ec2-profile"
"$AWS" iam create-instance-profile --instance-profile-name "$PROFILE_NAME" 2>/dev/null || true
"$AWS" iam add-role-to-instance-profile \
  --instance-profile-name "$PROFILE_NAME" \
  --role-name "$ROLE_NAME" 2>/dev/null || true

RUN_ARGS=(
  --image-id "$AMI"
  --instance-type "$INSTANCE_TYPE"
  --security-group-ids "$SG_ID"
  --iam-instance-profile "Name=$PROFILE_NAME"
  --user-data "$USER_DATA"
  --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=portal-ciop-incidentes-sync}]"
  --region "$REGION"
)
if [[ -n "$KEY_NAME" ]]; then
  RUN_ARGS+=(--key-name "$KEY_NAME")
fi

echo "==> Criando EC2 $INSTANCE_TYPE em $REGION"
INSTANCE_ID=$("$AWS" ec2 run-instances "${RUN_ARGS[@]}" --query "Instances[0].InstanceId" --output text)
echo "Instância: $INSTANCE_ID"
"$AWS" ec2 wait instance-running --instance-ids "$INSTANCE_ID" --region "$REGION"
echo ""
echo "Após bootstrap, edite credenciais TCGL na instância:"
echo "  /etc/portal-ciop/incidentes.env"
echo "Cron: 09:00 UTC (06:00 Brasília). Log: /var/log/portal-incidentes-sync.log"
echo "Teste: portal-incidentes-sync.sh"

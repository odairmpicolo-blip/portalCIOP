#!/usr/bin/env bash
# Deploy infra Lambda (CloudFormation) + secret + teste de alcance FleetBus.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWS_DIR="$ROOT/aws/fleetbus-sync"
STACK="${FLEETBUS_STACK_NAME:-portal-ciop-fleetbus-sync}"
REGION="${AWS_REGION:-sa-east-1}"
SECRET_NAME="${FLEETBUS_SECRET_NAME:-portal-ciop/fleetbus-sync}"
ENV_FILE="${CIOP_FLEETBUS_ENV:-$HOME/.config/ciop-portal/fleetbus.env}"

AWS="${AWS_CLI:-aws}"

if ! command -v "$AWS" >/dev/null 2>&1; then
  echo "AWS CLI não encontrado."
  exit 1
fi

if ! "$AWS" sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
  echo "Credenciais AWS ausentes. Rode: aws configure --profile admin"
  exit 1
fi

echo "==> CloudFormation stack: $STACK (portalCIOP — FleetBus on-demand)"
"$AWS" cloudformation deploy \
  --template-file "$AWS_DIR/template.yaml" \
  --stack-name "$STACK" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    FleetbusSecretName="$SECRET_NAME"

FUNC_NAME=$("$AWS" cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FunctionName'].OutputValue" \
  --output text)

API_URL=$("$AWS" cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiBaseUrl'].OutputValue" \
  --output text)

echo "Função: $FUNC_NAME"
echo "API (para o frontend): $API_URL"

if [[ -f "$ENV_FILE" ]]; then
  echo "==> Secret Manager: $SECRET_NAME"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  if [[ -n "${FLEETBUS_REFRESH_TOKEN:-}" ]]; then
    SECRET_JSON=$(node -e "console.log(JSON.stringify({ refresh_token: process.env.FLEETBUS_REFRESH_TOKEN }))")
    if "$AWS" secretsmanager describe-secret --secret-id "$SECRET_NAME" --region "$REGION" >/dev/null 2>&1; then
      "$AWS" secretsmanager put-secret-value \
        --secret-id "$SECRET_NAME" \
        --secret-string "$SECRET_JSON" \
        --region "$REGION"
    else
      "$AWS" secretsmanager create-secret \
        --name "$SECRET_NAME" \
        --secret-string "$SECRET_JSON" \
        --region "$REGION"
    fi
    echo "Secret atualizado."
  else
    echo "AVISO: FLEETBUS_REFRESH_TOKEN vazio em $ENV_FILE"
  fi
else
  echo "AVISO: Crie $ENV_FILE com FLEETBUS_REFRESH_TOKEN e rode este script novamente."
  echo "Modelo: aws/fleetbus-sync/fleetbus.env.example"
fi

bash "$ROOT/scripts/build-fleetbus-lambda.sh"

echo "==> Teste manual (probe: lista de veículos)"
PROBE=$("$AWS" lambda invoke \
  --function-name "$FUNC_NAME" \
  --region "$REGION" \
  --payload '{"mode":"vehicles"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/fleetbus-probe.json \
  --no-cli-pager)
echo "$PROBE"
cat /tmp/fleetbus-probe.json
echo ""
echo "Endpoint para o frontend: $API_URL"
echo "  GET $API_URL/vehicles"
echo "  GET $API_URL/live?vehicleId=<id>"

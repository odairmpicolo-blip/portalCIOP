#!/usr/bin/env bash
# Deploy infra Lambda (CloudFormation) + código da API portal (liberação, snapshots, terminais).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWS_DIR="$ROOT/aws/portal-api"
STACK="${PORTAL_API_STACK_NAME:-portal-ciop-api}"
REGION="${AWS_REGION:-sa-east-1}"
API_ID="${BUS2_PROXY_API_ID:-62wvo4yk9b}"

AWS="${AWS_CLI:-aws}"

if ! command -v "$AWS" >/dev/null 2>&1; then
  echo "AWS CLI não encontrado."
  exit 1
fi

if ! "$AWS" sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
  echo "Credenciais AWS ausentes. Rode: aws login"
  exit 1
fi

echo "==> CloudFormation stack: $STACK (API portal → API Gateway $API_ID)"
"$AWS" cloudformation deploy \
  --template-file "$AWS_DIR/template.yaml" \
  --stack-name "$STACK" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    DsqlClusterId="${DSQL_CLUSTER_ID:-ort34httzig7iktrneb4ytcy5u}" \
    Bus2ProxyApiId="$API_ID"

API_URL=$("$AWS" cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

DB_HEALTH_URL=$("$AWS" cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='DbHealthUrl'].OutputValue" \
  --output text)

echo "API base: $API_URL"
echo "DB health: $DB_HEALTH_URL"

bash "$ROOT/scripts/build-portal-api-lambda.sh"

echo "==> Teste GET /db-health"
sleep 3
HTTP=$(curl -sS -o /tmp/portal-api-db-health.json -w "%{http_code}" "$DB_HEALTH_URL" || echo "000")
echo "HTTP $HTTP"
cat /tmp/portal-api-db-health.json
echo ""

echo "==> Teste GET /liberacao (esperado 401 sem token)"
LIB_HTTP=$(curl -sS -o /tmp/portal-api-liberacao.json -w "%{http_code}" "$API_URL/liberacao?data=2026-06-25" || echo "000")
echo "HTTP $LIB_HTTP"
cat /tmp/portal-api-liberacao.json
echo ""

if [[ "$HTTP" == "200" ]]; then
  echo "==> API portal implantada. Rotas: /liberacao, /snapshots, /terminais, /db-health"
  echo "portal-runtime.json já aponta para $API_URL"
else
  echo "AVISO: /db-health não retornou 200. Verifique logs:"
  echo "  aws logs tail /aws/lambda/portal-ciop-api --region $REGION --since 5m"
fi

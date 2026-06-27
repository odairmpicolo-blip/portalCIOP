#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWS_DIR="$ROOT/aws/liberacao-sync"
STACK="${LIBERACAO_SYNC_STACK_NAME:-portal-ciop-liberacao-sync}"
REGION="${AWS_REGION:-sa-east-1}"
AWS="${AWS_CLI:-aws}"

if ! "$AWS" sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
  echo "Credenciais AWS ausentes. Rode: aws login"
  exit 1
fi

echo "==> CloudFormation stack: $STACK"
"$AWS" cloudformation deploy \
  --template-file "$AWS_DIR/template.yaml" \
  --stack-name "$STACK" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset \
  --parameter-overrides \
    DsqlClusterId="${DSQL_CLUSTER_ID:-ort34httzig7iktrneb4ytcy5u}" \
    SyncRateMinutes="${LIBERACAO_SYNC_RATE_MINUTES:-2}"

bash "$ROOT/scripts/build-liberacao-sync-lambda.sh"

FUNC=$("$AWS" cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FunctionName'].OutputValue" \
  --output text)

echo "==> Teste sync manual"
"$AWS" lambda invoke \
  --function-name "$FUNC" \
  --region "$REGION" \
  --cli-binary-format raw-in-base64-out \
  --payload '{}' \
  /tmp/liberacao-sync.json \
  --no-cli-pager
cat /tmp/liberacao-sync.json
echo ""
echo "Agendamento: a cada ${LIBERACAO_SYNC_RATE_MINUTES:-2} min (planilha → DSQL hoje)"

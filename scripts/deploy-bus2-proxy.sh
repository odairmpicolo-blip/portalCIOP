#!/usr/bin/env bash
# Deploy proxy Bus2 (Lambda + API Gateway HTTP) e opcionalmente configura PORTAL_AWS_API_URL no GitHub.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWS_DIR="$ROOT/aws/bus2-proxy"
STACK="${BUS2_STACK_NAME:-portal-ciop-bus2-proxy}"
REGION="${AWS_REGION:-sa-east-1}"
AWS="${AWS_CLI:-aws}"

if ! command -v "$AWS" >/dev/null 2>&1; then
  echo "AWS CLI não encontrado."
  exit 1
fi

if ! "$AWS" sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
  echo "Credenciais AWS ausentes. Rode: aws login"
  exit 1
fi

echo "==> CloudFormation stack: $STACK ($REGION)"
if ! "$AWS" cloudformation deploy \
  --template-file "$AWS_DIR/template.yaml" \
  --stack-name "$STACK" \
  --capabilities CAPABILITY_NAMED_IAM \
  --region "$REGION" \
  --no-fail-on-empty-changeset; then
  echo ""
  echo "ERRO: deploy CloudFormation falhou (permissões IAM insuficientes?)."
  echo "Anexe a política aws/bus2-proxy/iam-github-actions-policy.json ao usuário portal-ciop-github-actions"
  echo "ou rode localmente com credenciais admin: aws login && bash scripts/deploy-bus2-proxy.sh"
  exit 1
fi

FUNC=$("$AWS" cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FunctionName'].OutputValue" \
  --output text)

API_URL=$("$AWS" cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" \
  --output text)

ZIP="/tmp/portal-bus2-proxy-$$.zip"
rm -f "$ZIP"
(cd "$AWS_DIR" && zip -q "$ZIP" index.mjs)

echo "==> Atualizando Lambda $FUNC"
"$AWS" lambda update-function-code \
  --function-name "$FUNC" \
  --region "$REGION" \
  --zip-file "fileb://$ZIP" >/dev/null
rm -f "$ZIP"

if [[ -n "${BUSTIME_API_KEY:-}" ]]; then
  echo "==> Configurando variáveis na Lambda"
  ENV_VARS="BUSTIME_BASE_URL=https://csr.mov1.com.br/bustime/api/v3,BUSTIME_REFERER=https://csr.mov1.com.br/map,BUSTIME_API_KEY=${BUSTIME_API_KEY}"
  if [[ -n "${GEMINI_API_KEY:-}" ]]; then
    ENV_VARS="${ENV_VARS},GEMINI_API_KEY=${GEMINI_API_KEY}"
  fi
  "$AWS" lambda update-function-configuration \
    --function-name "$FUNC" \
    --region "$REGION" \
    --environment "Variables={${ENV_VARS}}" >/dev/null
elif [[ -n "${GEMINI_API_KEY:-}" ]]; then
  echo "==> Configurando GEMINI_API_KEY na Lambda"
  "$AWS" lambda update-function-configuration \
    --function-name "$FUNC" \
    --region "$REGION" \
    --environment "Variables={GEMINI_API_KEY=${GEMINI_API_KEY}}" >/dev/null
else
  echo "AVISO: defina BUSTIME_API_KEY e/ou GEMINI_API_KEY antes do deploy (export ...)"
fi

echo "==> Teste /health"
"$AWS" lambda wait function-updated --function-name "$FUNC" --region "$REGION"
sleep 2
HEALTH=$(curl -s "${API_URL}/health" || true)
echo "$HEALTH"

echo ""
echo "API URL (PORTAL_AWS_API_URL): $API_URL"
echo "Proxy MOV1: ${API_URL}/mov1/getvehicles?rt=203"
echo "Proxy Bus2 (legado): ${API_URL}/bus2/vehicles?..."
echo "Relatório IA: POST ${API_URL}/relatorio-ia (requer GEMINI_API_KEY na Lambda)"

if command -v gh >/dev/null 2>&1 && gh auth status >/dev/null 2>&1 && [[ "${SKIP_GH_SECRET:-}" != "1" ]]; then
  echo "==> Gravando secret PORTAL_AWS_API_URL no GitHub (portal-teste)"
  if gh secret set PORTAL_AWS_API_URL --body "$API_URL" --repo odairmpicolo-blip/portal-teste 2>/dev/null; then
    echo "Secret atualizado."
  else
    echo "AVISO: não foi possível gravar secret (use PAT ou defina manualmente)."
  fi
else
  echo "Configure: gh secret set PORTAL_AWS_API_URL --body \"$API_URL\""
fi

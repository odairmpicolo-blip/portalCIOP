#!/usr/bin/env bash
# Deploy infra Lambda (CloudFormation) + secret + teste de alcance TCGL.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWS_DIR="$ROOT/aws/incidentes-sync"
STACK="${INCIDENTES_STACK_NAME:-portal-ciop-incidentes-sync}"
REGION="${AWS_REGION:-sa-east-1}"
SECRET_NAME="${INCIDENTES_SECRET_NAME:-portal-ciop/incidentes-sync}"
ENV_FILE="${CIOP_INCIDENTES_ENV:-$HOME/.config/ciop-portal/incidentes.env}"

AWS="${AWS_CLI:-aws}"

if ! command -v "$AWS" >/dev/null 2>&1; then
  echo "AWS CLI não encontrado."
  exit 1
fi

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
    IncidentesSecretName="$SECRET_NAME"

FUNC_NAME=$("$AWS" cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='FunctionName'].OutputValue" \
  --output text)

BUCKET=$("$AWS" cloudformation describe-stacks \
  --stack-name "$STACK" \
  --region "$REGION" \
  --query "Stacks[0].Outputs[?OutputKey=='StateBucket'].OutputValue" \
  --output text)

echo "Função: $FUNC_NAME"
echo "Bucket estado: $BUCKET"

if [[ -f "$ENV_FILE" ]]; then
  echo "==> Secret Manager: $SECRET_NAME"
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
  if [[ -n "${CIOP_INCIDENTES_USUARIO:-}" && -n "${CIOP_INCIDENTES_SENHA:-}" ]]; then
  SECRET_JSON=$(node -e "console.log(JSON.stringify({
    CIOP_INCIDENTES_USUARIO: process.env.CIOP_INCIDENTES_USUARIO,
    CIOP_INCIDENTES_SENHA: process.env.CIOP_INCIDENTES_SENHA,
    CIOP_GITHUB_TOKEN: process.env.CIOP_GITHUB_TOKEN || ''
  }))")
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
    echo "AVISO: CIOP_INCIDENTES_USUARIO/SENHA vazios em $ENV_FILE"
  fi
else
  echo "AVISO: Crie $ENV_FILE com credenciais TCGL e rode este script novamente."
fi

bash "$ROOT/scripts/build-incidentes-lambda.sh"

echo "==> Teste alcance TCGL (Lambda probe)"
PROBE=$("$AWS" lambda invoke \
  --function-name "$FUNC_NAME" \
  --region "$REGION" \
  --payload '{"mode":"probe"}' \
  --cli-binary-format raw-in-base64-out \
  /tmp/incidentes-probe.json \
  --no-cli-pager)
echo "$PROBE"
cat /tmp/incidentes-probe.json
echo ""

if grep -qE '"ok"[[:space:]]*:[[:space:]]*true' /tmp/incidentes-probe.json 2>/dev/null; then
  echo "==> TCGL acessível pela Lambda. Teste sync completo (opcional):"
  echo "  aws lambda invoke --function-name $FUNC_NAME --region $REGION --payload '{}' /tmp/incidentes-sync.json"
else
  echo "==> TCGL NÃO acessível pela Lambda. Use fallback EC2:"
  echo "  bash scripts/deploy-incidentes-ec2.sh"
  echo "Ou Mac local:"
  echo "  bash scripts/executar-atualizacao-incidentes.sh manual"
fi

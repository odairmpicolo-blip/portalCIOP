#!/usr/bin/env bash
# Monta o pacote Lambda (scripts portal + dependências) e atualiza a função.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWS_DIR="$ROOT/aws/incidentes-sync"
BUILD="$AWS_DIR/.build"
FUNC_NAME="${INCIDENTES_LAMBDA_NAME:-portal-ciop-incidentes-sync}"
REGION="${AWS_REGION:-sa-east-1}"

echo "==> Build pacote Lambda incidentes"
rm -rf "$BUILD"
mkdir -p "$BUILD/portal/scripts/lib" "$BUILD/portal/assets/data" "$BUILD/portal/backend/scripts/lib"

cp "$AWS_DIR/index.mjs" "$BUILD/"
cp "$AWS_DIR/package.json" "$BUILD/"

cp "$ROOT/scripts/sync-incidentes-completo.mjs" "$BUILD/portal/scripts/"
cp "$ROOT/scripts/atualizar-incidentes-tcgl.mjs" "$BUILD/portal/scripts/"
cp "$ROOT/scripts/test-incidentes-tcgl-reachability.mjs" "$BUILD/portal/scripts/"
cp "$ROOT/scripts/lib/incidentes-state-s3.mjs" "$BUILD/portal/scripts/lib/"

cp "$ROOT/backend/scripts/importar-planilha-dsql.mjs" "$BUILD/portal/backend/scripts/"
cp "$ROOT/backend/scripts/lib/dsql-import.mjs" "$BUILD/portal/backend/scripts/lib/"
cp "$ROOT/backend/package.json" "$BUILD/portal/backend/"
cp "$ROOT/backend/package-lock.json" "$BUILD/portal/backend/"

echo "==> npm install (Lambda + backend DSQL)"
cd "$BUILD"
npm install --omit=dev 2>/dev/null || npm install
cd "$BUILD/portal/backend"
npm ci --omit=dev 2>/dev/null || npm ci

ZIP="$AWS_DIR/incidentes-sync.zip"
rm -f "$ZIP"
(cd "$BUILD" && zip -rq "$ZIP" . -x "*.git*")

echo "==> Pacote: $ZIP ($(du -h "$ZIP" | awk '{print $1}'))"

if ! command -v aws >/dev/null 2>&1; then
  echo "AWS CLI não encontrado. Pacote gerado; deploy manual:"
  echo "  aws lambda update-function-code --function-name $FUNC_NAME --zip-file fileb://$ZIP --region $REGION"
  exit 0
fi

if ! aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
  echo "Sem credenciais AWS. Pacote gerado em $ZIP"
  exit 0
fi

if aws lambda get-function --function-name "$FUNC_NAME" --region "$REGION" >/dev/null 2>&1; then
  echo "==> Atualizando código Lambda $FUNC_NAME"
  aws lambda update-function-code \
    --function-name "$FUNC_NAME" \
    --zip-file "fileb://$ZIP" \
    --region "$REGION" \
    --no-cli-pager
  echo "Deploy OK."
else
  echo "Função $FUNC_NAME não existe. Rode primeiro:"
  echo "  bash scripts/deploy-incidentes-lambda.sh"
fi

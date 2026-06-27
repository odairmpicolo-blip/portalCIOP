#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
AWS_DIR="$ROOT/aws/liberacao-sync"
BUILD="$AWS_DIR/.build"
FUNC_NAME="${LIBERACAO_SYNC_LAMBDA_NAME:-portal-ciop-liberacao-sync}"
REGION="${AWS_REGION:-sa-east-1}"

echo "==> Build pacote Lambda liberacao-sync"
rm -rf "$BUILD"
mkdir -p "$BUILD/backend"

cp "$AWS_DIR/index.mjs" "$BUILD/"
rsync -a --exclude node_modules --exclude .env "$ROOT/backend/" "$BUILD/backend/"

cd "$BUILD/backend"
npm ci --omit=dev 2>/dev/null || npm ci

ZIP="$AWS_DIR/liberacao-sync.zip"
rm -f "$ZIP"
(cd "$BUILD" && zip -rq "$ZIP" . -x "*.git*")

echo "==> Pacote: $ZIP ($(du -h "$ZIP" | awk '{print $1}'))"

if ! command -v aws >/dev/null 2>&1 || ! aws sts get-caller-identity --region "$REGION" >/dev/null 2>&1; then
  echo "Sem AWS — pacote em $ZIP"
  exit 0
fi

if aws lambda get-function --function-name "$FUNC_NAME" --region "$REGION" >/dev/null 2>&1; then
  aws lambda update-function-code \
    --function-name "$FUNC_NAME" \
    --zip-file "fileb://$ZIP" \
    --region "$REGION" \
    --no-cli-pager
  echo "Deploy OK."
else
  echo "Função $FUNC_NAME não existe. Rode: bash scripts/deploy-liberacao-sync-lambda.sh"
fi

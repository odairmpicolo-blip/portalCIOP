#!/usr/bin/env bash
# Commit + push com rebase (CI). Uso: ci-git-commit-push.sh "mensagem" caminho [caminho...]
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Uso: ci-git-commit-push.sh \"mensagem\" <arquivo ou glob> [...]" >&2
  exit 1
fi

MESSAGE="$1"
shift

git add -- $*
if git diff --staged --quiet; then
  echo "Sem alterações para commit."
  exit 0
fi

git commit -m "$MESSAGE"

for attempt in 1 2 3 4 5; do
  if git pull --rebase origin main && git push origin main; then
    echo "Push OK."
    exit 0
  fi
  echo "Push falhou (tentativa $attempt/5), aguardando..."
  sleep "$((attempt * 2))"
done

echo "Não foi possível fazer push após 5 tentativas." >&2
exit 1

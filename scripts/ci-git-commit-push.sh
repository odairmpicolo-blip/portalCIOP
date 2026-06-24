#!/usr/bin/env bash
# Commit + push com rebase (CI). Uso: ci-git-commit-push.sh "mensagem" caminho [caminho...]
# Em conflito nos JSON gerados, prioriza a versão desta execução (dados frescos da planilha).
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Uso: ci-git-commit-push.sh \"mensagem\" <arquivo ou glob> [...]" >&2
  exit 1
fi

MESSAGE="$1"
shift
FILES=("$@")

git fetch origin main

git add -- "${FILES[@]}"
if git diff --staged --quiet; then
  echo "Sem alterações para commit."
  exit 0
fi

git commit -m "$MESSAGE"
COMMIT_SHA=$(git rev-parse HEAD)

rebase_em_andamento() {
  [ -d .git/rebase-merge ] || [ -d .git/rebase-apply ]
}

resolver_conflitos_rebase() {
  if ! rebase_em_andamento; then
    return 1
  fi

  echo "Conflito no rebase — mantendo versão gerada nesta execução..."
  while IFS= read -r f; do
    [ -n "$f" ] || continue
    git checkout --theirs -- "$f" 2>/dev/null || true
    git add -- "$f" 2>/dev/null || true
  done < <(git diff --name-only --diff-filter=U)

  git add -- "${FILES[@]}"
  GIT_EDITOR=true git rebase --continue
  return 0
}

reaplicar_arquivos_gerados() {
  echo "Fallback: reaplicando arquivos gerados sobre origin/main..."
  git rebase --abort 2>/dev/null || true
  git fetch origin main
  git reset --hard origin/main
  git checkout "$COMMIT_SHA" -- "${FILES[@]}"
  git add -- "${FILES[@]}"
  if git diff --staged --quiet; then
    echo "Sem alterações após reaplicar."
    return 0
  fi
  git commit -m "$MESSAGE"
  COMMIT_SHA=$(git rev-parse HEAD)
  return 0
}

sincronizar_e_push() {
  if git pull --rebase origin main; then
    return 0
  fi

  if resolver_conflitos_rebase; then
    return 0
  fi

  reaplicar_arquivos_gerados
  return 0
}

for attempt in 1 2 3 4 5; do
  if rebase_em_andamento; then
    git rebase --abort 2>/dev/null || true
  fi

  if sincronizar_e_push && git push origin main; then
    echo "Push OK."
    exit 0
  fi

  echo "Push falhou (tentativa $attempt/5), aguardando..."
  sleep "$((attempt * 2))"
done

echo "Não foi possível fazer push após 5 tentativas." >&2
exit 1

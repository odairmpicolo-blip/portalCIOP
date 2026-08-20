#!/usr/bin/env bash
# Copia os arquivos de UM commit do portal-teste para /tmp/portalciop-live e commita.
# Não usa ~/portalCIOP. Não faz rsync do working tree.
#
# Uso:
#   bash scripts/publicar-producao.sh <commit>           # só commit local no clone live
#   bash scripts/publicar-producao.sh <commit> --push    # pull --rebase + push origin main
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LIVE="${PORTAL_CIOP_LIVE:-/tmp/portalciop-live}"
REMOTE="${PORTAL_CIOP_REMOTE:-https://github.com/odairmpicolo-blip/portalCIOP.git}"
AUTHOR_NAME="odairmpicolo-blip"
AUTHOR_EMAIL="224998610+odairmpicolo-blip@users.noreply.github.com"

COMMIT=""
PUSH=0
for a in "$@"; do
  if [ "$a" = "--push" ]; then PUSH=1
  elif [ -z "$COMMIT" ]; then COMMIT="$a"
  fi
done
COMMIT="${COMMIT:-HEAD}"

skip_arquivo() {
  case "$1" in
    .github/workflows/*|.cursor/*|*.secrets*|backend/.env|**/node_modules/*|app/assets/*.map)
      return 0 ;;
    assets/data/*)
      return 0 ;;
  esac
  return 1
}

cd "$ROOT"
SHA=$(git rev-parse "$COMMIT")
MSG=$(git log -1 --format=%s "$SHA")

if [ ! -d "$LIVE/.git" ]; then
  git clone "$REMOTE" "$LIVE"
fi
git -C "$LIVE" fetch origin
git -C "$LIVE" checkout main
git -C "$LIVE" pull --rebase origin main

echo "==> Commit de teste: $SHA"
echo "==> $MSG"

COPIADOS=0
while IFS= read -r f; do
  [ -n "$f" ] || continue
  if skip_arquivo "$f"; then
    echo "pula  $f"
    continue
  fi
  if git -C "$ROOT" cat-file -e "$SHA:$f" 2>/dev/null; then
    mkdir -p "$LIVE/$(dirname "$f")"
    git -C "$ROOT" show "$SHA:$f" > "$LIVE/$f"
    git -C "$LIVE" add -- "$f"
    echo "copia $f"
    COPIADOS=$((COPIADOS + 1))
  else
    git -C "$LIVE" rm -f -- "$f" 2>/dev/null || true
    echo "remove $f"
  fi
done < <(git -C "$ROOT" diff-tree --no-commit-id --name-only -r "$SHA")

if [ "$COPIADOS" -eq 0 ] && git -C "$LIVE" diff --cached --quiet; then
  echo "Nada para commitar (só dumps/workflows, ou commit vazio)."
  exit 0
fi

git -C "$LIVE" -c user.name="$AUTHOR_NAME" -c user.email="$AUTHOR_EMAIL" commit -m "$MSG" || {
  echo "Nada novo no índice."
  exit 0
}

if [ "$PUSH" -eq 1 ]; then
  git -C "$LIVE" pull --rebase origin main
  git -C "$LIVE" push origin main
  git -C "$LIVE" log -1 --format='%h %an %s'
else
  echo "Commit no clone live. Para enviar: bash scripts/publicar-producao.sh $SHA --push"
fi

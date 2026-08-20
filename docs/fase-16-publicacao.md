# Fase 16 — Publicação (20/08/2026)

O site de produção é **GitHub Pages** no `portalCIOP` `main` → **www.portalciop.com.br**. Não há Firebase Hosting. Fastly cacheia ~10 min (`max-age=600`).

## Fluxo

1. Commit + push no **portal-teste**.
2. Copiar **só os arquivos desse commit** para `/tmp/portalciop-live` (nunca `~/portalCIOP`).
3. Autor `odairmpicolo-blip`. `pull --rebase` e `push origin main`. Sem force-push.
4. O workflow **Deploy GitHub Pages** roda no push (HTML/CSS/JS/`pages/`/`assets/`/`app/`).

Script: `bash scripts/publicar-producao.sh <commit> --push`  
Pula `assets/data/**`, `.github/workflows/**` e `.cursor/**`.

## Fora do Pages

| Peça | Como |
|---|---|
| Lambda API | `bash scripts/deploy-portal-api.sh` (depois de `npm test`) |
| Firestore rules | `npx firebase deploy --only firestore:rules --project portal-ciop` no clone live |
| Apps Script | reimplante manual no Google |
| YAML de Action | `docs/github-workflows/` se o PAT não tiver escopo `workflow` |

## O que não misturar

Dumps de `assets/data/**` (folha, liberação, telemetria) sobem pelos jobs de JSON, não no commit de código.

## Como conferir

Actions do `portalCIOP` → Deploy GitHub Pages verde. Abrir `https://www.portalciop.com.br/` (hard refresh se o Fastly atrasar).

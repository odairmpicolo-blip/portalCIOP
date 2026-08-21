# Fase 19 — Manutenção (20/08/2026)

Não é produto novo. É o que olhar quando o portal “parou” ou o JSON envelheceu.

## Todo dia (operação)

| Sintoma | Onde olhar | O que fazer |
|---|---|---|
| Home fora do ar | Actions **Monitorar portal** + `https://www.portalciop.com.br/` | Conferir Pages; Fastly até 10 min |
| Liberação / terminais velhos | Automações (datas do JSON) + Actions `portalCIOP` | Rodar o workflow na mão; secret da planilha |
| Telemetria / KM vazios | Action a cada 2 h; dump ~23 MB | TV usa o **manifest**; não baixar `dados.json` |
| Login recusa e-mail | Firestore `usuarios/{email}` ativo | Gerenciar Usuários |
| API 401/500 | CloudWatch `portal-ciop-api` | `npm test` e `bash scripts/deploy-portal-api.sh` |
| IA do relatório muda | Secret `RELATORIO_IA_SCRIPT_URL` / Apps Script | Reimplantar `scripts/relatorio-ia.gs` |
| Consulta do decreto muda | `consulta-decreto.gs` + `decreto_context.txt` | Reimplantar no Google |
| App iPhone “expirou” | Capacitor ~7 dias (Apple ID grátis) | `docs/mobile-app.md` |

## Código (quando mudar tela/API)

1. Trabalhar em `~/portal-teste`.
2. `npm test` se mexer na API.
3. `bash scripts/publicar-producao.sh <commit> --push`
4. **Não** commitar dumps de `assets/data/**` (folha, liberação, telemetria). Exceção: `decreto_context.txt`.
5. **Não** force-push em `main`. Clone de produção: `/tmp/portalciop-live`, nunca `~/portalCIOP`.

## Dívidas que ficam (não são fase nova)

- Apex `portalciop.com.br` sem DNS.
- JSON operacional no git (histórico inchado).
- PAT sem escopo `workflow` → YAML em `docs/github-workflows/`.
- Service Worker / push / E2E / MTRAN / e-mail de PDF — não existem no código.

## Como conferir

Menu **Automações** + **Integrações** + **Auditoria**. Actions do `portalCIOP` verdes. `npm test` na raiz.

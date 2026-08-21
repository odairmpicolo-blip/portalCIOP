# Fase 15 — Testes (20/08/2026)

Sem Cypress/Playwright: o portal é HTML estático + Lambda. A suíte que já existia é `node --test` em `backend/src/lib/`.

## O que esta fatia fez

- `npm test` na raiz: libs da API (`src/lib/*.test.js`) + resumo de km da TV. Não roda `test-connection.js` (precisa de DSQL).
- O deploy da Lambda (`scripts/deploy-portal-api.sh`) **só sobe se o teste passar**.
- Cópia `docs/github-workflows/testes.yml` e o mesmo YAML em `.github/workflows/` no **portal-teste**. No CIOP o PAT sem escopo `workflow` não cria a Action sozinha.

## O que já estava coberto

Datas ISO, cadastro/perfil, `audit_log` (recorte), merge de telemetria, IPV ajustado.

## O que não foi inventado

- Teste E2E no navegador.
- Teste contra DSQL de produção a cada push.

## Como conferir

```bash
npm test
```

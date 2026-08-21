# Fase 3 — Back-end (revisão 20/08/2026)

Não trocar por Laravel. A API central já é Express (`backend/`) empacotada na Lambda `portal-ciop-api` (`aws/portal-api` + `scripts/deploy-portal-api.sh`). O HTML do Pages continua estático; regras de dado (liberação, telemetria, CR-0108, relatórios) vivem nas rotas e em `backend/src/lib/`.

## Arquitetura (manter)

```
Navegador (www.portalciop.com.br)
  → Firebase Auth (token)
  → API Gateway HTTP (mesmo id do bus2-proxy)
      → Lambda portal-ciop-api (@vendia/serverless-express → backend/src/index.js)
          → Aurora DSQL / S3 / planilha Apps Script
```

Rotas no Gateway: `/liberacao`, `/telemetria`, `/snapshots`, `/terminais`, `/relatorios`, `/cr0108`, `/performance`, `/audit`, `/db-health`.

## O que esta fatia fez

| Item do checklist | Situação |
|---|---|
| Arquitetura central | Documentada; evoluir Express+Lambda |
| Regras fora do HTML | Já estavam em `backend/src/lib/` e rotas; páginas só consomem JSON/API |
| Erros padronizados | `{ ok, erro, codigo }` + `HttpError` + handler global (500 sem vazamento SQL em produção) |
| Validar no servidor | Datas ISO reais (`2026-02-31` recusado) em liberação, telemetria, relatórios |
| Logs | Uma linha JSON por request (`method`, `path`, `status`, `ms`, `uid`) no CloudWatch |

## Como testar local

```bash
cd backend && npm test
# ou na raiz: npm test
# com .env: npm run dev  → GET http://localhost:3000/health
```

Deploy da Lambda (produção): workflow **Implantar API do portal** — só depois de confirmar publicação e o teste passar.

Pendências da fase: nenhuma nesta fatia. Upload de PDF já valida data no `relatorios.js`; CR-0108 usa o mesmo `intervaloDatas` (recusa `2026-02-31`).

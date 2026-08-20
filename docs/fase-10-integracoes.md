# Fase 10 — Integrações (20/08/2026)

Nenhuma API nova. O mapa está em `docs/mapa-sistemas.md` e na tela **Integrações** (só Administrador): `pages/integracoes.html`.

## Sistemas no portal

| Sistema | Ligado? | Observação |
|---|---|---|
| Firebase Auth/Firestore | sim | login e `usuarios` |
| Aurora DSQL + Lambda API | sim | `/db-health` na tela de integrações |
| Clever CAD | sim (leitura) | scrape → JSON/S3; sem write |
| Clever 002 / `cr_0002` | sim | Incidentes CAD |
| Bus2 / Mobilibus | sim | `bus2-proxy` |
| Fleetbus | sim | página ao vivo + KM |
| Noxxon / GPS Reports | sim | comparação de KM |
| Google Sheets / Apps Script | sim | URLs nos secrets, não no HTML público |
| Hitachi / e-mail CSV | sim | telemetria via planilha |
| **MTRAN** | **não** | zero cliente, URL ou secret no repositório |

## MTRAN

Procurei no código e não há módulo, webhook nem variável. Sem contrato/documentação da API, **não inventei** a ligação. Quando houver endpoint e credencial, entra numa fatia só disso.

## Segredos

Continuam fora do git: GitHub Secrets, `backend/.env`, Secrets Manager. A tela de integrações não lista chaves.

## Como conferir

Menu lateral → **Integrações** (Administrador). A linha da API deve mostrar DSQL ok.

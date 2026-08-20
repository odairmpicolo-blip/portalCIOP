# Fase 12 — Automações (20/08/2026)

Nenhum job novo. Catálogo do que já roda, na tela **Automações** (Administrador) e em `docs/github-workflows/`.

## Agenda (UTC)

| Workflow | Cron | Dado |
|---|---|---|
| `atualizar-liberacao-hoje.yml` | `*/5 * * * *` | JSON liberação + DSQL |
| `atualizar-terminais.yml` | `*/5 * * * *` | `terminais-agora.json` |
| `monitorar-portal.yml` | `*/15 * * * *` | ping `www.portalciop.com.br` |
| `atualizar-folha-servico.yml` | `*/30 * * * *` | folha, IPV, autuações, ICV + DSQL |
| `atualizar-telemetria.yml` | `0 */2 * * *` | telemetria JSON |
| `atualizar-bus2.yml` | `0 6 * * *` | rotas/horários Bus2 |
| `deploy-github-pages.yml` | push `main` | site estático |

## Só no botão

Implantar API, Bus2 proxy, migração DSQL, diagnóstico de relatórios/S3.

## O que não foi inventado

- E-mail / PDF agendado (não há no código).
- Action de incidentes: arquivo antigo desligado; CAD entra por Lambda/sync.
- Apps Script: reimplante no Google continua manual.

## YAML no git

Cópia em `docs/github-workflows/` (inclui telemetria e Bus2). PAT sem escopo `workflow` não altera `.github/workflows/` no GitHub.

## Como conferir

Menu lateral → **Automações**. As datas devem bater com os últimos commits automáticos de JSON.

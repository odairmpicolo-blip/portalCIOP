# Fase 14 — Auditoria (20/08/2026)

A tabela `audit_log` já existia (Fase 4). Esta fatia deixa o administrador **ler** a trilha e impede que falha no log derrube a escrita.

## O que entra no log

Liberação (linha e import), telemetria import, metadado de relatório, snapshots e terminais (API key). Sem o blob JSON.

## Tela

**Auditoria** (Administrador): `GET /audit` — só Firebase + perfil Administrador. Sem API key. Sem senha, sem payload `antes`/`depois` na lista.

## O que não foi inventado

- Histórico de login / tentativas falhas: isso é o console **Firebase Authentication**.
- Cadastro de usuários: Firestore, sem espelho no DSQL.

## Lambda

Rota API Gateway `ANY /audit` no `template.yaml`. Vale depois de implantar (`scripts/deploy-portal-api.sh`).

## Como conferir

Menu → Auditoria. Sem token deve ser 401; supervisor 403; admin vê a lista (pode estar vazia até a próxima escrita).

# Fase 13 — Performance (20/08/2026)

Sem CDN extra: o Pages já passa pelo Fastly (`max-age=600`). Sem tirar o dump de telemetria do git nesta fatia.

## O que esta fatia fez

- A TV **não baixa** `telemetria/dados.json` (~23 MB). O km mensal vai no `manifest.json` (`kmPorMes` / `kmAno`), gerado no import da planilha.
- Fonte Inter da TV deixa de ser `@import` (bloqueia) e passa a `preconnect` + stylesheet.
- Logo da home e do login com `fetchpriority="high"`.
- A tela Dados de telemetria já recusava o dump grande (`JSON_MAX_BYTES` / `total > 15000`).

## O que ficou de fora

- Mover JSON operacional para S3 (muda os workflows e o histórico git).
- Comprimir PNGs de campanha.
- Índice OTP `/performance`: rota já existe; o JSON no S3 depende do agente na rede do CIOP.

## Como conferir

Abrir o painel TV: o bloco de km deve preencher sem baixar 23 MB (Network → só `manifest.json` da telemetria).

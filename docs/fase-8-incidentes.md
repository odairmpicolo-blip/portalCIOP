# Fase 8 — Incidentes (20/08/2026)

O portal **não cadastra** incidente no Clever. A fonte é o CAD (scrape TCGL + `cr_0002`). O que o CIOP registra por conta própria é o **Relatório de Ocorrência** (PDF na AWS).

## Peças

| Tela | Papel |
|---|---|
| `incidentes-dashboard.html` | Lista TCGL (JSON + snapshot AWS), KPIs, filtros, atualizar |
| `incidentes-cad.html` | Relatório 002 / `cr_0002`, status, CSV |
| `incidentes-analise.html` | Gráficos e recortes do mesmo conjunto TCGL |
| `relatorio-ocorrencia.html` | PDFs internos (criar em `criar-relatorio.html`) |
| `incidentes-alerta.js` | Aviso na home se houver pendência com o analista (10 dias) |

Atalho antigo `pontualidade-incidentes.html` continua redirecionando para o CAD.

## O que esta fatia fez

- Navegação única **TCGL · CAD · Análise · Ocorrência** no topo dessas quatro telas (`incidentes-nav.js`).
- Erro da API em português no CAD e na lista de ocorrências (faixa da Fase 7).
- Não há escrita de volta no CAD da Clever (não temos API de abertura/fechamento).

## Como conferir

Abrir qualquer uma das quatro páginas logado e usar a faixa de atalhos. Atualizar e exportar CSV no CAD. Home: alerta se o analista tiver pendência.

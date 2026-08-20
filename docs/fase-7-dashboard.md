# Fase 7 — Dashboard (20/08/2026)

Não criei um dashboard novo. A home já é o painel principal (hora, data, clima, online, módulos, ativos, avisos + cards por módulo). Os indicadores operacionais já têm tela própria.

## Onde está cada painel

| Tela | KPIs | Filtros | Gráficos | Atualizar | Exportar |
|---|---|---|---|---|---|
| Home (`index.html`) | contexto do dia | busca / abas | — | presença | — |
| IPV (`pontualidade.html`) | sim | ano / trimestre / mês / dia / linha | Chart.js | JSON + banco | PDF |
| ICV (`icv.html`) | sim | período | sim | JSON | PDF |
| KM (`km-dashboard.html`, `comparacao-km.html`) | sim | sim | sim | JSON | — |
| Liberação (`liberacao-dashboard.html`) | totais por categoria | De / Até | 8 gráficos | JSON + planilha | PDF |
| Incidentes (`incidentes-dashboard.html`, CAD, análise) | sim | busca e campos | sim | botão Atualizar | CSV no CAD |

TV (`painel-tv.html`, `pontualidade-tempo-real.html`) é kiosk, sem login.

## O que esta fatia fez

Feedback da API nas telas (pendência da Fase 6):

- `assets/js/portal-dashboard-ui.js` — texto em português por `codigo` (`SEM_CADASTRO`, `ACESSO_DESATIVADO`, timeout, rede).
- `awsFetch` usa a mesma mensagem e anexa `codigo` / `status` no `Error`.
- Faixa `#portalDashAviso` no topo do conteúdo (unify).
- Ligado em IPV, Liberação e Incidentes.

## Como conferir

1. Abrir Liberação / Incidentes / IPV logado.
2. Com rede ok, a faixa vermelha não aparece.
3. Sem API (ou sessão inválida), a faixa explica o erro em português — não o código cru.

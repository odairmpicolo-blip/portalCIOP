# Fase 9 — Relatórios (20/08/2026)

Não há um gerador único. Cada relatório já tem tela, filtro e exportação. O catálogo é `pages/relatorios.html`.

## O que já existia

| Relatório | Formatos | Onde |
|---|---|---|
| Liberação | CSV, Excel, PDF | `liberacao-relatorio.html` |
| Folha de serviço | CSV, Excel, PDF | `folha-servico-relatorio.html` |
| Ocorrência (PDF interno) | PDF na AWS | `criar-relatorio.html` + `relatorio-ocorrencia.html` |
| IPV / ICV | PDF | `pontualidade.html`, `icv.html` |
| CAD | CSV | `incidentes-cad.html` |
| CR-0108 | tela + diagnóstico | `cr0108.html`, `cr0108-ajustes.html` |
| Telemetria diária | tela | `consumo-diario-2026-05-12.html` |

Agenda automática de PDF **não** existe (e não foi inventada): os JSON sobem por workflow; o PDF de ocorrência é sob demanda.

## O que esta fatia fez

- Catálogo: cards de **Criar ocorrência**, **IPV**, **ICV** e **KM**.
- Faixa **Catálogo · Criar · Liberação · Folha · Ocorrência**.
- KM: botão **CSV** da tabela filtrada.
- Criar relatório: faixa de erro em português.
- API: data do upload de PDF recusa `2026-02-31` (`DATA_INVALIDA`). CR-0108 usa o mesmo helper.

## Como conferir

Abrir Relatórios no portal, passar pelos cards novos, exportar CSV no KM e um PDF na Liberação ou na Folha.

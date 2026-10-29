# Revisão do portal publicado — 29/10/2026

Pendências da revisão em `www.portalciop.com.br`. Validação local: 390×844, 1024×768 e 1440×900, temas claro e escuro. TV ICV: 1920×1080. Sem envio de relatório e sem alteração de registro operacional.

## Matriz

| Item | Página | O que mudou | Fonte / regra | 390 | 1024 | 1440 | Claro | Escuro | Publicado |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `criar-relatorio.html` / v2 | Cargo e assinatura usam `--portal-field` + `--portal-text`. Chip `#anexosStatus` com `[hidden]` deixa de aparecer entre Anexo e Enviar (não é controle; o input de arquivo continua oculto). | — | Layout | Layout | Layout | Preservado | Texto no campo | Após push |
| 2 | `Folhadeservico1.html` + dashboard | Ícone do calendário fica no campo Data (`min-width: 0`, indicator absoluto). Cabeçalhos da planilha quebram linha; tabela `max-content` com rolagem horizontal. | — | Ícones | Ícones | Tabela | OK | OK | Após push |
| 3 | `dados-telemetria.html` | `--tel-heading` separado de `--tel-navy` (gradiente). Escuro: heading/texto claros em painel escuro; claro: heading navy em painel claro. | — | Filtros | Filtros | Painel | OK | OK | Após push |
| 4 | `cr0108-ajustes.html` | Horário atual, horário sugerido e etiquetas Antecipar/Atrasar/Zero com superfície + texto por tema. Adiantado vermelho, Atrasado amarelo, No horário verde. | — | Tabela | Tabela | Tabela | OK | OK | Após push |
| 5 | `performance-tempo-real.html` | Cumprimento do **dia civil** via `GET /cr0108/share/icv` (`fonte=tcgl` e `ldsul`, `de=ate=hoje`). Exibe realizadas/programadas, % e corte. Sem dado do dia: “—” — **não** usa média histórica. Pontualidade continua nas barras; hora a hora nas linhas (API mapa). | CR ICV `scheduled_trips` / `trips`. Corte: dia civil `America/Sao_Paulo` (`data_ref`). Sem corte horário na API. Total = soma viagens ÷ soma programadas. | Kiosk | Kiosk | Kiosk | Kiosk próprio | Kiosk próprio | Após push |
| 6 | `painel-ciop.html` ICV Total | Deixa de ser média simples. Sistema = soma realizadas ÷ soma programadas no mesmo período. Sem volumes: “—” e nota de pendência. IPV Total permanece média das áreas. | Mesma API ICV da TV | — | — | — | Kiosk | Kiosk | Após push + ciclo 1920 |
| 7 | `index.html` Início | Catálogos ocultos em Início (`data-home-view=inicio`), visíveis na busca global. Operação, Indicadores, Relatórios e Painéis de TV mostram o catálogo da área. | — | Dock | Nav | Nav | Foto + vidro | Foto + vidro | Após push |

## Marca

Logos `portal-ciop-claro.png` / `portal-ciop-escuro.png` e favicon atuais. Foto suavizada, Liquid Glass, temas claro / escuro / automático.

## Capturas

Pasta [`assets/`](assets/README.md), prefixo `rev-20261029-`.

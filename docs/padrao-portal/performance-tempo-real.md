# Performance em tempo real

Página: `pages/performance-tempo-real.html` (composição kiosk, não o chrome Liquid Glass das internas). Três colunas: **TCGL**, **LondriSul** e **Total**. Pontualidade em barras; pontualidade por hora em linhas (Chart.js). Não há cumprimento de viagens nesta página.

## Pontualidade (confirmado no código)

Fonte: `https://londrisul.online/relatorios/mapa/api.php` (chave já usada pela página). Atualiza a cada 5 s.

- TCGL: a garagem TCGL (`onTimePercent`, `latePercent`, `earlyPercent`).
- LondriSul: `resumo.no_horario`, `resumo.atrasado`, `resumo.adiantado`. Sem resumo, a média das garagens que não são TCGL.
- Total: média aritmética de TCGL e LondriSul. Se só uma área tiver valor, o Total usa essa área.
- Adiantado permanece vermelho. Atrasado permanece âmbar. No horário verde. Ordem: No horário, Atrasado, Adiantado.

O histórico hora a hora fica no navegador (`ciop-mapa-pontualidade-horas-v1`). Hora sem leitura fica vazia. O stamp da API (`atualizado_em` / `capturado_em`) é a **atualização**; não há recorte de período diário nesta fonte.

## Cumprimento diário — regra proposta (não calculada nesta página)

Não alterar o código de pontualidade nem o ICV da TV até a fonte confirmar o que entra no numerador e no denominador.

Regra desejada na Performance em tempo real (quando houver dados):

| Recorte | Fórmula |
| --- | --- |
| Empresa (TCGL ou LondriSul) | realizadas ÷ programadas × 100 |
| Total | soma das realizadas das empresas ÷ soma das programadas × 100 |
| Denominador 0 | texto **“Sem programação”** — não pintar 0% nem “—” de pontualidade |
| Período e corte | os mesmos para TCGL, LondriSul e Total |

Pendências **na fonte** (não inventar no front):

1. Quais viagens contam como **programadas** (tabela do dia, escala, CR-0108, ICV).
2. Quais contam como **realizadas** (partida, chegada, ponto de controle).
3. Cancelamento: sai do denominador, fica como não realizada, ou outro tratamento.
4. Viagem extra: entra só no numerador, nos dois, ou fora.
5. Viagem **ainda não vencida** no horário de corte: fora do denominador, ou programada em aberto.
6. Horário de corte oficial e fuso (`America/Sao_Paulo`).
7. Se o ICV (`pages/icv.html`) e o board da TV já usam essa regra ou outra (a TV documenta cumprimento como realizadas/programadas no período, e o **Total da TV** é média aritmética das áreas — diferente da soma proposta acima).

A API do mapa (`parseEmpresas`) **não** traz programadas, realizadas nem corte. ICV e `painel-ciop.html` são outros recortes. Sem essas respostas, a padronização visual desta tela permanece só nas barras de pontualidade.

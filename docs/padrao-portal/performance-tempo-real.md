# Performance em tempo real

Página: `pages/performance-tempo-real.html` (composição kiosk, não o chrome Liquid Glass das internas). Três colunas: **TCGL**, **LondriSul** e **Total**. Pontualidade em barras; pontualidade por hora em linhas (Chart.js). Cumprimento do dia (realizadas / programadas e %) vem da API compartilhada de ICV, só do `data_ref` de hoje.

## Pontualidade (confirmado no código)

Fonte: `https://londrisul.online/relatorios/mapa/api.php` (chave já usada pela página). Atualiza a cada 5 s.

- TCGL: a garagem TCGL (`onTimePercent`, `latePercent`, `earlyPercent`).
- LondriSul: `resumo.no_horario`, `resumo.atrasado`, `resumo.adiantado`. Sem resumo, a média das garagens que não são TCGL.
- Total: média aritmética de TCGL e LondriSul. Se só uma área tiver valor, o Total usa essa área.
- Adiantado permanece vermelho. Atrasado permanece âmbar. No horário verde. Ordem: No horário, Atrasado, Adiantado.

O histórico hora a hora fica no navegador (`ciop-mapa-pontualidade-horas-v1`). Hora sem leitura fica vazia. O stamp da API (`atualizado_em` / `capturado_em`) é a **atualização**; não há recorte de período diário nesta fonte.

## Cumprimento do dia (implementado)

Fonte: `GET …/cr0108/share/icv?token=…&fonte=tcgl|ldsul&de=YYYY-MM-DD&ate=YYYY-MM-DD` (mesmo contrato da TV). Campos `scheduled_trips` (programadas) e `trips` (realizadas) na linha cujo `data` é o dia civil de `America/Sao_Paulo`.

| Recorte | Fórmula |
| --- | --- |
| TCGL / LondriSul | `trips` ÷ `scheduled_trips` × 100, só a linha de hoje |
| Total | soma das realizadas ÷ soma das programadas × 100, **as duas** áreas no mesmo dia |
| Sem linha de hoje | “—” e texto de ausência — **não** completa com dia anterior nem média |
| Sem volumes | “—” — **não** usa o percentual ICV isolado como se fosse volume |
| Corte | dia civil CR ICV (`data_ref`). A API **não** expõe hora de corte |

A consolidação do ICV costuma atrasar em relação ao relógio (em 29/10/2026 a última linha disponível era 26/10). Isso é vazio do dia, não falha de pontualidade.

A API do mapa continua só para pontualidade (barras e linhas). Os dois indicadores não se misturam.

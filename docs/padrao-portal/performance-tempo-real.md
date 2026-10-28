# Performance em tempo real

Página: `pages/performance-tempo-real.html`. A tela voltou ao desenho anterior ao cumprimento do dia: três cartões (TCGL, LondriSul e Total), a faixa das garagens e um gráfico hora a hora do sistema. Não há cumprimento de viagens nesta página.

## Pontualidade

Fonte: `https://londrisul.online/relatorios/mapa/api.php` (chave já usada pela página). Atualiza a cada 5 s.

- TCGL: a garagem TCGL (`onTimePercent`, `latePercent`, `earlyPercent`).
- LondriSul: `resumo.no_horario`, `resumo.atrasado`, `resumo.adiantado`. Sem resumo, a média das garagens que não são TCGL.
- Total: média aritmética de TCGL e LondriSul. Se só uma área tiver valor, o Total usa essa área.
- Adiantado permanece vermelho. Atrasado permanece âmbar. A ordem na tela é No horário, Atrasado, Adiantado.

O histórico hora a hora fica no navegador (`ciop-mapa-pontualidade-horas-v1`). Hora sem leitura fica vazia.

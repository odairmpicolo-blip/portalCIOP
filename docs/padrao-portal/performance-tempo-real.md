# Performance em tempo real

Página: `pages/performance-tempo-real.html` (composição kiosk). Três colunas: **TCGL**, **LondriSul** e **Total**. Pontualidade em barras. Pontualidade por hora em **linhas** (Chart.js). Cores: No horário verde, Adiantado vermelho, Atrasado amarelo.

## Causa da regressão (out/2026)

O bloco **Cumprimento do dia** (ICV) foi inserido nos cartões das empresas. O kiosk é `100vh` com `overflow: hidden` e coluna flex. A linha extra nos cartões (`grid-template-rows: auto auto minmax(120px,1fr)`) aumentou a altura da grade e esgotou o espaço do `.vivo-chart`. O canvas ficou com altura efetiva 0 (`flex:1; min-height:0`), então o Chart.js inicializava sem área visível.

A consulta ICV do dia costuma não ter linha de hoje (consolidação atrasada). Isso não deveria impedir a pontualidade, mas o indicador vazio ocupava o painel e, no layout, o gráfico.

## Correção

- Removido o cumprimento do painel principal até existir fonte com realizadas, programadas, empresa, período **e horário de corte**.
- Cartões voltam a duas linhas (título + barras).
- Área do gráfico com altura mínima e canvas absoluto no plot, para o Chart.js ter dimensões reais.
- Série continua `type: "line"`, com 24 horas civis em `America/Sao_Paulo`. `spanGaps: false` — hora sem leitura fica lacuna; não se interpola nem se inventa ponto.
- Cada hora usa a leitura real mais recente daquela hora (bucket da hora ou slot de 5 minutos). Um ponto isolado tem raio 7; com vizinho, raio 3. Sem histórico no dia, o texto explica que as barras são a leitura de agora. Com histórico, o texto é “Histórico disponível a partir de HH:mm”, no fuso `America/Sao_Paulo`, a partir do primeiro instante gravado. Hora anterior sem `ts` entra como `HH:00` do bucket, que é a resolução do armazenamento. Falha da API não desenha ponto.
- Estados: “Carregando…”, “Sem histórico…”, erro de consulta. O último histórico válido permanece na tela se a API falhar depois.
- Pontualidade (mapa, 5 s) não depende de ICV. Não há fetch de cumprimento nesta página.

## Pontualidade (confirmado no código)

Fonte: `https://londrisul.online/relatorios/mapa/api.php` (chave da página). Poll 5 s.

- TCGL: garagem TCGL (`onTimePercent`, `latePercent`, `earlyPercent`).
- LondriSul: `resumo.no_horario`, `resumo.atrasado`, `resumo.adiantado`. Sem resumo, média das garagens que não são TCGL.
- Total: média aritmética de TCGL e LondriSul (só pontualidade). Se só uma área tiver valor, o Total usa essa área.
- Histórico: `localStorage` `ciop-mapa-pontualidade-horas-v1` e o dia em `ciop-mapa-pontualidade-dias-v1`. A API do mapa só devolve a leitura atual; não há série do dia para reconstituir. O Firestore `performanceHoras` só é lido por administrador, então o kiosk anônimo não recupera o dia de outro navegador. Recarregar a página e a consulta a cada 5 s não apagam horas já gravadas. Stamp `atualizado_em` / `capturado_em`.

## Cumprimento de viagens — integração pendente

Há API de ICV (`GET …/cr0108/share/icv`) com `trips` e `scheduled_trips` por empresa e `data_ref` civil. **Não** há horário de corte operacional do dia ao vivo. A linha de hoje frequentemente não existe (atraso de consolidação). Por isso o bloco **não** volta ao kiosk:

- Não se mostra 0, média histórica nem dia anterior como cumprimento do dia.
- Total de cumprimento, quando existir fonte válida, será soma das realizadas ÷ soma das programadas — nunca média simples dos percentuais.
- Se a fonte futura existir e estiver temporariamente fora: “Dados indisponíveis” + última atualização válida. Sem misturar com a pontualidade.

Última versão estável do kiosk sem cumprimento: commit `27dac19c`.

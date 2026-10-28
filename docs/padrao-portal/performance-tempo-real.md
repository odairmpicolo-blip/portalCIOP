# Performance em tempo real

Página: `pages/performance-tempo-real.html`. Pontualidade e cumprimento do dia saem da API do mapa, no mesmo ciclo. O cumprimento não entra na média de No horário, Adiantado ou Atrasado.

A tela é três colunas iguais: TCGL, LondriSul e Total do sistema. Em cada coluna: barras verticais de pontualidade, cumprimento do dia e a linha hora a hora daquela coluna. O histórico de horas fica no navegador; hora sem leitura fica vazia. A fonte não manda a quantidade de viagens, então a linha “programadas · realizadas” não aparece.

## Pontualidade

Fonte: `https://londrisul.online/relatorios/mapa/api.php` (chave já usada pela página). Atualiza a cada 5 s.

- TCGL: a garagem TCGL (`onTimePercent`, `latePercent`, `earlyPercent`).
- LondriSul: `resumo.no_horario`, `resumo.atrasado`, `resumo.adiantado`. Sem resumo, a média das garagens que não são TCGL.
- Total: média aritmética de TCGL e LondriSul. Se só uma área tiver valor, o Total usa essa área. Essa conta não mudou.
- Adiantado permanece vermelho. Atrasado permanece âmbar. A ordem na tela é No horário, Adiantado, Atrasado.

## Cumprimento de viagens do dia, ao vivo

Mesma API do mapa, no mesmo ciclo de 5 s. Não usa o dia fechado do `share/icv`: aquele relatório não tem horário de corte e, em 28/10/2026, parava em 25/10.

O resumo do CAD traz `partidas_percent` e `viagens_perdidas_percent`. Na leitura conferida os dois fecham em 100 (tolerância de 2 pontos, por arredondamento). O cumprimento exibido é `partidas_percent`: as viagens que saíram até o relógio da própria leitura. O rótulo é “Até HH:MM”, com a hora de `atualizado_em`. Não se escreve um corte inventado.

- LondriSul: o resumo da chamada padrão. Nela a TCGL vem marcada como excluída (`padrao_sem_tcgl: true`) e o resumo é a área 2.
- Total do sistema: a mesma API com `todas=1`. Só entra se a resposta vier com `padrao_sem_tcgl: false`, ou seja, o CAD já incluiu a TCGL. Não é a média do percentual da LondriSul com outro número.
- TCGL: a garagem não traz partidas nem viagens perdidas. A tela mostra “Cumprimento indisponível”. Não se calcula a TCGL pela diferença entre o total e a LondriSul.

A fonte não manda viagens programadas nem realizadas. Essas contagens não aparecem. A diferença entre partidas e 100 não é rotulada como supressão.

Atualização: a cada 5 s, junto com a pontualidade. O cabeçalho do cumprimento usa o mesmo corte. Falha sem leitura anterior: “Cumprimento indisponível”, sem zerar. Falha depois de uma leitura válida: mantém o último percentual e marca “dados antigos”. O último valor fica em `sessionStorage` (`ciop-perf-cumprimento-vivo-v1`).

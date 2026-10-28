# Performance em tempo real

Página: `pages/performance-tempo-real.html`. A pontualidade continua na API do mapa. O cumprimento do dia é outra leitura e não entra na média de No horário, Adiantado ou Atrasado.

## Pontualidade

Fonte: `https://londrisul.online/relatorios/mapa/api.php` (chave já usada pela página). Atualiza a cada 5 s.

- TCGL: a garagem TCGL (`onTimePercent`, `latePercent`, `earlyPercent`).
- LondriSul: `resumo.no_horario`, `resumo.atrasado`, `resumo.adiantado`. Sem resumo, a média das garagens que não são TCGL.
- Total: média aritmética de TCGL e LondriSul. Se só uma área tiver valor, o Total usa essa área. Essa conta não mudou.
- Adiantado permanece vermelho. Atrasado permanece âmbar. A ordem na tela é No horário, Adiantado, Atrasado.

## Cumprimento de viagens do dia

Fonte pública já usada no Painel CIOP, sem endpoint novo:

`GET /cr0108/share/icv?token=IPV@2026`

- TCGL: sem `fonte` (`cr_custom`).
- LondriSul: `fonte=ldsul` (`cr_custom_ldsul`).
- Campos usados: `data`, `scheduled_trips`, `trips`.
- A página pede os últimos 21 dias e fica com o dia mais recente em que as duas contagens são números e as programadas são maiores que zero. Não faz média da janela, nem do mês, nem da semana.

Fórmula, a mesma do Painel CIOP (`agregarIcv`):

`cumprimento = viagens realizadas / viagens programadas × 100`

A coluna `icv` do relatório não entra no número da tela: ela não fecha com as viagens da mesma linha. O percentual exibido é o das contagens, para programadas e realizadas serem o mesmo dia.

Período: um dia civil fechado (`data_ref`). A rota não traz horário de corte. A tela escreve “Dia fechado” e a data. Não escreve “hoje até HH:MM”. Se o dia da fonte for o dia de hoje, o rótulo continua “dia fechado” e acrescenta “sem horário de corte”. Não se comparam realizadas de agora com a programação que ainda vai ocorrer.

Em 28/10/2026 as duas fontes paravam em 25/10/2026. A tela mostra essa data; não trata o atraso como se fosse o dia corrente.

Total do sistema: soma das programadas e soma das realizadas, só quando TCGL e LondriSul têm a mesma `data`. Não é a média dos dois percentuais. Datas diferentes, ou uma empresa sem dia válido: o total fica “indisponível”. Cada empresa continua com o próprio dia.

Viagens não realizadas não aparecem. A rota pública não devolve `suppressed_trips`. A diferença programadas − realizadas não é supressão.

Atualização: o workflow `atualizar-folha-servico.yml` recarrega o ICV a cada 30 min. A página relê a cada 5 min. O relógio do cabeçalho do cumprimento é o dessa leitura, separado do relógio da pontualidade.

Indisponibilidade:

- Sem leitura válida nesta abertura: “Cumprimento indisponível”. O percentual não vira zero.
- Falha depois de uma leitura válida: mantém o último dia e marca “dados antigos”.
- O último dia válido também fica em `sessionStorage` (`ciop-perf-icv-dia-v1`) para a TV não abrir em branco se a rede falhar na hora.

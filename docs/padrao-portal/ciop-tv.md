# CIOP TV

Composição de `pages/painel-ciop.html` para exibição contínua em 16:9. A referência é tela cheia, principalmente 1920×1080. Conferir também 1366×768 e 3840×2160. A janela estreita do navegador não define o enquadramento.

O kiosk não usa o chrome do portal (`:has(#kiosk)` fica de fora do visual e do Liquid Glass). Tema claro, escuro ou automático não troca o fundo desta tela.

## Composição

Margem do palco: `clamp(16px, 2vh, 28px)` na vertical e `clamp(28px, 2.6vw, 48px)` na horizontal, com folga extra embaixo da barra de progresso. `html` e `body` não rolam. O reflow é CSS; o tamanho dos percentuais é recalculado no `resize` e no `ResizeObserver`, sem recarregar a página.

| Faixa | Onde fica |
| --- | --- |
| Cabeçalho | Logo, “CIOP · Londrina” e o título da tela à esquerda. Período da semana à direita, no mesmo lugar em todas as telas de indicador. |
| Miolo | Uma tela por vez. A que sai some na hora; a que entra aparece em 0,22 s. Não há deslocamento, então os textos não se sobrepõem. |
| Rodapé | Período dos indicadores, data/hora de Londrina e hora da última leitura. Sem lista de módulos e sem a palavra “ao vivo” para série histórica. |
| Progresso | Uma barra de 3 px. É o tempo da tela, não a seleção do dia. |

Capa e campanha em arte ocupam a tela inteira. O cabeçalho e o rodapé saem, porque a imagem já traz a marca e o texto. A barra de progresso continua.

## Tipografia

Outfit. Números tabulares. Título da tela até 40 px. Média semanal é o número principal (encaixado na largura do card, teto 136 px em Full HD e proporcional em 4K). O dia é secundário. Rodapé no mínimo 16 px. Sem degradê no número: branco sobre o vidro.

## Cores

Fundo azul profundo (`#04060f` → `#0a1024`), vidro fosco, filete na cor da área.

| Área | Cor |
| --- | --- |
| TCGL | `#38bdf8` |
| LondriSul | `#fb923c` |
| Total | `#e2e8f0` |

A variação em pontos percentuais é comparação do indicador: verde quando sobe, azul quando desce (`.firm-delta.is-compare`). Isso não é a classificação operacional. Adiantado permanece vermelho e Atrasado âmbar nas telas que mostram essa classificação; este painel não as apresenta.

## Telas e tempos

Os tempos abaixo não foram alterados nesta revisão.

| Tela | Duração |
| --- | --- |
| Capa | 8 s (`CAPA_MS`) |
| Pontualidade −2/+6 | 30 s, em 7 passos de `round(30000 / 7)` ms (`DIA_MS`) |
| Pontualidade −1/+3 | igual |
| Cumprimento de viagem | igual |
| Previsão | 10 s |
| Campanha do mês | 10 s |

O ciclo completo fica em torno de 1 min 58 s. `IPV_MS` e `ICV_MS` (30 s) alimentam a barra da tela. Quem avança o indicador é o passo do dia, não um segundo relógio. Os dias aparecem nomeados (`ter` + data) na base do card. A barra luminosa antiga de cada card foi retirada.

## Dados

Nada da fórmula mudou.

- Semana operacional: domingo a sábado. A semana nova entra na terça, em `America/Sao_Paulo`.
- Média da semana de pontualidade: soma de `ipv × pontos de controle` / soma dos pontos. Sem pontos, cai para a média simples dos dias.
- Cumprimento: viagens realizadas / programadas no período. Sem programadas, média simples dos dias.
- **Total:** média aritmética de TCGL e LondriSul. Não é ponderada por pontos. Se só uma área tiver valor, o Total usa essa área. O mesmo vale para o dia e para a semana anterior.
- Variação da semana: Total (ou a área) desta semana menos a semana anterior, em pontos percentuais.
- Variação do dia: o dia exibido menos o mesmo dia da semana anterior.
- −2/+6 e −1/+3 são telas separadas (`fonte` vazia / `2-6-ldsul` e `1-3` / `1-3-ldsul`).
- Os sete dias do card usam a mesma escala nas três áreas (mínimo e máximo de TCGL e LondriSul). O menor valor fica com 16% da altura, para continuar visível na TV; o maior fica em 100%. Dia sem dado não vira zero: o traço fica vazio e o número é “—”.
- Falha de leitura mantém o último valor e o rodapé marca “leitura incompleta” ou “sem atualização”. A apresentação não reinicia e o boot não espera a rede.

## Clima

Ver também [clima-tv.md](clima-tv.md).

- Temperatura e condição em destaque; cidade, mínima e máxima ao lado.
- Oito horas alinhadas. Cada hora usa `is_day` da Open-Meteo. O “Agora” e o cenário usam nascer e pôr daquela data em `America/Sao_Paulo`, porque o `is_day` da hora ainda diz “dia” depois do pôr.
- Oito dias numa escala térmica só. A faixa é temperatura. O percentual ao lado é chance de chuva, não volume.
- Cards: vento, sensação, umidade, chance de chuva com o volume em mm na linha de baixo, sol e pressão (menor).
- Depois do pôr, o card de sol passa a “Próximo nascer” com o horário e a data do dia seguinte.
- Fonte: “Open-Meteo · Londrina · atualizado HH:MM”.
- Sol pequeno no canto. Noite em azul profundo com lua genérica. Sem fase lunar calculada. Chuva, nuvem e trovoada não viram lua.

## Capa e campanha

`object-fit: contain`, sem zoom que corte logo ou texto. A capa não repete o logo CIOP por cima da arte. Campanha mensal continua em `CAMPANHAS`, com `?mes=` para inspeção. Com `arte: true`, o texto e o logo sobrepostos ficam ocultos.

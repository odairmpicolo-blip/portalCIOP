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

A capa ocupa a tela inteira: o cabeçalho e o rodapé saem, porque a arte já traz a marca. A barra de progresso continua. Clima e campanha ficam dentro das mesmas margens, com cabeçalho e rodapé visíveis.

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

O ciclo completo fica em torno de 1 min 58 s. `IPV_MS` e `ICV_MS` (30 s) alimentam a barra da tela. Quem avança o indicador é o passo do dia, não um segundo relógio. Os dias aparecem nomeados (`ter` + data) na base do card. Em cada card, uma barra cresce durante o dia exibido e recomeça no dia seguinte.

## Dados

Nada da fórmula mudou.

- Semana operacional: domingo a sábado. A semana nova entra na terça, em `America/Sao_Paulo`.
- Média da semana de pontualidade: soma de `ipv × pontos de controle` / soma dos pontos. Sem pontos, cai para a média simples dos dias.
- Cumprimento: viagens realizadas / programadas no período (`trips` ÷ `scheduled_trips`). Sem programadas na área, a área ainda pode mostrar a média dos `icv` diários; o **Total do sistema não**.
- **Total ICV:** soma das realizadas de TCGL e LondriSul ÷ soma das programadas × 100, no mesmo período e corte. Sem volumes nas áreas com dado, o Total é “—” e a nota registra a pendência. **Não** se apresenta média simples como cumprimento do sistema.
- **Total IPV** (−2/+6 e −1/+3): permanece média aritmética das áreas (pontualidade, não volume de viagens).
- Variação da semana: Total (ou a área) desta semana menos a semana anterior, em pontos percentuais.
- Variação do dia: o dia exibido menos o mesmo dia da semana anterior.
- −2/+6 e −1/+3 são telas separadas (`fonte` vazia / `2-6-ldsul` e `1-3` / `1-3-ldsul`).
- Os sete dias usam a escala de 0 a 100% nas três áreas: a altura da barra é o percentual daquele dia. Dia sem dado não vira zero: o traço fica vazio e o número é “—”. A data exibida acende a barra e o rótulo daquele dia.
- Falha de leitura mantém o último valor e o rodapé marca “leitura incompleta” ou “sem atualização”. A apresentação não reinicia e o boot não espera a rede.

## Clima

Três faixas, sem uma fileira de cards. Ver também [clima-tv.md](clima-tv.md).

- Agora: “Agora em Londrina”, temperatura em destaque, condição, sensação, mínima e máxima. A ilustração fica só no canto direito, com máscara, e não atravessa o texto.
- Próximas horas: uma faixa. “Agora” tem fundo leve. O percentual da hora é chance de chuva. O ícone da hora usa o dia ou a noite daquele horário.
- Abaixo: cerca de dois terços para os dias e um terço para vento, umidade, volume de chuva do dia e o próximo evento solar. Pressão fica numa linha menor, sem card.
- Oito dias em 1080 px de altura; sete quando a altura é menor que 860 px, para não encolher a fonte. A escala térmica é a dos dias visíveis. O percentual da linha é chance; o detalhe “Chuva” é o volume em mm.
- Ícone do dia é o da condição diurna. Noite não troca chuva, nuvem ou tempestade por lua.
- Depois do pôr, o detalhe passa a “Nascer do sol” com “Amanhã HH:MM” e a data.
- Rodapé: “Open-Meteo · atualizado às HH:MM” e a data/hora. Falha de leitura não zera os números: o rodapé marca “sem atualização”.

## Campanha

A arte ocupa o painel, com cantos arredondados (32 px) e `object-fit: contain`. Não estica e não corta texto, rosto ou marca. Não há legenda por baixo da imagem: o texto já está na arte.

- Cabeçalho: “Campanha do mês”. Rodapé: “Comunicação institucional” e a data/hora. O logo do cabeçalho permanece; a arte não ganha um segundo logo por cima.
- Troca mensal segue `CAMPANHAS` e `?mes=` para inspeção. As artes atuais são horizontais (cerca de 1859×846). O fundo do card usa `fundo` da campanha, para a sobra acompanhar a arte.

## Conferência 1920 (2026-10-29)

Servidor local `:8768`, `Emulation.setDeviceMetricsOverride` 1920×1080. Fórmulas **não** alteradas: Total da TV permanece média aritmética das áreas.

| Tela | `?tela=` | Overflow 1920 | Observado |
| --- | --- | --- | --- |
| Capa | `capa` | html/body 1920×1080 | `modo-capa`; cabeçalho e rodapé somem |
| Pontualidade −2/+6 | `ipv` | não | Título 40 px `rgb(244,247,255)`; semana TCGL 91,06% / LS 91,65% / Total 91,35% = média |
| Cumprimento | `icv` | não | Semana ~94,86 / 94,09 / 94,47 = média. **Não** é soma/soma |
| Clima | `tempo` | não | 19 °C; 8 horas; 8 dias; Open-Meteo. Em 1366×768: 7 dias. Pressão preenche depois da API |
| Campanha | `campanha` | não | Outubro Rosa; `object-fit: contain`; wrapper `border-radius: 32px` |

Problema encontrado: `theme-toggle.js` injetava tokens, design system e `portal-page-contrast.css` no kiosk (e aplicava `dk-dark`). O padrão manda a TV ficar fora desse chrome. Correção: kiosk não recebe inject nem boot de tema.

Ainda fora desta conferência: ciclo automático ponta a ponta (~2 min) sem `?tela=`; `painel-tv.html`; 3840×2160; noite após o pôr (Nascer do sol).

# Pendências visíveis em 30/10/2026

Registro do que foi implementado no repositório de teste, do que foi publicado e do que foi conferido em www.portalciop.com.br. Arquivo publicado não conta como conferido no domínio.

## 1. Performance em tempo real

Causa: a consulta e as barras estavam boas. O gráfico plotava até 288 slots de 5 minutos, com raio 0 e `spanGaps: false`. Uma leitura isolada sumia. Vários slots esparsos viravam traços verticais, não uma linha por hora. O histórico fica em `localStorage` (`ciop-mapa-pontualidade-horas-v1`) por origem, com hidratação opcional no Firestore. Um navegador novo só tem as horas já gravadas.

Correção em `pages/performance-tempo-real.html`: 24 pontos, um por hora civil em `America/Sao_Paulo`, usando a leitura real mais recente daquela hora. Sem interpolar. Ponto isolado com raio 7; com vizinho, raio 3. Sem histórico: “Sem histórico neste dia. As barras são a leitura de agora; o gráfico só marca horas já gravadas, sem completar lacunas.” Falha da API: “Erro na consulta da pontualidade. O gráfico não inventa pontos.” Barras de TCGL, LondriSul e Total permanecem. Cores: no horário verde, atrasado amarelo, adiantado vermelho.

Conferido no teste (127.0.0.1:8768, 1920×1080), depois do carregamento: barras TCGL 78/10/12, LondriSul 71/16/13, Total 74,50/13/12,50. Um ponto real às 14h (raio 7). Recarregar a página manteve o ponto. Fuso resolvido `America/Sao_Paulo`. Com a API bloqueada e o armazenamento limpo, o gráfico ficou com 0 pontos e a mensagem de erro, sem valor inventado. Captura: `assets/pend-performance-hora-20261030.png`.

## 2. Telemetria

Causa: `portal-visual.css` pintava etiquetas (`.stat-card .lbl`, subtítulo, `p`, `td`) de `#2c2c2e` com `!important` nos dois temas. No vidro escuro o título e a etiqueta ficavam escuros. A regra das etiquetas não tinha `:not(.dk-dark)`, ao contrário dos títulos.

Correção no CSS compartilhado: a cor escura dessas etiquetas vale só no tema claro. No escuro, etiqueta `#d5e2f0` e valor `#f5f8ff` sobre o vidro. A query `portal-visual.css?v=20261030pend1` foi atualizada nas páginas que carregam o arquivo, para o cache não guardar a regra antiga.

Conferido no teste, com o script de login bloqueado para ver a página: tema claro, etiqueta do card 12,7:1 e vazio 6,8:1; tema escuro, etiqueta 13,3:1, valor 16,5:1, “Carregando…” 12,2:1, vazio 13,9:1. O mesmo no celular (390 px). Captura do escuro: `assets/pend-telemetria-escuro-20261030.png`.

Pendência: www.portalciop.com.br redireciona esta página para o login. A conferência oficial depende de sessão.

## 3. Autuações

Causa: o valor em reais usava 26 px, `nowrap` e o card cortava os centavos. O mesmo CSS compartilhado forçava `.card-value` para `#1c1c1e` por especificidade maior que a cor laranja da página.

Correção: o card é container; a fonte do destaque é `clamp(12px, 8cqi, 22px)` e cabe no card. Moeda continua `pt-BR` com centavos; contagens, `formatInt` inteiro. A cor do dinheiro (`#c2410c` no claro, `#fdba74` no escuro) fica fora da regra genérica de `.card-value`. Títulos, filtros, legenda e `h3` dos gráficos seguem o par superfície/texto.

Conferido no teste em 1440 px e 390 px com o texto `R$ 12.345.678,90`: a largura do texto ficou dentro do card (161 px em 270 px no desktop; 201 px em 362 px no celular). Claro: dinheiro `#c2410c`, títulos escuros. Escuro: dinheiro `#fdba74`, títulos e filtros `#f5f8ff`.

Pendência: a página oficial exige login. Não houve conferência autenticada no domínio.

## 4. CR-0108

Causa do calendário: `::-webkit-calendar-picker-indicator { position: absolute; right: … }` no CSS compartilhado e nas páginas. No WebKit o bloco de contenção sobe e o ícone sai do campo. Causa da alternância: `.tab` inativo usava fundo claro (`--surface-2` / `#f1f5f9`) com texto que no escuro herdava cor clara.

Correção em `assets/css/portal-filtros.css`: indicador `position: static !important`, tamanho próprio, margem interna. Abas inativas no escuro: fundo `rgba(255,255,255,.1)` e texto `#f4f7fb`; no claro, texto `#1e293b`. A mesma regra de aba está em `portal-page-contrast.css`.

Conferido no teste: ícones de data dentro dos campos De e Até. Diário ativo branco sobre `#06245c`. Mensal inativo, no claro, `#1e293b` sobre `#f1f5f9`; no escuro, `#f4f7fb` sobre o vidro. Captura: `assets/pend-cr0108-claro-20261030.png`.

Pendência: conferência oficial exige login.

## 5. Evidências

A orientação central da ficha permanece. Os botões da coluna (Salvar, Ver ficha, Imprimir / PDF, Pasta de PDFs, Planilha, Finalizar, Excluir) quebram linha (`white-space: normal`, altura mínima 44 px). No cabeçalho do lote, Histórico, Portal e + Novo também quebram. Abaixo de 900 px a barra vira fileira com quebra.

Conferido no teste: em 1280 px nenhum botão cortava o texto (coluna ~199 px). Em 390 px os sete botões apareceram inteiros, em três linhas, sem rolagem horizontal da página. No escuro o texto da barra é `#f5f8ff` e o vazio central é `#e2e8f0`.

Pendência: conferência oficial exige login.

## 6. Previsão da CIOP TV

Garoa real e a troca de ícone entre dia e noite foram mantidas. O `?cena=` só troca céu e ícone principal.

Correção só em `#slide-tempo` de `pages/painel-ciop.html`: nuvens em lóbulos, sem `blur(30px)`; degradês do céu menores. Vento forte, tempestade, noite com chuva e noite com vento foram abertos na prévia local, sem gravar dado de produção. Em 30/10, por volta das 14h, a condição real continuou “Garoa fraca” (26–27 °C) enquanto a cena simulada mudava. Horas depois do pôr seguiram com lua. `prefers-reduced-motion` e a pausa fora do slide de clima continuam no CSS.

Capturas 1920×1080: `assets/ciop-tv-cena-vento-20261030.png`, `assets/ciop-tv-cena-tempestade-20261030.png`, `assets/ciop-tv-cena-noite-chuva-20261030.png`, `assets/ciop-tv-cena-noite-vento-20261030.png`.

## Publicação

- Teste (`portal-teste` `main`): `d2349f4b`.
- Produção (`portalCIOP` `main`): `eee7e4e2c`.

## Conferência no domínio oficial

Às 14:46 (America/Sao_Paulo) o HTML novo já estava em www.portalciop.com.br, com o workflow do GitHub Pages ainda em espera.

Performance em 1920×1080, depois dos dados: TCGL 83/7/10, LondriSul 78/13/9, Total 80,50/10/9,50. O gráfico é linha, 24 rótulos, pontos reais das 0h às 14h e lacuna depois disso. Fuso `America/Sao_Paulo`. Captura: `assets/pend-performance-oficial-20261030.png`.

Previsão da TV no mesmo tamanho: cena real `is-drizzle is-day`, “Garoa fraca”, 27 °C. Nuvem do slide com `filter: none`.

Telemetria, Autuações, CR-0108 e Evidências pedem login nesse domínio. A conferência visual dessas quatro páginas no ar continua pendente sem sessão.

## Segunda passagem — cobertura e contraste

O gráfico da Performance voltou a desenhar linha, mas a revisão só via pontos perto das 13h e 14h. Isso não era um recorte da consulta: a API do mapa não tem série horária, só a leitura de agora. O Firestore `performanceHoras` exige administrador, e o kiosk público não grava nem lê essa coleção. Cada navegador só plota o que ele mesmo persistiu em `localStorage`.

Correção em `pages/performance-tempo-real.html`: quando há ponto, o status é “Histórico disponível a partir de HH:mm”, em `America/Sao_Paulo`, pelo menor `ts` gravado. Hora antiga sem `ts` usa `HH:00` do bucket. Lacuna continua `null`, `spanGaps: false`, sem zero inventado. Recarregar e o poll de 5 s mantêm as horas já salvas.

Conferido no teste (127.0.0.1:8768, 1920×1080), com o histórico real deste navegador: status “Histórico disponível a partir de 14:33.”, pontos só às 14h e 15h, hora 9 vazia, 24 rótulos, fuso `America/Sao_Paulo`. Uma hora 8h inserida só para o teste sobreviveu ao recarregamento e a uma atualização automática, com raio 7 no ponto isolado, e foi removida em seguida. Captura: `assets/pend-performance-hist-20261030.png`. Limitação: horas anteriores a 14:33 neste navegador não foram coletadas e não podem ser recuperadas da API.

Telemetria: o texto “Ao vivo” ficava claro (`#d5e2f0`) sobre a pílula clara (`#f8fafc`). A pílula agora acompanha o tema: no escuro, fundo `rgba(8,18,32,.94)` e texto `#f4f7fb`; no claro, fundo `#f8fafc` e texto `#1e293b`. Títulos dos indicadores permanecem. No teste, “Ao vivo” ficou 14,0:1 no claro e 17,4:1 no escuro; etiqueta do card 13,4:1 e 16,2:1. Em 390 px o “Ao vivo” escuro ficou 16,4:1. Capturas: `assets/pend-telemetria-claro-aovivo-20261030.png`, `assets/pend-telemetria-escuro-aovivo-20261030.png`.

Autuações: `formatInt` já gerava `1.519`, mas `portal-futuristic.js` lia o ponto de milhar como três casas e reescrevia o card como `1519,000`. O leitor agora trata `1.519` como inteiro e a pintura usa `pt-BR` com agrupamento. Moeda segue com centavos; percentual da legenda segue uma casa (`21,9%`). Etiquetas dos gráficos usam texto escuro no claro e `#f4f7fb` sobre chip escuro no escuro. No teste, com o JSON local: total `1.519`, tarifas `230.500`, gasto `R$ 1.690.275,41` (`#c2410c` no claro, `#fdba74` no escuro). Captura do escuro: `assets/pend-autuacoes-escuro-20261030.png`.

CR-0108: calendário e abas permanecem. Eixos, marcas, legenda e grade dos dois gráficos passam a `#1e293b` / `rgba(30,41,59,.18)` no claro e `#f4f7fb` / `rgba(213,226,240,.28)` no escuro. `max: 100`, empilhamento e a série (211 pontos na evolução, 24 horas) não mudaram. Captura: `assets/pend-cr0108-escuro-grafico-20261030.png`.

CIOP TV: garoa real, nuvens, chuva e ícones por horário permanecem. Prévia local em 1920×1080, sem alterar os números de produção (continuou “Garoa fraca”, 27 °C, vento 12 km/h): `tempestade` (`is-storm is-day`), `vento` (`is-sun is-day is-wind`), `noite-chuva` (`is-rain is-night`), `noite-vento` (`is-sun is-night is-wind`). Nuvem do slide com `filter: none`. Capturas atualizadas: `assets/ciop-tv-cena-tempestade-20261030.png`, `assets/ciop-tv-cena-vento-20261030.png`, `assets/ciop-tv-cena-noite-chuva-20261030.png`, `assets/ciop-tv-cena-noite-vento-20261030.png`.

### Estado desta passagem

- Implementado e conferido em 127.0.0.1:8768.
- Publicado no teste: `d30d4161`. Publicado em produção: `4ef6cce01`. O Pages concluiu e o HTML novo passou a ser servido em www.portalciop.com.br.
- Conferido no domínio, 1920×1080, por volta das 15:40 (America/Sao_Paulo): Performance com “Histórico disponível a partir de 00:08.”, pontos reais das 0h às 15h, oito horas seguintes vazias, nenhum zero, `spanGaps: false`. Recarregar manteve o início. Esse 00:08 é o primeiro registro deste navegador no domínio, não uma reconstituição da API. Um navegador aberto só à tarde continua começando na hora em que ele mesmo gravou. Captura: `assets/pend-performance-oficial-hist-20261030.png`.
- TV oficial, sem `?cena=`: `is-drizzle is-day`, “Garoa fraca”, 27 °C, nuvem com `filter: none`. Os números de produção não foram alterados.
- Telemetria oficial, antes do retorno ao login: “Ao vivo” no claro `#1e293b` sobre `#f8fafc`; no escuro `#f4f7fb` sobre `rgba(8,18,32,.94)`. Etiquetas no escuro `#f4f7fb`.
- CR-0108 oficial, com os dados carregados e antes do retorno ao login: evolução com 211 pontos; faixa horária com 24 horas, `max` 100 e empilhada. Claro: eixo e legenda `#1e293b`, grade `rgba(30,41,59,.18)`. Escuro: `#f4f7fb` e `rgba(213,226,240,.28)`.
- Autuações: o JavaScript novo está no domínio (`formatInt` sem casas e o leitor de milhar). A pintura dos gráficos com a planilha no ar não foi refeita nesta passagem porque a página pede sessão para buscar os dados. A conferência dos números `1.519`, `230.500` e `R$ 1.690.275,41` ficou no teste local.

## Terceira passagem — selos e céu da TV

Causa dos selos: `portal-visual.css` pinta `span` dentro de cartão e toolbar com `--portal-text`. No escuro isso é texto claro. Os fundos “sem registro” (`#fee2e2`) e “parcial / divergente” (`#fef3c7`) estavam no HTML, e o aviso laranja do CR-0108 (`.selo-velho`) também. A cor do selo perdia para a regra do `span`.

Correção na origem: tokens `--portal-chip-*-{fg,bg,bd}` nos dois temas e a classe `.portal-chip`, excluída da regra do `span`. Sem uma cor branca global e sem um `!important` novo. A legenda da telemetria e o selo do CR-0108 usam essas classes. O aviso velho continua âmbar; o aviso em dia continua verde.

Conferido em 127.0.0.1:8768, com o script de login ainda na página (classe `portal-auth-pending`, sem redirecionar durante a medida):

| Selo | Claro | Escuro |
| --- | --- | --- |
| sem registro | 6,68:1 (`#9f1239` / `#ffe4e6`) | 8,51:1 (`#fecdd3` / `#5c2430`) |
| parcial / divergente | 6,37:1 | 8,24:1 |
| maior km | 6,49:1 | 7,52:1 |
| menor km | 4,79:1 | 7,30:1 |
| CR aviso velho | 6,38:1 | 9,90:1 |
| CR aviso em dia | 6,78:1 | 8,02:1 |

“Ao vivo” no claro continuou 13,98:1. Etiqueta de indicador no claro continuou `#2c2c2e`, não branco. Título do CR no escuro continuou `#f5f8ff`. O selo real da base local estava “Dados até 30/07/2026 · sem atualizar há 90 dias”. Capturas: `assets/pend-telemetria-selos-claro-20261030.png`, `assets/pend-telemetria-selos-escuro-20261030.png`, `assets/pend-telemetria-escuro-pagina-20261030.png`, `assets/pend-cr0108-selo-claro-20261030.png`, `assets/pend-cr0108-selo-escuro-20261030.png`.

A faixa colorida das linhas da tabela (sem registro / divergente) continua atrás da regra compartilhada que zera o fundo da célula (`.table-wrap td` em `portal-ui.css`). O texto da célula fica no par da tabela. Isso não foi medido com linha real: o JSON local desta página estava vazio.

CIOP TV, 1920×1080, sem rolagem (`scrollHeight` 1080) e sem corte dos cartões. Garoa real: `is-drizzle is-day`, “Garoa fraca”, 26 °C, umidade 56%, precipitação 1,8 mm, pressão 1009 hPa, vento 11 km/h O, pôr 18:36. Céu azul-ardósia, 22 gotas, nuvem com `filter: blur(7px)`, céu e herói com `filter: none`. Vidro `rgba(8,18,34,.74)`. Texto do cartão 14,6:1. Horas numa faixa; 18h dia e 19h noite, cada uma com o próprio instante. Colunas laterais com `space-between` e `flex-grow: 0`. `prefers-reduced-motion: reduce` deixou nuvem e gota com `animation-name: none`.

`portalEscolherCena` conferido nas 20 combinações da prévia `docs/padrao-portal/preview-clima-cenas.html`. Chuva e garoa com vento forte permanecem chuva e garoa. Tempestade com vento permanece tempestade. Na TV, `?cena=chuva-vento` ficou `is-rain is-day is-wind` e o texto continuou “Garoa fraca”, 26 °C. `noite-garoa` ficou `is-drizzle is-night`. `tempestade` ficou `is-storm is-day`. Capturas: `assets/ciop-tv-garoa-1920-20261030.png`, `assets/ciop-tv-chuva-vento-1920-20261030.png`, `assets/ciop-tv-noite-garoa-1920-20261030.png`, `assets/ciop-tv-tempestade-1920-20261030.png`.

Falha da API na primeira carga (Open-Meteo bloqueada): temperatura, rótulo, vento, umidade, chuva e pressão em “—”, horas vazias, cena `is-neutral`, fonte “Open-Meteo · sem atualização”. Nenhum número inventado. Ao liberar a rede e recarregar: “Garoa fraca”, 26 °C, 8 horas, `is-drizzle is-day`, fonte “Atualizado às 16:09”. A nova tentativa de 10 minutos, que conservaria a última leitura sem recarregar, não foi esperada nesta sessão.

Performance, Autuações, cores de pontualidade e a fotografia do portal não foram alteradas nesta passagem.

### Estado desta passagem

- Implementado e conferido em 127.0.0.1:8768. Publicado no repositório de teste. www.portalciop.com.br ainda não tem estes selos nem este céu.

## Quarta passagem — grade da TV, “Agora”, carga do clima e km

Alteração local nesta passagem. Não publicada.

### Grade e nuvens

Causa do vão: a faixa de baixo ocupava o resto da tela e os cartões laterais usavam `justify-content: space-between` com altura do conteúdo. Em 1920×1080 o vão entre dois cartões passava de 300 px.

Correção em `pages/painel-ciop.html`: a faixa das horas recebe a sobra (`minmax(168px, 1.2fr)`); a de baixo fica na altura do conteúdo. Vento e sol à esquerda, sete dias ao centro, umidade, precipitação e pressão à direita. Espaço entre cartões: 12 px, medido. Sem rolagem (`scrollHeight` 1080). As nuvens deixaram o `blur(7px)` e passaram a círculos sobrepostos, sem `filter`, no céu. Não cruzam o texto dos cartões.

Conferido em 127.0.0.1:8768, 1920×1080. Leitura real às 16:57: “Céu limpo”, 26 °C, “Atualizado às 16:57”. Capturas: `assets/ciop-tv-ceu-limpo-1920-20261030.png`, `assets/ciop-tv-chuva-vento-1920-20261030.png`, `assets/ciop-tv-noite-garoa-1920-20261030.png`, `assets/ciop-tv-noite-tempestade-1920-20261030.png`. `?cena=` só troca céu e ícone principal; o rótulo e as temperaturas continuam os da Open-Meteo.

### “Agora” e a condição principal

Causa: o destaque usava `current.weather_code`. O primeiro item da faixa usava `hourly.weather_code` da hora civil. Os dois instantes divergem. A probabilidade horária também aparecia só como porcentagem, e a hora corrente sumia nos últimos 10 minutos (`t + 50 min`).

Correção: “Agora” usa o mesmo código e a mesma temperatura do destaque. As horas seguintes usam a previsão daquela hora, com sol ou lua pelo instante em `America/Sao_Paulo`. A porcentagem leva o texto “prob. na hora”. O rótulo WMO está em `portalRotuloClima`. A hora que contém o relógio permanece na faixa até ela terminar.

Conferido na mesma leitura: destaque e “Agora” com ícone de sol e rótulo “Céu limpo”; 17h com o ícone da hora (garoa) e “68% prob. na hora” no “Agora”, sem transformar a probabilidade em chuva.

### Carga

Causa: `#boot` some antes da resposta e `fetch` não tinha limite nem nova tentativa. Uma busca pendurada deixava a tela em “—” até um recarregamento manual. O único retorno era o ciclo de 10 minutos.

Correção: “Atualizando previsão” enquanto busca; 12 s de limite; uma busca por vez; tentativas em 2 s, 4 s e 8 s; depois, a cada 30 s. Sem dado válido: “Previsão temporariamente indisponível” e traços, nunca zero. Com dado anterior, os números ficam e a fonte marca o horário.

Conferido: Open-Meteo bloqueada, campos em “—” e fonte “Previsão temporariamente indisponível”. Rede liberada, sem recarregar: aos ~11 s, “Atualizado às 16:54”, 26 °C, “Céu limpo”, 8 horas. O texto “Atualizando previsão” é o estado inicial do HTML e o da função de busca; nesta sessão a ferramenta de navegação só devolveu a página depois do limite de 12 s, então esse rótulo não apareceu no intervalo amostrado.

### Quilometragem

Causa: no Clever do veículo 1150 o hodômetro saltou. Em 14/09/2026, início 134.931 km e fim 2.415.955.712 km; o “Km Percorrido” gravado foi a diferença 2.415.820.781. Em 15/09 o fim voltou a 135.567 km e o campo ficou −2.415.820.145. Não é formatação. A agregação também somava “Km Inicial” e “Km Final” como se fossem distância.

Correção em `assets/js/telemetria-merge.js` e na cópia `backend/src/lib/telemetria-merge.js`. A distância do dia só entra se for de 0 a 2.000 km (24 h a 80 km/h). Hodômetro segue a ordem de “Inicio”: o primeiro início e o último fim, sem soma. Diferença negativa ou acima de 2.000 km não vira valor absoluto, não é truncada e não vira zero. A célula mostra “Dado inconsistente”; o título guarda o original. O registro sai das somas e dos gráficos. A contagem avisa a exclusão. O teto de 1.000 km dos indicadores permanece para o que ainda é uma distância.

Conferido na base local, aba Clever: 14/09/2026 do 1150, “Dado inconsistente”, título “Km Percorrido 2415820781 · Km Inicial 134931 · Km Final 2415955712 — acima do limite de distancia do dia”. 15/09, título com “-2415820145” e motivo de reinício. Contagem: “217 com dado inconsistente, fora das somas e dos gráficos”. Os casos rodaram no JavaScriptCore; `node` não está neste ambiente, então `node --test` não rodou.

Os selos da telemetria foram medidos de novo nos dois temas e continuam nos tokens da passagem anterior. O CSS do CR-0108 não foi alterado nesta passagem. O gráfico do CR não foi reaberto.

Pendência: esta passagem não foi publicada. O domínio oficial não foi conferido. “Km Inicial” e “Km Final” continuam mostrando a leitura bruta do contador, inclusive o salto, porque esse é o valor original; só a distância do dia deixa de ser exibida como número.

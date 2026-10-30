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

- Implementado no teste local e conferido em 127.0.0.1:8768.
- Publicado: ainda não, neste registro.
- Conferido em www.portalciop.com.br: ainda não. A cobertura do histórico no domínio só vale depois que o HTML novo estiver no ar e o primeiro instante gravado naquele navegador for lido. Telemetria, Autuações e CR-0108 no domínio continuam atrás do login.

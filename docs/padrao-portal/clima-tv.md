# Clima na TV (Painel CIOP)

Ícones e cenário vêm de `assets/js/portal-clima-cena.js` + `assets/css/portal-clima-anim.css`. Painel CIOP e Painel TV **não** duplicam o mapa WMO.

## Dia e noite

Período meteorológico **não** é o tema claro/escuro da interface.

Ordem para saber se um instante é dia:

1. Coluna de uma hora prevista (`horaCheia`): `hourly.is_day` da Open-Meteo, quando vier. Esse flag descreve o início da hora.
2. O “Agora” e o cenário comparam o relógio com `sunrise`/`sunset` **daquela data** em `America/Sao_Paulo`. Sem isso, a hora das 18h continua “dia” depois do pôr (18:35). Meia-noite usa o nascer do calendário daquele instante.
3. Se não houver horário solar, usa `is_day`.
4. Fallback, só sem dados solares: dia entre 06:00 e 18:00 no mesmo fuso. Londrina está em UTC−3 o ano todo desde 2019.

A lua da cena e dos ícones noturnos usa a fase real, calculada pelo mês sinódico de 29,530588853 dias a partir da lua nova de 6 jan 2000, 18:14 UTC. Londrina está no hemisfério sul: a crescente ilumina o lado esquerdo. Sem um instante válido, o desenho é um disco neutro, não uma crescente fixa. Lua nova (fase &lt; 0,03 ou &gt; 0,97) fica só um disco escuro.

Códigos de chuva, garoa, tempestade, neblina e neve **não** viram lua no ícone. No cenário, a noite nublada (código 3) deixa a lua atrás das nuvens. Céu limpo (0–1) e parcialmente nublado (2) mostram a fase daquele instante.

`portalClimaAgendarPeriodo` reaplica a cena no nascer/pôr sem recarregar a página (o JSON em cache continua válido até o refresh de 15 min).

Previsão diária usa ícone diurno representativo do dia.

No Painel CIOP a cena cobre a tela de previsão. O céu muda com a condição real e não é uma camada cinza chapada: limpo é azul, nublado tem variação de luz, chuva e noite ficam mais fundos. A condição atual fica direto nesse céu. O vidro, translúcido e de borda fina, só entra nas horas e nos cards de baixo. Em 1920×1080 as próximas horas ficam numa faixa. Embaixo há três colunas: vento e nascer/pôr à esquerda, sete dias ao centro, umidade, precipitação e pressão à direita. Os cartões laterais se distribuem na altura (`space-between`) sem esticar o texto. O texto principal permanece claro, com um véu leve só na base, para a leitura não depender de um cartão sólido. Isso não segue o tema do portal. A composição está em [ciop-tv.md](ciop-tv.md).

Capturas da prévia local em 1920×1080 (29/10/2026). Os números são os da Open-Meteo; o parâmetro `cena` só troca o céu e o ícone principal: `assets/ciop-tv-cena-sol.png`, `assets/ciop-tv-cena-nublado.png`, `assets/ciop-tv-cena-chuva.png`, `assets/ciop-tv-cena-tempestade.png`, `assets/ciop-tv-cena-neblina.png`, `assets/ciop-tv-cena-noite.png`, `assets/ciop-tv-cena-noite-nublada.png`, `assets/ciop-tv-cena-noite-chuva.png`. A composição publicada continua em `assets/ciop-tv-clima-1920.png`.

## Cenário

O fundo é desenhado em CSS e SVG próprios, sem foto, vídeo ou som. A escolha fica em `portalEscolherCena`: código WMO, vento e dia/noite. O vento não troca o grupo. Chuva, garoa e tempestade com vento forte continuam chuva, garoa e tempestade; a classe `is-wind` só acelera as nuvens.

No slide da previsão do Painel CIOP as nuvens são volumes em camadas (vários lóbulos). O desfoque de 7 px fica só em `.wx-cloud-mass` e `.wx-cloud-soft`, atrás dos cartões. O céu, o herói e os cartões não levam `filter`. O vidro dos cartões usa `rgba(8,18,34,.74)` e o desfoque de vidro só no próprio cartão. A garoa deixa o cinza chapado e usa céu azul-ardósia, com 22 gotas finas. `?cena=` não altera temperaturas nem a lista horária. A condição vem do `weather_code` WMO da Open-Meteo. O período de cada hora vem de `portalEscolherCena` com o instante daquela hora: coluna horária usa `hourly.is_day`; o “Agora” e a cena comparam o relógio com `sunrise`/`sunset` em `America/Sao_Paulo`. O tema claro/escuro do portal não entra.

O vento é modificador. A Open-Meteo entrega `wind_speed_10m` e `wind_gusts_10m` em **km/h** nesta URL (não há `wind_speed_unit`). Vento forte: sustentado ≥ 40 km/h ou rajada ≥ 60 km/h. Ele acelera as nuvens. Chuva e garoa com vento continuam chuva e garoa. Tempestade (95, 96, 99) não vira cena de vento.

| Condição | Códigos | Dia | Noite |
| --- | --- | --- | --- |
| Ensolarado | 0, 1 | azul, sol, nuvens leves | lua na fase real, estrelas |
| Parcial | 2 | azul com sol baixo e nuvens | lua parcial e nuvens |
| Nublado | 3 | céu encoberto, nuvens em deriva lenta | nuvens escuras sobre a lua |
| Garoa | 51, 53, 55, 56, 57 | azul-ardósia, nuvens em volume, 22 gotas finas | o mesmo céu, mais escuro |
| Chuva | 61, 63, 65, 66, 67, 80, 81, 82 | nuvens densas, chuva moderada | céu noturno e chuva |
| Tempestade | 95, 96, 99 | chuva e um clarear lento, sem flash | o mesmo, céu noturno |
| Neblina | 45, 48 | véu | véu mais escuro |
| Neve | 71, 73, 75, 77, 85, 86 | nuvem e flocos | flocos |
| Neutro | sem código válido | céu azul-ardósia, sem sol | — |

O código 82 (pancada violenta) fica na chuva, sem raio. Garoa desenha 22 gotas finas, chuva 14 e tempestade 16, mais um véu que clareia em cerca de 12 s. Não há raio. Não há alerta oficial, radar nem dado que a API não tenha enviado.

Cada ícone horário usa o código e o `is_day` (ou o nascer/pôr) **daquela hora**, também depois da meia-noite. A lista de sete dias continua com ícone diurno.

A animação só corre com a previsão ativa no ciclo (`modo-clima`). Nas outras telas ela pausa. `prefers-reduced-motion` deixa o mesmo desenho parado: gotas no quadro, sem deriva e sem clarear.

Falha de leitura conserva o último cenário e marca a data da última leitura. Se nunca houve leitura, o fundo é o neutro, sem sol.

Prévia de desenvolvimento, sem trocar os números de produção: `docs/padrao-portal/preview-clima-cenas.html` lista a decisão de `portalEscolherCena`. Na TV, `?tela=tempo&cena=` aceita `sol`, `parcial`, `nublado`, `garoa`, `garoa-vento`, `chuva`, `chuva-vento`, `tempestade`, `vento`, `neblina`, `noite`, `noite-parcial`, `noite-nublada`, `noite-garoa`, `noite-chuva`, `noite-chuva-vento`, `noite-vento`, `noite-neblina`, `noite-tempestade`, `neutro`.

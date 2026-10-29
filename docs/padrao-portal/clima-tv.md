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

No Painel CIOP a cena cobre a tela de previsão. O céu muda com a condição real e não é uma camada cinza chapada: limpo é azul, nublado tem variação de luz, chuva e noite ficam mais fundos. A condição atual fica direto nesse céu. O vidro, translúcido e de borda fina, só entra nas horas e nos cards de baixo. O texto principal permanece claro, com um véu leve só na base, para a leitura não depender de um cartão sólido. Isso não segue o tema do portal. A composição está em [ciop-tv.md](ciop-tv.md).

Capturas da prévia local em 1920×1080 (29/10/2026). Os números são os da Open-Meteo; o parâmetro `cena` só troca o céu e o ícone principal: `assets/ciop-tv-cena-sol.png`, `assets/ciop-tv-cena-nublado.png`, `assets/ciop-tv-cena-chuva.png`, `assets/ciop-tv-cena-tempestade.png`, `assets/ciop-tv-cena-neblina.png`, `assets/ciop-tv-cena-noite.png`, `assets/ciop-tv-cena-noite-nublada.png`, `assets/ciop-tv-cena-noite-chuva.png`. A composição publicada continua em `assets/ciop-tv-clima-1920.png`.

## Cenário

O fundo é desenhado em CSS e SVG próprios, sem foto, vídeo ou som. A condição vem do `weather_code` WMO da Open-Meteo. O período vem de `is_day` na hora prevista, ou de `sunrise`/`sunset` em `America/Sao_Paulo` no instante atual. O tema do portal não entra.

O vento é modificador. A Open-Meteo entrega `wind_speed_10m` e `wind_gusts_10m` em **km/h** nesta URL (não há `wind_speed_unit`). Vento forte: sustentado ≥ 40 km/h ou rajada ≥ 60 km/h. Ele acelera as nuvens. Chuva e garoa com vento continuam chuva e garoa. Tempestade (95, 96, 99) não vira cena de vento.

| Condição | Códigos | Dia | Noite |
| --- | --- | --- | --- |
| Ensolarado | 0, 1 | azul, sol, nuvens leves | lua na fase real, estrelas |
| Parcial | 2 | azul com sol baixo e nuvens | lua parcial e nuvens |
| Nublado | 3 | céu encoberto, nuvens em deriva lenta | nuvens escuras sobre a lua |
| Garoa | 51, 53, 55, 56, 57 | cinza, poucas gotas finas | o mesmo, mais escuro |
| Chuva | 61, 63, 65, 66, 67, 80, 81, 82 | nuvens densas, chuva moderada | céu noturno e chuva |
| Tempestade | 95, 96, 99 | chuva e um clarear lento, sem flash | o mesmo, céu noturno |
| Neblina | 45, 48 | véu | véu mais escuro |
| Neve | 71, 73, 75, 77, 85, 86 | nuvem e flocos | flocos |
| Neutro | sem código válido | céu azul-ardósia, sem sol | — |

O código 82 (pancada violenta) fica na chuva, sem raio. O raio só existe em 95, 96 e 99, e o clarear leva cerca de 12 s.

Cada ícone horário usa o código e o `is_day` (ou o nascer/pôr) **daquela hora**, também depois da meia-noite. A lista de sete dias continua com ícone diurno.

A animação só corre com a previsão ativa no ciclo (`modo-clima`). Nas outras telas ela pausa. `prefers-reduced-motion` deixa o mesmo desenho parado: gotas no quadro, sem deriva e sem clarear.

Falha de leitura conserva o último cenário e marca a data da última leitura. Se nunca houve leitura, o fundo é o neutro, sem sol.

Prévia local, sem trocar os números: `_preview-clima-cenas.html` ou `?tela=tempo&cena=` com `sol`, `parcial`, `nublado`, `garoa`, `chuva`, `tempestade`, `vento`, `neblina`, `noite`, `noite-nublada`, `noite-chuva`, `noite-vento`, `noite-tempestade`, `neutro`.

Os desenhos são CSS e SVG próprios do portal, sem foto, vídeo ou áudio. A chuva usa poucas gotas (8 na garoa, 14 na chuva, 16 na tempestade). O clarear da tempestade é um véu de 12 s, sem raio. `prefers-reduced-motion` e a saída do ciclo pausam o movimento e deixam o mesmo desenho parado.

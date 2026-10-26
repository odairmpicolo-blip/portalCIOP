# Clima na TV (Painel CIOP)

Ícones e cenário vêm de `assets/js/portal-clima-cena.js` + `assets/css/portal-clima-anim.css`. Painel CIOP e Painel TV **não** duplicam o mapa WMO.

## Dia e noite

Período meteorológico **não** é o tema claro/escuro da interface.

Ordem para saber se um instante é dia:

1. `is_day` da Open-Meteo (`current` no herói; `hourly.is_day` em cada coluna horária).
2. Se faltar o flag, comparar o instante com `sunrise`/`sunset` **daquela data** em `America/Sao_Paulo` (meia-noite usa o nascer do calendário seguinte).
3. Fallback documentado, só sem dados solares: dia entre 06:00 e 18:00 no mesmo fuso. Londrina está em UTC−3 o ano todo desde 2019.

Lua genérica (crescente estilizada). **Não** inventar fase lunar.

Códigos de chuva, tempestade, neblina e neve **não** viram lua à noite. Só céu limpo (0–1) e parcialmente nublado (2) trocam sol ↔ lua.

`portalClimaAgendarPeriodo` reaplica a cena no nascer/pôr sem recarregar a página (o JSON em cache continua válido até o refresh de 15 min).

Previsão diária usa ícone diurno representativo do dia.

## Cenário

- Dia limpo: azul, sol pequeno à direita, sem raios girando.
- Noite limpa: índigo, lua discreta e estrelas estáticas.
- Nublado/chuva/tempestade: nuvens; sem sol grande atrás dos números.
- Animações contínuas desligadas no kiosk (`prefers-reduced-motion` também zera o restante).

# Clima na TV (Painel CIOP)

Ícones e cenário vêm de `assets/js/portal-clima-cena.js` + `assets/css/portal-clima-anim.css`. Painel CIOP e Painel TV **não** duplicam o mapa WMO.

## Dia e noite

Período meteorológico **não** é o tema claro/escuro da interface.

Ordem para saber se um instante é dia:

1. Coluna de uma hora prevista (`horaCheia`): `hourly.is_day` da Open-Meteo, quando vier. Esse flag descreve o início da hora.
2. O “Agora” e o cenário comparam o relógio com `sunrise`/`sunset` **daquela data** em `America/Sao_Paulo`. Sem isso, a hora das 18h continua “dia” depois do pôr (18:35). Meia-noite usa o nascer do calendário daquele instante.
3. Se não houver horário solar, usa `is_day`.
4. Fallback, só sem dados solares: dia entre 06:00 e 18:00 no mesmo fuso. Londrina está em UTC−3 o ano todo desde 2019.

Lua genérica (crescente estilizada). **Não** inventar fase lunar.

Códigos de chuva, tempestade, neblina e neve **não** viram lua à noite. Só céu limpo (0–1) e parcialmente nublado (2) trocam sol ↔ lua.

`portalClimaAgendarPeriodo` reaplica a cena no nascer/pôr sem recarregar a página (o JSON em cache continua válido até o refresh de 15 min).

Previsão diária usa ícone diurno representativo do dia.

No Painel CIOP a cena não cobre o card: fica no canto superior direito, com máscara, sobre o azul do painel. Com o movimento desligado, a chuva permanece desenhada dentro do quadro, em vez de ficar parada acima da área visível. A composição das três faixas está em [ciop-tv.md](ciop-tv.md).

## Cenário

- Dia limpo: azul suave e sol pequeno, sem raios girando.
- Noite limpa: índigo, lua discreta e estrelas estáticas.
- Nublado/chuva/tempestade: nuvens; sem sol grande atrás dos números.
- Animações contínuas desligadas no kiosk (`prefers-reduced-motion` também zera o restante).

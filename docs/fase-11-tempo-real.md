# Fase 11 — Tempo real (20/08/2026)

Sem WebSocket. As telas ao vivo já fazem poll HTTP (Bus2 ~20 s, Clever ~30 s, FleetBus ~4 s, terminais ~120 s).

## O que esta fatia fez

- Helper `assets/js/portal-tempo-real.js` (`portalPaginaVisivel` / `portalPollQuandoVisivel`).
- Poll de ônibus (Bus2 e Clever), horários e FleetBus **não dispara com a aba oculta**; ao voltar, atualiza na hora. Terminais já faziam isso.
- Faixa **Ônibus · Horários · FleetBus · Terminais** nas quatro telas.
- Painéis de TV (`painel-tv*.html`, `pontualidade-tempo-real.html`) **não** foram redesenhados nem pausados: quiosque precisa continuar atualizando.

## Como conferir

Abrir Ônibus agora, mudar de aba uns 30 s e voltar: deve atualizar sem ter batido na API o tempo todo. A faixa de navegação deve aparecer no topo.

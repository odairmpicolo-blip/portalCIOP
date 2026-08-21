# Fase 17 — PWA (20/08/2026)

Já existia o app interno Capacitor (`docs/mobile-app.md`) apontando para `/app/`. Esta fatia cobre **Adicionar à tela inicial** no navegador, no portal clássico.

## O que esta fatia fez

- `assets/pwa/manifest.webmanifest` (nome CIOP, standalone, tema `#06245c`)
- Ícone e `theme-color` na home, no login e via `auth.js` nas demais telas
- TV / quiosque **sem** manifest (não compete com o kiosk)

## O que não foi inventado

- Service Worker que cacheia JSON/API — dados ao vivo ficariam velhos (Fastly + dumps).
- Push notification.
- Loja (Play / App Store) — o Capacitor continua instalação manual.

## Como conferir

No celular: Safari/Chrome → Compartilhar → **Adicionar à Tela de Início**. O atalho deve abrir `index.html` em tela cheia.

# Fase 6 — Interface (20/08/2026)

Não redesenhei a home. A base já existia: tokens (`portal-tokens.css`), vidro (`portal-unify.css` + `portal-liquid-glass.css`), cabeçalho/sessão (`portal-header.css`, `portal-session.css`) e overlay de login em `auth.js`.

## Padronizar cores, fonte e botões

Inter + azul `#06245c` + laranja `#ff6b00` em `portal-tokens.css`. Páginas internas puxam tokens + unify. Login usa os mesmos tokens e a mesma fonte via unify.

Paineis de TV (`pages/painel-tv.html`, `pontualidade-tempo-real.html` e redirecionamentos) ficam no tema escuro próprio, **sem** Firebase login — são kiosk.

## Menu e voltar ao portal

Home: abas laterais (`portal-dock` / `#portalAbas`) com quebra horizontal abaixo de 900px.

Páginas internas: botão Portal (`btn-portal` / `portal-return`) onde já havia. Onde faltava, `auth.js` injeta `a.portal-voltar-auto` no cabeçalho depois do login.

## Responsivo

- `viewport` nas páginas operacionais e no login.
- Unify (≤720px, só com `.ciop-session`): área tocável, tabelas com scroll horizontal, inputs a 16px (evita zoom no iOS).
- Login (≤520px): cartão e marca centralizados, botão/inputs ≥ 44px.
- Sessão do usuário já compacta em `portal-session.css` (≤520px).

Conferir no celular: login, home e uma página com tabela (ex.: ICV ou liberação).

## Loading e erros

- Overlay `portalLoadingOverlay` no `auth.js` até validar a sessão.
- Login: mensagens em português (`auth/invalid-credential`, MFA, muitas tentativas). Erros da API (`ok` / `erro` / `codigo`) ficam na Fase 3; a Fase 7 cobre feedback nas telas de dashboard.

## Cache

Query `?v=20260820i` em `portal-unify.css`, `portal-login-v2.css` e `auth.js`.

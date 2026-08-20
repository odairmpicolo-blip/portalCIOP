# Fase 5 — Login e segurança (20/08/2026)

Auth continua no Firebase projeto `portal-ciop`. Não há senha no DSQL. Firestore `usuarios/{email}` é o cadastro do portal.

## Fluxo de login

1. `login.html` → `signInWithEmailAndPassword` (sessão de **aba**: `browserSessionPersistence`; app nativo usa `local`).
2. `assets/js/auth.js` espera `onAuthStateChanged`, busca o cadastro no Firestore (timeout 8 s) e aplica módulos em `config/perfisAcesso`.
3. Sem sessão → redireciona para `login.html`. `ativo: false` → logout.

**Correção desta fatia:** conta Auth **sem** documento no Firestore (e sem fallback em `usuarios.js`) passa a ser **recusada** (`ativo: false`). Antes virava “Usuario” ativo e via o portal.

Cache de cadastro: 30 min (antes 8 h).

## Tokens / sessão

| Peça | Comportamento |
|---|---|
| ID token | ~1 h; o SDK do Firebase renova sozinho |
| API | `Authorization: Bearer`; `verifyIdToken(..., true)` quando há conta de serviço (revogação). Sem SA, conferência pelas chaves públicas (`firebase-token.js`) — sem detectar logout forçado até o token expirar |
| API key | Só rotas `requireApiKey` (sync interno). Header `X-Portal-Api-Key`. Não vai no HTML |
| Sessão web | Fecha a aba = precisa entrar de novo |

Com SA no Lambda, a API também exige cadastro Firestore ativo (`SEM_CADASTRO` / `ACESSO_DESATIVADO`). Sem SA, só valida o JWT (como hoje se o zip não tiver `.secrets/`).

## Perfis

Já existiam: Administrador, Supervisor, Gerência, Analista, SAC, Fiscalização, Monitoramento, Secretária.

Incluídos os nomes do checklist, **sem apagar** os atuais:

| Checklist | No portal |
|---|---|
| admin | Administrador (`*` nos módulos) |
| encarregado | **Encarregado** (novo) + Supervisor |
| monitoramento | Monitoramento |
| planejamento | **Planejamento** (novo) + Analista / Gerência |
| consulta | **Consulta** (novo; default só grupo Indicadores) |

Gestor de usuários no Firestore: Administrador, Supervisor, Gerência. Avisos: + Secretária.

## Recuperação de senha

`Esqueci minha senha` em `login.html` → `sendPasswordResetEmail`. Qualquer logado altera a própria senha no painel da home (reautentica com a senha atual). Testado no código; o e-mail sai do Firebase (template no console).

## 2FA admin

Código TOTP no login (segundo passo) e no painel Senha da home (só Administrador), `assets/js/portal-mfa.js`.

No console Firebase: **Authentication → Multi-factor → TOTP**. Isso exige Identity Platform. Se ainda não estiver ligado, a inscrição mostra o recado. SMS não usamos (custo / telefone).

## Segredos no código público

- `firebase-config.js` `apiKey`: **é público** (restrição por domínio no console).
- Conta de serviço: `.secrets/` no `.gitignore`; o build da Lambda copia para o zip, não para o git.
- `backend/.env` ignorado. `PORTAL_API_KEY` só no ambiente da Lambda.
- `usuarios.js` só tem 4 e-mails de fallback, sem senha.

## Regras API e Firestore

`firestore.rules`: login obrigatório; `usuarios` leitura própria ou gestor; writes de usuário só gestor; `config` write só `odair.marin@icloud.com`. Catch-all `if false` no fim (não abre coleção nova).

Publicar regras (produção, com confirmação):

```bash
cd /tmp/portalciop-live && npx firebase deploy --only firestore:rules --project portal-ciop
```

API: Bearer + cadastro ativo quando o Admin SDK sobe.

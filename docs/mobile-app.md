# Portal CIOP — app mobile (Android + iOS)

Apps **internos** (Capacitor + WebView) que abrem `https://www.portalciop.com.br/app/`.  
**Sem Play Store / App Store** — instalação manual, uso restrito a quem tem login Firebase.

| Plataforma | Pacote | Saída |
|------------|--------|--------|
| Android | `com.portalciop.internal` | `dist-apk/*.apk` |
| iOS | `com.portalciop.internal` | `dist-ipa/*.ipa` ou Run no Xcode |

Atualizações do portal publicadas em **portalciop.com.br** aparecem no app **sem reinstalar** — basta fechar e abrir o app (modo URL remota, padrão).

---

## Atualizar no iPhone

| O quê | Como |
|-------|------|
| Telas e dados do portal | Publicar no portal → fechar e abrir o app |
| App expirou (~7 dias, Apple ID grátis) | `./scripts/install-ios-device.sh` |
| Mudança no shell nativo (Capacitor) | `./scripts/install-ios-device.sh` |

Modo **bundle local** (opcional, exige reinstalar a cada mudança):

```bash
CAPACITOR_BUNDLE=1 ./scripts/install-ios-device.sh
```

---

## Pré-requisitos

### Comum
- Node.js 18+
- `cd portal-app && npm ci`

### Android
- [Android Studio](https://developer.android.com/studio) + JDK 17
- `export ANDROID_HOME="$HOME/Library/Android/sdk"`

### iOS (somente Mac)
- [Xcode](https://developer.apple.com/xcode/) completo (App Store)
- Se `xcode-select` apontar só para Command Line Tools, use sem `sudo`:
  `export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`
- [CocoaPods](https://cocoapods.org): `brew install cocoapods`
- **Apple ID** no Xcode (Settings → Accounts) — obrigatório para iPhone físico
- Conta grátis: ~7 dias no aparelho; Developer paga: 1 ano + ad-hoc

---

## Build rápido

Na raiz do repositório:

```bash
chmod +x scripts/build-mobile-app.sh scripts/build-android-apk.sh scripts/build-ios-ipa.sh

# Android + iOS (Mac)
./scripts/build-mobile-app.sh

# Só Android
./scripts/build-mobile-app.sh android

# Só iOS
./scripts/build-mobile-app.sh ios
```

Ambiente de teste (opcional):

```bash
CAPACITOR_PORTAL_URL=https://odairmpicolo-blip.github.io/portal-teste/app/ \
  ./scripts/build-mobile-app.sh android
```

---

## Android — instalar APK

1. Gere: `./scripts/build-android-apk.sh`
2. **USB:** depuração USB → `adb install -r dist-apk/portal-ciop-internal-*.apk`
3. **Arquivo:** copie o `.apk` para o celular e instale (fontes desconhecidas)

---

## iOS — instalar no iPhone

### Primeira vez (assinatura — ~1 min no Xcode)

O Xcode já deve estar aberto em `portal-app/ios/App/App.xcworkspace`. Se não:

```bash
cd portal-app && npm run cap:open:ios
```

1. **Xcode → Settings → Accounts** → **+** → entre com seu **Apple ID**
2. No projeto, clique em **App** (target azul) → **Signing & Capabilities**
3. Marque **Automatically manage signing** e escolha seu **Team**
4. Conecte o **iPhone** (USB), desbloqueie e toque **Confiar neste computador**
5. No iPhone: **Ajustes → Privacidade e Segurança → Modo Desenvolvedor → Ativar** (reinicia o aparelho)
6. Instale pelo script ou Xcode:

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
./scripts/install-ios-device.sh
```

Ou no Xcode: selecione o iPhone no topo → **Run (▶)**

> Com Apple ID gratuito o app expira em ~7 dias; rode de novo para renovar.

### Teste no simulador (Mac, sem Apple ID)

```bash
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
IOS_SIMULATOR="iPhone 17" ./scripts/run-ios-simulator.sh
```

### Opção B — IPA (script)

```bash
# Conta Developer: registre o UDID do iPhone em developer.apple.com
export IOS_TEAM_ID="XXXXXXXXXX"   # Team ID do Xcode
export IOS_EXPORT_METHOD=development  # ou ad-hoc
./scripts/build-ios-ipa.sh
```

Instale o `.ipa` via **Apple Configurator 2**, **Finder** (arrastar para o iPhone) ou ferramentas de deploy interno.

---

## Restringir uso

- Não publique APK/IPA em lojas públicas
- Login continua via **Firebase** (e-mail/senha cadastrados no portal)
- Mesmo `appId` nos dois sistemas: só instalação manual + autenticação

---

## Manutenção

```bash
cd portal-app
npm run cap:sync          # Android + iOS
npm run cap:sync:android
npm run cap:sync:ios
npm run cap:open:android  # Android Studio
npm run cap:open:ios      # Xcode
```

Arquivos principais:
- `portal-app/capacitor.config.ts` — URL do portal, appId, navegação permitida
- `portal-app/www/index.html` — fallback offline (“Conectando…”)

import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect, useState } from 'react'
import { useAppPreferences } from '../context/app-preferences-context'
import { useBiometryLabels } from '../hooks/useBiometryLabels'
import { isBiometricAvailable } from '../lib/biometric-auth'
import type { ThemeMode } from '../lib/app-preferences'

export function SettingsPage() {
  const { biometricEnabled, setBiometricEnabled, themeMode, setThemeMode } = useAppPreferences()
  const { labels } = useBiometryLabels()
  const [biometriaDisponivel, setBiometriaDisponivel] = useState(false)
  const [appVersion, setAppVersion] = useState('…')

  useEffect(() => {
    void isBiometricAvailable().then(setBiometriaDisponivel)
    if (Capacitor.isNativePlatform()) {
      void App.getInfo().then((info) => setAppVersion(`${info.version} (${info.build})`))
    } else {
      setAppVersion('Web')
    }
  }, [])

  return (
    <div className="settings-page">
      <header className="settings-hero app-glass">
        <p className="settings-eyebrow">Preferências</p>
        <h1>Ajustes</h1>
        <p className="settings-sub">Personalize segurança e aparência do app.</p>
      </header>

      <section className="settings-section app-glass" aria-labelledby="settings-security">
        <h2 id="settings-security">Segurança</h2>
        <div className="settings-row">
          <div className="settings-row-text">
            <span className="settings-row-label">{labels.name}</span>
            <span className="settings-row-hint">
              {biometriaDisponivel
                ? 'Exigir biometria ao abrir o app'
                : 'Indisponível neste aparelho'}
            </span>
          </div>
          <label className="settings-switch">
            <input
              type="checkbox"
              checked={biometricEnabled && biometriaDisponivel}
              disabled={!biometriaDisponivel}
              onChange={(e) => setBiometricEnabled(e.target.checked)}
            />
            <span className="settings-switch-track" aria-hidden="true" />
          </label>
        </div>
      </section>

      <section className="settings-section app-glass" aria-labelledby="settings-theme">
        <h2 id="settings-theme">Aparência</h2>
        <p className="settings-section-hint">Tema do app</p>
        <div className="settings-segment" role="group" aria-label="Tema claro ou escuro">
          {(['light', 'dark'] as ThemeMode[]).map((mode) => (
            <button
              key={mode}
              type="button"
              className={`settings-segment-btn${themeMode === mode ? ' active' : ''}`}
              aria-pressed={themeMode === mode}
              onClick={() => setThemeMode(mode)}
            >
              {mode === 'light' ? 'Claro' : 'Escuro'}
            </button>
          ))}
        </div>
      </section>

      <section className="settings-section app-glass" aria-labelledby="settings-about">
        <h2 id="settings-about">Sobre</h2>
        <div className="settings-about">
          <div className="settings-about-row">
            <span>Portal CIOP</span>
            <span className="settings-muted">TCGL · Operações</span>
          </div>
          <div className="settings-about-row">
            <span>Versão</span>
            <span className="settings-muted">{appVersion}</span>
          </div>
        </div>
      </section>
    </div>
  )
}

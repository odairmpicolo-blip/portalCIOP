import { App } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { useEffect, useState, type FormEvent } from 'react'
import { useAppPreferences } from '../context/app-preferences-context'
import { useBiometryLabels } from '../hooks/useBiometryLabels'
import { useAuth } from '../hooks/useAuth'
import { isBiometricAvailable } from '../lib/biometric-auth'
import { loadSavedLogin, saveLoginLocally } from '../lib/saved-login'
import type { ThemeMode } from '../lib/app-preferences'

function senhaErrorMessage(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
    return 'Senha atual incorreta.'
  }
  if (code === 'auth/weak-password') {
    return 'A nova senha precisa ter pelo menos 6 caracteres.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'Não foi possível trocar a senha agora.'
}

export function SettingsPage() {
  const { biometricEnabled, setBiometricEnabled, themeMode, setThemeMode } = useAppPreferences()
  const { user, changePassword } = useAuth()
  const { labels } = useBiometryLabels()
  const [biometriaDisponivel, setBiometriaDisponivel] = useState(false)
  const [appVersion, setAppVersion] = useState(() => (Capacitor.isNativePlatform() ? '…' : 'Web'))
  const [senhaAtual, setSenhaAtual] = useState('')
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarSenha, setConfirmarSenha] = useState('')
  const [senhaStatus, setSenhaStatus] = useState('')
  const [senhaStatusTipo, setSenhaStatusTipo] = useState<'ok' | 'erro'>('ok')
  const [trocandoSenha, setTrocandoSenha] = useState(false)

  useEffect(() => {
    void isBiometricAvailable().then(setBiometriaDisponivel)
    if (Capacitor.isNativePlatform()) {
      void App.getInfo().then((info) => setAppVersion(`${info.version} (${info.build})`))
    }
  }, [])

  async function trocarSenha(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSenhaStatus('')

    if (!senhaAtual || !novaSenha || !confirmarSenha) {
      setSenhaStatusTipo('erro')
      setSenhaStatus('Preencha a senha atual, a nova senha e a confirmação.')
      return
    }
    if (novaSenha.length < 6) {
      setSenhaStatusTipo('erro')
      setSenhaStatus('A nova senha precisa ter pelo menos 6 caracteres.')
      return
    }
    if (novaSenha !== confirmarSenha) {
      setSenhaStatusTipo('erro')
      setSenhaStatus('A confirmação precisa ser igual à nova senha.')
      return
    }
    if (novaSenha === senhaAtual) {
      setSenhaStatusTipo('erro')
      setSenhaStatus('Use uma senha nova diferente da atual.')
      return
    }

    setTrocandoSenha(true)
    try {
      await changePassword(senhaAtual, novaSenha)
      const saved = loadSavedLogin()
      const userEmail = user?.email.toLowerCase()
      if (saved && userEmail && saved.email.toLowerCase() === userEmail) {
        saveLoginLocally(saved.email, novaSenha)
      }
      setSenhaAtual('')
      setNovaSenha('')
      setConfirmarSenha('')
      setSenhaStatusTipo('ok')
      setSenhaStatus('Senha alterada com sucesso.')
    } catch (error) {
      setSenhaStatusTipo('erro')
      setSenhaStatus(senhaErrorMessage(error))
    } finally {
      setTrocandoSenha(false)
    }
  }

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
        <form className="settings-password-form" onSubmit={trocarSenha}>
          <div className="settings-password-head">
            <span className="settings-row-label">Trocar senha</span>
            <span className="settings-row-hint">Atualize a senha de acesso ao portal.</span>
          </div>
          <label htmlFor="senhaAtual">Senha atual</label>
          <input
            id="senhaAtual"
            type="password"
            autoComplete="current-password"
            value={senhaAtual}
            onChange={(event) => setSenhaAtual(event.target.value)}
          />
          <label htmlFor="novaSenha">Nova senha</label>
          <input
            id="novaSenha"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={novaSenha}
            onChange={(event) => setNovaSenha(event.target.value)}
          />
          <label htmlFor="confirmarSenha">Confirmar nova senha</label>
          <input
            id="confirmarSenha"
            type="password"
            autoComplete="new-password"
            minLength={6}
            value={confirmarSenha}
            onChange={(event) => setConfirmarSenha(event.target.value)}
          />
          <button type="submit" className="settings-password-submit" disabled={trocandoSenha}>
            {trocandoSenha ? 'Alterando…' : 'Trocar senha'}
          </button>
          {senhaStatus ? (
            <p className={`settings-password-status ${senhaStatusTipo}`} role="status">
              {senhaStatus}
            </p>
          ) : null}
        </form>
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

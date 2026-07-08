import { useEffect, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useAppPreferences } from '../context/app-preferences-context'
import { useBiometryLabels } from '../hooks/useBiometryLabels'
import { promptBiometricFromGesture } from '../lib/biometric-auth'
import { portalAsset, isNativeApp } from '../lib/portal-origin'
import {
  canSaveLoginLocally,
  clearSavedLogin,
  loadSavedLogin,
  saveLoginLocally,
} from '../lib/saved-login'
import { markBiometricSatisfied } from '../lib/biometric-session'
import { setBiometricEnabled } from '../lib/app-preferences'

function mensagemErro(code: string, message: string): string {
  if (code === 'auth/user-not-found' || code === 'auth/invalid-credential') {
    return 'E-mail ou senha incorretos. Confirme se este usuário existe no Firebase Authentication.'
  }
  if (code === 'auth/invalid-email') return 'E-mail inválido.'
  if (code === 'auth/too-many-requests') return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
  return `Não foi possível entrar: ${message || code}`
}

export function LoginPage() {
  const { login, resetPassword } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const native = isNativeApp()
  const { biometricEnabled } = useAppPreferences()
  const { labels, available: biometriaDisponivel } = useBiometryLabels()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [usarBiometria, setUsarBiometria] = useState(false)
  const [temLoginSalvo, setTemLoginSalvo] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const destino = (location.state as { from?: string } | null)?.from || '/'

  async function entrar(emailValue: string, senhaValue: string) {
    setErro('')
    setLoading(true)
    try {
      await login(emailValue, senhaValue)
      if (native && usarBiometria && canSaveLoginLocally()) {
        saveLoginLocally(emailValue, senhaValue)
        setBiometricEnabled(true)
      } else if (canSaveLoginLocally()) {
        clearSavedLogin()
      }
      markBiometricSatisfied()
      navigate(destino, { replace: true })
    } catch (error) {
      const err = error as { code?: string; message?: string }
      setErro(mensagemErro(err.code || '', err.message || ''))
    } finally {
      setLoading(false)
    }
  }

  async function entrarComBiometria() {
    const saved = loadSavedLogin()
    if (!saved) {
      setErro('Nenhum acesso salvo neste aparelho. Entre com e-mail e senha.')
      return
    }
    setErro('')
    const ok = await promptBiometricFromGesture(labels.promptLogin)
    if (!ok) return
    await entrar(saved.email, saved.senha)
  }

  useEffect(() => {
    if (!canSaveLoginLocally()) return
    const saved = loadSavedLogin()
    if (!saved) return
    queueMicrotask(() => {
      setEmail(saved.email)
      setUsarBiometria(true)
      setTemLoginSalvo(true)
    })
  }, [])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    await entrar(email, senha)
  }

  function onBiometriaChange(checked: boolean) {
    setUsarBiometria(checked)
    if (!checked) clearSavedLogin()
  }

  async function onReset() {
    if (!email.trim()) {
      setErro('Informe seu e-mail para recuperar a senha.')
      return
    }
    setErro('')
    try {
      await resetPassword(email)
      alert('E-mail de recuperação enviado.')
    } catch (error) {
      const err = error as { code?: string; message?: string }
      let msg = err.message || 'Não foi possível enviar o e-mail.'
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-email') {
        msg = 'E-mail não encontrado ou inválido. Confirme o endereço cadastrado no portal.'
      }
      setErro(msg)
    }
  }

  return (
    <div className="login-page">
      <form className="login-card" onSubmit={onSubmit}>
        <div className="login-brand portal-brand-mark portal-brand-mark--center" aria-label="Portal CIOP TCGL Operações">
          <img className="portal-brand-art" src={portalAsset('/assets/img/titulo-portal-ciop.png')} alt="Portal CIOP" />
          <span className="portal-brand-meta">TCGL · Operações</span>
        </div>

        {native && temLoginSalvo && biometriaDisponivel && biometricEnabled ? (
          <button
            type="button"
            className="btn-primary login-faceid-btn"
            disabled={loading}
            onClick={() => void entrarComBiometria()}
          >
            {loading ? 'Entrando…' : labels.loginButton}
          </button>
        ) : null}

        <label htmlFor="email">E-mail</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="usuario@empresa.com.br"
          required
        />

        <label htmlFor="senha">Senha</label>
        <input
          id="senha"
          type="password"
          autoComplete="current-password"
          value={senha}
          onChange={(e) => setSenha(e.target.value)}
          required
        />

        {native && biometriaDisponivel && biometricEnabled ? (
          <label className="login-remember">
            <input
              type="checkbox"
              checked={usarBiometria}
              onChange={(e) => onBiometriaChange(e.target.checked)}
            />
            <span>{labels.saveAccessLabel}</span>
          </label>
        ) : null}

        {erro ? <p className="login-error" role="alert">{erro}</p> : null}

        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Entrando…' : 'Entrar com senha'}
        </button>

        <button type="button" className="btn-link" onClick={() => void onReset()}>
          Esqueci minha senha
        </button>

        {!native ? (
          <a href="/login.html" className="btn-link login-classic-link">
            Login clássico
          </a>
        ) : null}
      </form>
    </div>
  )
}

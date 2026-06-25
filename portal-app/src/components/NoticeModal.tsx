import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  dataAvisoLocal,
  destinatariosAviso,
  excluirAvisoFirestore,
  listarAvisosFirestore,
  periodoAvisoPadrao,
  salvarAvisoFirestore,
  valorDateTimeLocal,
} from '../lib/avisos'
import { listarUsuariosFirestore } from '../lib/users'
import type { PortalAviso } from '../types/aviso'
import type { PortalUser } from '../types/user'

const PERFIS_AVISO = [
  'Administrador',
  'Supervisor',
  'Gerência',
  'Analista',
  'SAC',
  'Fiscalização',
  'Monitoramento',
  'Secretária',
]

type NoticeModalProps = {
  open: boolean
  onClose: () => void
  onSaved?: () => void
}

type FormState = {
  id: string
  titulo: string
  mensagem: string
  inicio: string
  fim: string
  publico: boolean
  perfis: string[]
  usuarios: string[]
}

function formPadrao(): FormState {
  const { inicio, fim } = periodoAvisoPadrao()
  return {
    id: '',
    titulo: '',
    mensagem: '',
    inicio: valorDateTimeLocal(inicio),
    fim: valorDateTimeLocal(fim),
    publico: true,
    perfis: [],
    usuarios: [],
  }
}

export function NoticeModal({ open, onClose, onSaved }: NoticeModalProps) {
  const { user } = useAuth()
  const [form, setForm] = useState<FormState>(formPadrao)
  const [usuarios, setUsuarios] = useState<PortalUser[]>([])
  const [gestor, setGestor] = useState<PortalAviso[]>([])
  const [buscaUsuario, setBuscaUsuario] = useState('')
  const [status, setStatus] = useState('')
  const [statusTipo, setStatusTipo] = useState<'ok' | 'erro' | ''>('')
  const [salvando, setSalvando] = useState(false)

  useEffect(() => {
    if (!open) return

    let active = true

    listarUsuariosFirestore()
      .then((lista) => {
        if (!active) return
        setUsuarios(lista.filter((item) => item.ativo !== false))
      })
      .catch((error) => console.error('Erro ao carregar usuários para avisos:', error))

    listarAvisosFirestore({ gestor: true })
      .then((lista) => {
        if (!active) return
        setGestor(lista)
      })
      .catch((error) => console.error('Erro ao carregar avisos de gestor:', error))

    return () => {
      active = false
    }
  }, [open])

  async function recarregarGestor() {
    const lista = await listarAvisosFirestore({ gestor: true })
    setGestor(lista)
  }

  const usuariosFiltrados = useMemo(() => {
    const termo = buscaUsuario.trim().toLowerCase()
    if (!termo) return usuarios
    return usuarios.filter((item) =>
      [item.nome, item.email, item.perfil, item.registro].join(' ').toLowerCase().includes(termo),
    )
  }, [buscaUsuario, usuarios])

  function setStatusMsg(texto: string, tipo: 'ok' | 'erro' | '' = '') {
    setStatus(texto)
    setStatusTipo(tipo)
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    if (!user) return

    const titulo = form.titulo.trim()
    const mensagem = form.mensagem.trim()
    const inicioEm = new Date(form.inicio)
    const fimEm = new Date(form.fim)

    if (!titulo || !mensagem) {
      setStatusMsg('Informe título e mensagem.', 'erro')
      return
    }
    if (Number.isNaN(inicioEm.getTime()) || Number.isNaN(fimEm.getTime())) {
      setStatusMsg('Informe início e fim da exposição.', 'erro')
      return
    }
    if (fimEm.getTime() <= inicioEm.getTime()) {
      setStatusMsg('O fim da exposição deve ser depois do início.', 'erro')
      return
    }
    if (!form.publico && !form.perfis.length && !form.usuarios.length) {
      setStatusMsg('Escolha pelo menos um destinatário.', 'erro')
      return
    }

    setSalvando(true)
    setStatusMsg('Enviando aviso...')

    try {
      await salvarAvisoFirestore({
        id: form.id || undefined,
        titulo,
        mensagem,
        publico: form.publico,
        perfis: form.perfis,
        usuarios: form.usuarios,
        inicioEm,
        fimEm,
        autorEmail: user.email,
        autorNome: user.nome,
      })
      setStatusMsg(form.id ? 'Aviso atualizado.' : 'Aviso enviado.', 'ok')
      setForm(formPadrao())
      await recarregarGestor()
      onSaved?.()
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao enviar aviso.'
      setStatusMsg(`Não foi possível enviar: ${msg}`, 'erro')
    } finally {
      setSalvando(false)
    }
  }

  function editar(aviso: PortalAviso) {
    const padrao = periodoAvisoPadrao()
    const inicio = dataAvisoLocal(aviso.inicioEm) || padrao.inicio
    const fim = dataAvisoLocal(aviso.fimEm) || padrao.fim
    setForm({
      id: aviso.id,
      titulo: aviso.titulo,
      mensagem: aviso.mensagem,
      inicio: valorDateTimeLocal(inicio),
      fim: valorDateTimeLocal(fim),
      publico: aviso.publico,
      perfis: aviso.perfis,
      usuarios: aviso.usuarios,
    })
    setStatusMsg('')
    setStatusTipo('')
  }

  async function excluir(id: string) {
    if (!window.confirm('Deseja excluir este aviso?')) return
    try {
      await excluirAvisoFirestore(id)
      await recarregarGestor()
      onSaved?.()
      if (form.id === id) setForm(formPadrao())
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Erro ao excluir.'
      setStatusMsg(`Não foi possível excluir: ${msg}`, 'erro')
    }
  }

  function togglePerfil(perfil: string) {
    setForm((atual) => {
      const perfis = atual.perfis.includes(perfil)
        ? atual.perfis.filter((p) => p !== perfil)
        : [...atual.perfis, perfil]
      return { ...atual, publico: false, perfis }
    })
  }

  function toggleUsuario(email: string) {
    setForm((atual) => {
      const usuarios = atual.usuarios.includes(email)
        ? atual.usuarios.filter((u) => u !== email)
        : [...atual.usuarios, email]
      return { ...atual, publico: false, usuarios }
    })
  }

  if (!open) return null

  return (
    <div
      className="notice-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="notice-modal" role="dialog" aria-modal="true" aria-labelledby="avisoModalTitulo">
        <div className="notice-modal-header">
          <h2 id="avisoModalTitulo" className="notice-modal-title">
            {form.id ? 'Editar aviso' : 'Enviar aviso'}
          </h2>
          <button type="button" className="notice-modal-close" onClick={onClose} aria-label="Fechar">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        <div className="notice-modal-body">
          <form onSubmit={(event) => void onSubmit(event)}>
            <div className="notice-form-grid">
              <div className="notice-field-full">
                <label htmlFor="avisoTitulo">Título</label>
                <input
                  id="avisoTitulo"
                  type="text"
                  maxLength={120}
                  value={form.titulo}
                  onChange={(e) => setForm((f) => ({ ...f, titulo: e.target.value }))}
                />
              </div>

              <div className="notice-field-full">
                <label htmlFor="avisoMensagem">Mensagem</label>
                <textarea
                  id="avisoMensagem"
                  value={form.mensagem}
                  onChange={(e) => setForm((f) => ({ ...f, mensagem: e.target.value }))}
                />
              </div>

              <div>
                <label htmlFor="avisoInicio">Início</label>
                <input
                  id="avisoInicio"
                  type="datetime-local"
                  required
                  value={form.inicio}
                  onChange={(e) => setForm((f) => ({ ...f, inicio: e.target.value }))}
                />
              </div>

              <div>
                <label htmlFor="avisoFim">Fim</label>
                <input
                  id="avisoFim"
                  type="datetime-local"
                  required
                  value={form.fim}
                  onChange={(e) => setForm((f) => ({ ...f, fim: e.target.value }))}
                />
              </div>

              <div>
                <label>
                  Grupos <span className="notice-optional-label">opcional se escolher usuário</span>
                </label>
                <div className="notice-checks">
                  <label className="notice-check">
                    <input
                      type="checkbox"
                      checked={form.publico}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          publico: e.target.checked,
                          perfis: e.target.checked ? [] : f.perfis,
                          usuarios: e.target.checked ? [] : f.usuarios,
                        }))
                      }
                    />
                    Todos
                  </label>
                  {PERFIS_AVISO.map((perfil) => (
                    <label key={perfil} className="notice-check">
                      <input
                        type="checkbox"
                        checked={form.perfis.includes(perfil)}
                        disabled={form.publico}
                        onChange={() => togglePerfil(perfil)}
                      />
                      {perfil}
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label htmlFor="avisoBuscaUsuarios">Usuários</label>
                <input
                  id="avisoBuscaUsuarios"
                  type="search"
                  placeholder="Buscar usuário"
                  value={buscaUsuario}
                  disabled={form.publico}
                  onChange={(e) => setBuscaUsuario(e.target.value)}
                />
                <div className="notice-users-list">
                  {!usuariosFiltrados.length ? (
                    <div className="notice-empty">Nenhum usuário encontrado.</div>
                  ) : (
                    usuariosFiltrados.map((item) => (
                      <label key={item.email} className="notice-user-check">
                        <input
                          type="checkbox"
                          checked={form.usuarios.includes(item.email)}
                          disabled={form.publico}
                          onChange={() => toggleUsuario(item.email)}
                        />
                        <span>
                          {item.nome || item.email}
                          {item.perfil ? ` · ${item.perfil}` : ''}
                        </span>
                      </label>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="notice-actions">
              <button type="button" className="notice-action-secondary" onClick={onClose}>
                Cancelar
              </button>
              <button type="submit" className="notice-action-primary" disabled={salvando}>
                {salvando ? 'Enviando…' : form.id ? 'Salvar aviso' : 'Enviar aviso'}
              </button>
            </div>

            {status ? (
              <div className={`notice-editor-status${statusTipo ? ` ${statusTipo}` : ''}`}>
                {status}
              </div>
            ) : null}
          </form>

          <section className="notice-manage" aria-label="Avisos enviados">
            <h3 className="notice-manage-title">Avisos enviados</h3>
            <div className="notice-manage-list">
              {!gestor.length ? (
                <div className="notice-empty">Nenhum aviso enviado.</div>
              ) : (
                gestor.map((aviso) => (
                  <div key={aviso.id} className="notice-manage-item">
                    <div>
                      <strong>{aviso.titulo}</strong>
                      <span>{destinatariosAviso(aviso)}</span>
                    </div>
                    <div className="notice-manage-actions">
                      <button
                        type="button"
                        className="notice-edit-btn"
                        aria-label="Editar aviso"
                        onClick={() => editar(aviso)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="notice-delete-btn"
                        aria-label="Excluir aviso"
                        onClick={() => void excluir(aviso.id)}
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

import { useEffect, useState } from 'react'
import { usePortalShell } from '../context/portal-shell-context'
import { useAuth } from '../hooks/useAuth'
import { listarAvisosFirestore } from '../lib/avisos'
import type { PortalAviso } from '../types/aviso'

const ROTACAO_MS = 6000

type NoticeBoardProps = {
  refreshKey: number
}

export function NoticeBoard({ refreshKey }: NoticeBoardProps) {
  const { user } = useAuth()
  const [avisos, setAvisos] = useState<PortalAviso[]>([])
  const [indice, setIndice] = useState(0)
  const [loading, setLoading] = useState(true)
  const [pausado, setPausado] = useState(false)
  const [erro, setErro] = useState(false)

  useEffect(() => {
    if (!user) return

    let active = true

    listarAvisosFirestore({
      email: user.email,
      perfil: user.perfil,
    })
      .then((lista) => {
        if (!active) return
        setAvisos(lista)
        setIndice(0)
        setErro(false)
      })
      .catch((error) => {
        console.error('Erro ao carregar avisos:', error)
        if (!active) return
        setAvisos([])
        setErro(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [user, refreshKey])

  useEffect(() => {
    if (pausado || avisos.length <= 1) return
    const timer = window.setInterval(() => {
      setIndice((atual) => (atual + 1) % avisos.length)
    }, ROTACAO_MS)
    return () => window.clearInterval(timer)
  }, [avisos.length, pausado, indice])

  const avisoAtivo = avisos[indice]

  return (
    <section
      className="notice-board"
      aria-label="Quadro de avisos"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
    >
      <div className="notice-board-head">
        <span className="notice-board-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M4 5h16" />
            <path d="M4 12h10" />
            <path d="M4 19h16" />
            <path d="m17 10 3 2-3 2v-4Z" />
          </svg>
        </span>
        <span className="notice-board-title">Avisos</span>
        {avisos.length > 0 ? (
          <span className="notice-count">{avisos.length}</span>
        ) : null}
      </div>

      <div className={`notice-carousel-wrap${pausado ? ' is-paused' : ''}`}>
        <div className="notice-list notice-carousel-track">
          {loading ? (
            <div className="notice-empty">Carregando avisos...</div>
          ) : erro ? (
            <div className="notice-empty">Avisos indisponíveis.</div>
          ) : !avisos.length ? (
            <div className="notice-empty">Nenhum aviso no momento.</div>
          ) : (
            avisos.map((aviso, idx) => (
              <article
                key={aviso.id}
                className={`notice-item${idx === indice ? ' is-active' : ''}`}
              >
                <div className="notice-item-accent" aria-hidden="true" />
                <div className="notice-item-body">
                  <div className="notice-item-title">{aviso.titulo}</div>
                  <div className="notice-item-text">{aviso.mensagem}</div>
                </div>
              </article>
            ))
          )}
        </div>

        {avisos.length > 1 ? (
          <div className="notice-carousel-dots" aria-label="Navegação de avisos">
            {avisos.map((aviso, idx) => (
              <button
                key={aviso.id}
                type="button"
                className={`notice-carousel-dot${idx === indice ? ' is-active' : ''}`}
                aria-label={`Aviso ${idx + 1} de ${avisos.length}`}
                aria-selected={idx === indice}
                onClick={() => setIndice(idx)}
              />
            ))}
          </div>
        ) : null}

        {avisos.length > 1 ? (
          <div className="notice-carousel-progress" aria-hidden="true">
            <span
              key={`${avisoAtivo?.id}-${indice}-${pausado}`}
              className="notice-carousel-progress-bar"
            />
          </div>
        ) : null}
      </div>
    </section>
  )
}

export function NoticeBoardContainer() {
  const { noticeVersion } = usePortalShell()
  return <NoticeBoard refreshKey={noticeVersion} />
}

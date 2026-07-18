export function LoadingScreen({ label = 'Carregando portal' }: { label?: string }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-box">
        <div className="loading-brand">
          Portal <span>CIOP</span>
        </div>
        <div className="loading-mark" aria-hidden="true">
          <span className="loading-ring" />
          <span className="loading-ring-2" />
          <div className="loading-core">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M4 15V8.5A3.5 3.5 0 0 1 7.5 5h9A3.5 3.5 0 0 1 20 8.5V15" />
              <path d="M3 15h18v2.5a1.5 1.5 0 0 1-1.5 1.5H4.5A1.5 1.5 0 0 1 3 17.5V15z" />
              <circle cx="7.5" cy="18.5" r="1.4" />
              <circle cx="16.5" cy="18.5" r="1.4" />
              <path d="M7 9h10M7 12h4" />
            </svg>
          </div>
        </div>
        <p className="loading-title">{label}</p>
        <p className="loading-sub">Monitoramento em tempo real</p>
        <div className="loading-bar" aria-hidden="true">
          <i />
        </div>
      </div>
    </div>
  )
}

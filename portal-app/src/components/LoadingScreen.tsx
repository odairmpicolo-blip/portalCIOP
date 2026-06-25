export function LoadingScreen({ label = 'Carregando portal' }: { label?: string }) {
  return (
    <div className="loading-screen" role="status" aria-live="polite">
      <div className="loading-box">
        <div className="loading-spinner" aria-hidden="true" />
        <p>{label}</p>
      </div>
    </div>
  )
}

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { consumirRedirectSpa } from '../lib/spa-redirect'

export function SpaRedirect() {
  const navigate = useNavigate()

  useEffect(() => {
    const destino = consumirRedirectSpa()
    if (!destino) return

    try {
      const url = new URL(destino, window.location.origin)
      let path = url.pathname
      if (path.startsWith('/app')) path = path.slice(4) || '/'
      if (!path.startsWith('/')) path = `/${path}`
      navigate(`${path}${url.search}${url.hash}`, { replace: true })
    } catch {
      navigate('/', { replace: true })
    }
  }, [navigate])

  return null
}

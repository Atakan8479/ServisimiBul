import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { unreadNotificationCount } from './notification-api'

export function NotificationNavLink({ to }: { to: string }) {
  const location = useLocation()
  const [count, setCount] = useState(0)

  useEffect(() => {
    let disposed = false
    let activeController: AbortController | undefined

    const load = () => {
      activeController?.abort()
      activeController = new AbortController()
      void unreadNotificationCount(activeController.signal)
        .then((response) => {
          if (!disposed) setCount(response.unreadCount)
        })
        .catch((error: unknown) => {
          if (
            !disposed &&
            !(error instanceof DOMException && error.name === 'AbortError')
          ) {
            setCount(0)
          }
        })
    }

    const onVisibility = () => {
      if (document.visibilityState === 'visible') load()
    }
    load()
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') load()
    }, 60_000)
    window.addEventListener('focus', load)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      disposed = true
      activeController?.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', load)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [location.key])

  return (
    <NavLink className="notification-nav-link" to={to} viewTransition>
      <span>Bildirim merkezi</span>
      {count > 0 && (
        <span
          className="notification-count"
          aria-label={`${count} okunmamış bildirim`}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </NavLink>
  )
}

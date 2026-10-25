import { useEffect, useRef, useState } from 'react'
import {
  NavLink,
  Outlet,
  useLocation,
  useMatches,
  useNavigation,
} from 'react-router-dom'
import { RoadBackdrop } from './RoadBackdrop'
import {
  AUTH_ROLE_CHANGED_EVENT,
  knownAuthRole,
} from '../features/auth/auth-api'
import { NotificationNavLink } from '../features/notification/NotificationNavLink'

export function PublicLayout() {
  const [role, setRole] = useState(knownAuthRole)

  useEffect(() => {
    const refreshRole = () => setRole(knownAuthRole())
    window.addEventListener(AUTH_ROLE_CHANGED_EVENT, refreshRole)
    return () => {
      window.removeEventListener(AUTH_ROLE_CHANGED_EVENT, refreshRole)
    }
  }, [])

  return (
    <div className="app-shell">
      <RoadBackdrop />
      <a className="skip-link" href="#main-content">
        İçeriğe geç
      </a>
      <header className="site-header">
        <NavLink className="brand" to="/" viewTransition>
          ServisimiBul
        </NavLink>
        <nav aria-label="Ana menü">
          <NavLink to="/" viewTransition>
            Ana sayfa
          </NavLink>
          <NavLink to="/demands" viewTransition>
            Talep panosu
          </NavLink>
          {role === 'PARENT' ? (
            <NotificationNavLink to="/notifications" />
          ) : (
            <NavLink to="/operator/login" viewTransition>
              Giriş
            </NavLink>
          )}
        </nav>
      </header>
      <main id="main-content" className="page-content">
        <Outlet />
      </main>
    </div>
  )
}

export function RouteAccessibility() {
  const location = useLocation()
  const matches = useMatches()
  const navigation = useNavigation()
  const previousRoutePath = useRef(location.pathname)
  const previousHeading = useRef<HTMLElement | null>(null)
  let pageTitle = 'ServisimiBul'

  matches.forEach((match) => {
    const title = (match.handle as { pageTitle?: string } | undefined)
      ?.pageTitle
    if (title) pageTitle = title
  })

  useEffect(() => {
    if (navigation.state !== 'idle') return

    document.title =
      pageTitle === 'ServisimiBul' ? pageTitle : `${pageTitle} | ServisimiBul`
    const routeChanged = previousRoutePath.current !== location.pathname
    previousRoutePath.current = location.pathname
    if (!routeChanged) {
      previousHeading.current = document.querySelector('main h1')
      return
    }

    const focusNewHeading = () => {
      const heading = document.querySelector<HTMLElement>('main h1')
      if (!heading || heading === previousHeading.current) return false
      heading.tabIndex = -1
      heading.focus()
      previousHeading.current = heading
      return true
    }
    if (focusNewHeading()) return

    const observer = new MutationObserver(() => {
      if (focusNewHeading()) observer.disconnect()
    })
    observer.observe(document.body, { childList: true, subtree: true })
    const timeout = window.setTimeout(() => observer.disconnect(), 2_000)
    return () => {
      observer.disconnect()
      window.clearTimeout(timeout)
    }
  }, [location.pathname, navigation.state, pageTitle])

  return <Outlet />
}

import { useEffect, useRef, useState } from 'react'
import {
  NavLink,
  Outlet,
  useLocation,
  useMatches,
  useNavigation,
} from 'react-router-dom'
import { RoadBackdrop } from './RoadBackdrop'
import { BrandLockup } from './design-system'
import {
  AUTH_ROLE_CHANGED_EVENT,
  knownAuthRole,
} from '../features/auth/auth-api'
import { NotificationNavLink } from '../features/notification/NotificationNavLink'

export function PublicLayout() {
  const [role, setRole] = useState(knownAuthRole)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const refreshRole = () => setRole(knownAuthRole())
    window.addEventListener(AUTH_ROLE_CHANGED_EVENT, refreshRole)
    return () => {
      window.removeEventListener(AUTH_ROLE_CHANGED_EVENT, refreshRole)
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  return (
    <div className="app-shell">
      <RoadBackdrop />
      <a className="skip-link" href="#main-content">
        İçeriğe geç
      </a>
      <header className="site-header">
        <NavLink
          aria-label="ServisimiBul ana sayfa"
          className="brand"
          to="/"
          viewTransition
        >
          <BrandLockup />
        </NavLink>
        <button
          className="site-nav-toggle"
          type="button"
          aria-controls="public-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          Menü
        </button>
        <nav
          aria-label="Ana menü"
          className={`site-nav${menuOpen ? ' open' : ''}`}
          id="public-navigation"
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) setMenuOpen(false)
          }}
        >
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

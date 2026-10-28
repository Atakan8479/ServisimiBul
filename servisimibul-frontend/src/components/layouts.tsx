import { useEffect, useRef, useState } from 'react'
import {
  NavLink,
  Outlet,
  useLocation,
  useMatches,
  useNavigate,
  useNavigation,
} from 'react-router-dom'
import { ApiError } from '../api/client'
import { RoadBackdrop } from './RoadBackdrop'
import { BrandLockup } from './design-system'
import {
  AUTH_ROLE_CHANGED_EVENT,
  clearKnownAuthRole,
  knownAuthRole,
  logout,
} from '../features/auth/auth-api'
import { NotificationNavLink } from '../features/notification/NotificationNavLink'

export function PublicLayout() {
  const [role, setRole] = useState(knownAuthRole)
  const [menuOpen, setMenuOpen] = useState(false)
  const [logoutError, setLogoutError] = useState<string>()
  const [loggingOut, setLoggingOut] = useState(false)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const location = useLocation()
  const navigate = useNavigate()

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
      if (event.key !== 'Escape') return
      setMenuOpen(false)
      menuButtonRef.current?.focus()
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  async function signOutParent() {
    setLoggingOut(true)
    setLogoutError(undefined)
    try {
      await logout()
      void navigate('/parent/login', { replace: true, viewTransition: true })
    } catch (error) {
      if (error instanceof ApiError && error.sessionExpired) {
        clearKnownAuthRole()
        void navigate('/parent/login?reason=session', { replace: true })
        return
      }
      setLogoutError('Çıkış yapılamadı. Lütfen tekrar deneyin.')
      setLoggingOut(false)
    }
  }

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
          ref={menuButtonRef}
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
            if ((event.target as HTMLElement).closest('a, button')) {
              setMenuOpen(false)
            }
          }}
        >
          <NavLink to="/" viewTransition>
            Ana sayfa
          </NavLink>
          <NavLink to="/demands" viewTransition>
            Talep panosu
          </NavLink>
          {role === 'PARENT' ? (
            <>
              <span className="nav-session">Veli oturumu açık</span>
              <NotificationNavLink to="/notifications" />
              <button
                disabled={loggingOut}
                onClick={() => void signOutParent()}
                type="button"
              >
                {loggingOut ? 'Çıkış yapılıyor…' : 'Çıkış yap'}
              </button>
            </>
          ) : (
            <>
              <NavLink to="/parent/login" viewTransition>
                Veli girişi
              </NavLink>
              <NavLink to="/parent/register" viewTransition>
                Veli kaydı
              </NavLink>
              <NavLink to="/operator/login" viewTransition>
                İşletmeci girişi
              </NavLink>
              <NavLink to="/operator/register" viewTransition>
                İşletmeci kaydı
              </NavLink>
            </>
          )}
        </nav>
      </header>
      {logoutError && (
        <div className="form-error site-alert" role="alert">
          {logoutError}
        </div>
      )}
      <main
        id="main-content"
        className={`page-content${location.pathname === '/' ? ' home-page-content' : ''}`}
      >
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

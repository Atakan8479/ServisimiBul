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
  const navigationRef = useRef<HTMLDivElement>(null)
  const restoreMenuFocusRef = useRef(true)
  const wasMenuOpenRef = useRef(false)
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!window.matchMedia) return

    const desktop = window.matchMedia('(min-width: 64.0625rem)')
    const resetDesktopMenu = () => {
      if (!desktop.matches || !menuOpen) return
      restoreMenuFocusRef.current = false
      setMenuOpen(false)
    }

    resetDesktopMenu()
    desktop.addEventListener('change', resetDesktopMenu)
    return () => desktop.removeEventListener('change', resetDesktopMenu)
  }, [menuOpen])

  useEffect(() => {
    const refreshRole = () => setRole(knownAuthRole())
    window.addEventListener(AUTH_ROLE_CHANGED_EVENT, refreshRole)
    return () => {
      window.removeEventListener(AUTH_ROLE_CHANGED_EVENT, refreshRole)
    }
  }, [])

  useEffect(() => {
    if (!menuOpen) {
      if (wasMenuOpenRef.current && restoreMenuFocusRef.current) {
        menuButtonRef.current?.focus()
      }
      wasMenuOpenRef.current = false
      return
    }

    wasMenuOpenRef.current = true
    restoreMenuFocusRef.current = true
    const navigation = navigationRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    navigation
      ?.querySelector<HTMLElement>('a[href], button:not([disabled])')
      ?.focus()

    const focusableElements = () =>
      Array.from(
        navigation?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled])',
        ) ?? [],
      )

    const containFocus = (event: FocusEvent) => {
      if (navigation?.contains(event.target as Node)) return
      focusableElements()[0]?.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenuOpen(false)
        return
      }
      if (event.key !== 'Tab') return

      const focusable = focusableElements()
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('focusin', containFocus)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      document.removeEventListener('focusin', containFocus)
      document.removeEventListener('keydown', handleKeyDown)
    }
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
      <a
        aria-hidden={menuOpen || undefined}
        className="skip-link"
        href="#main-content"
        tabIndex={menuOpen ? -1 : undefined}
      >
        İçeriğe geç
      </a>
      <header className="site-header">
        <NavLink
          inert={menuOpen || undefined}
          aria-label="ServisimiBul ana sayfa"
          className="brand"
          to="/"
          viewTransition
        >
          <BrandLockup />
        </NavLink>
        <button
          ref={menuButtonRef}
          inert={menuOpen || undefined}
          className="site-nav-toggle"
          type="button"
          aria-controls="public-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          Menü
        </button>
        <div
          ref={navigationRef}
          aria-label={menuOpen ? 'Ana menü' : undefined}
          aria-modal={menuOpen || undefined}
          className={`site-nav${menuOpen ? ' open' : ''}`}
          id="public-navigation"
          role={menuOpen ? 'dialog' : undefined}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a, button')) {
              restoreMenuFocusRef.current = false
              setMenuOpen(false)
            }
          }}
        >
          <nav aria-label="Ana menü">
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
                <NavLink
                  className="site-nav-login"
                  to="/parent/login"
                  viewTransition
                >
                  Veli girişi
                </NavLink>
                <NavLink
                  className="site-nav-primary"
                  to="/parent/register"
                  viewTransition
                >
                  Veli kaydı
                </NavLink>
                <NavLink
                  className="site-nav-operator"
                  to="/operator/login"
                  viewTransition
                >
                  İşletmeci girişi
                </NavLink>
                <NavLink
                  className="site-nav-operator"
                  to="/operator/register"
                  viewTransition
                >
                  İşletmeci kaydı
                </NavLink>
              </>
            )}
          </nav>
        </div>
      </header>
      {menuOpen && (
        <button
          aria-hidden="true"
          className="site-nav-backdrop"
          onClick={() => {
            setMenuOpen(false)
          }}
          tabIndex={-1}
          type="button"
        />
      )}
      {logoutError && (
        <div
          className="form-error site-alert"
          inert={menuOpen || undefined}
          role="alert"
        >
          {logoutError}
        </div>
      )}
      <main
        id="main-content"
        className={`page-content${location.pathname === '/' ? ' home-page-content' : ''}`}
        inert={menuOpen || undefined}
      >
        <Outlet />
      </main>
      <footer className="site-footer" inert={menuOpen || undefined}>
        <div className="site-footer-inner">
          <div>
            <BrandLockup />
            <p>Okul servisi aramanın daha açık yolu.</p>
          </div>
          <nav aria-label="Alt menü">
            <NavLink to="/">Ana sayfa</NavLink>
            <NavLink to="/demands">Talep panosu</NavLink>
            <NavLink to="/parent/register">Veli kaydı</NavLink>
            <NavLink to="/operator/register">İşletmeci kaydı</NavLink>
          </nav>
        </div>
      </footer>
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

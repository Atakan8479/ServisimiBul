import { useCallback, useEffect, useRef, useState } from 'react'
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
import { RoutePendingIndicator } from './RoutePendingIndicator'
import { BrandLockup } from './design-system'
import {
  AUTH_ROLE_CHANGED_EVENT,
  authStateKnown,
  knownAuthRole,
  knownAuthUserId,
  logout,
  onAuthChangedInOtherTab,
  refreshAuthRole,
  type AuthRole,
} from '../features/auth/auth-api'
import { NotificationNavLink } from '../features/notification/NotificationNavLink'

const sessionNavigation: Record<
  AuthRole,
  {
    label: string
    home?: { to: string; label: string }
    notifications: string
    account?: string
    afterLogout: string
    loginOnExpiry: string
  }
> = {
  PARENT: {
    label: 'Veli oturumu açık',
    notifications: '/notifications',
    account: '/parent/account',
    afterLogout: '/parent/login',
    loginOnExpiry: '/parent/login?reason=session',
  },
  OPERATOR: {
    label: 'İşletmeci oturumu açık',
    home: { to: '/operator', label: 'İşletmeci paneli' },
    notifications: '/operator/notifications',
    account: '/operator/account',
    afterLogout: '/operator/login',
    loginOnExpiry: '/operator/login?reason=session',
  },
  ADMIN: {
    label: 'Yönetici oturumu açık',
    home: { to: '/admin', label: 'Yönetim paneli' },
    notifications: '/admin/notifications',
    afterLogout: '/',
    loginOnExpiry: '/login?reason=session',
  },
}

function AccountMenu({
  loggingOut,
  onSignOut,
  session,
}: {
  loggingOut: boolean
  onSignOut: () => void
  session: (typeof sessionNavigation)[AuthRole]
}) {
  const [open, setOpen] = useState(false)
  const [present, setPresent] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setOpen(false)
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setPresent(false)
    }
  }, [])

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) close()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close()
      buttonRef.current?.focus()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [close, open])

  return (
    <div className="account-menu" ref={menuRef}>
      <button
        aria-controls="account-menu-panel"
        aria-expanded={open}
        className="account-menu-trigger"
        data-keep-navigation-open
        id="account-menu-trigger"
        onClick={() => {
          if (open) {
            close()
          } else {
            setPresent(true)
            setOpen(true)
          }
        }}
        ref={buttonRef}
        type="button"
      >
        Hesabım
        <svg
          aria-hidden="true"
          className="account-menu-chevron"
          fill="none"
          focusable="false"
          viewBox="0 0 16 16"
        >
          <path
            d="M4 6l4 4 4-4"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
          />
        </svg>
      </button>
      {present && (
        <div
          aria-hidden={!open}
          aria-labelledby="account-menu-trigger"
          className="account-menu-panel"
          data-state={open ? 'open' : 'closed'}
          id="account-menu-panel"
          inert={!open}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) close()
          }}
          onTransitionEnd={(event) => {
            if (
              event.target === event.currentTarget &&
              event.propertyName === 'opacity' &&
              !open
            ) {
              setPresent(false)
            }
          }}
          role="group"
        >
          <p className="account-menu-status">{session.label}</p>
          {session.account && (
            <NavLink to={session.account} viewTransition>
              Hesap ve gizlilik
            </NavLink>
          )}
          <button
            data-keep-navigation-open
            disabled={loggingOut}
            onClick={onSignOut}
            type="button"
          >
            {loggingOut ? 'Çıkış yapılıyor…' : 'Çıkış yap'}
          </button>
        </div>
      )}
    </div>
  )
}

const footerLinkGroups = [
  {
    id: 'footer-group-discover',
    label: 'Keşfet',
    links: [
      { to: '/', label: 'Ana sayfa' },
      { to: '/demands', label: 'Talep panosu' },
    ],
  },
  {
    id: 'footer-group-account',
    label: 'Hesap',
    links: [
      { to: '/login', label: 'Giriş yap' },
      { to: '/register', label: 'Kayıt ol' },
    ],
  },
  {
    id: 'footer-group-legal',
    label: 'Yasal',
    links: [
      { to: '/privacy/notice', label: 'Gizlilik ve kişisel veriler' },
      { to: '/terms', label: 'Kullanım koşulları' },
      { to: '/privacy/requests', label: 'Kişisel veri başvuru yolu' },
    ],
  },
] as const

export function PublicLayout() {
  const sessionRevision = useRef(0)
  const [authSession, setAuthSession] = useState(() => ({
    key: '0',
    role: knownAuthRole(),
    userId: knownAuthUserId(),
  }))
  const { role } = authSession
  // Header shows no account controls until the server confirms the session once.
  const [authChecked, setAuthChecked] = useState(authStateKnown)
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
    let active = true
    const refreshSession = () => {
      const nextRole = knownAuthRole()
      const nextUserId = knownAuthUserId()
      setAuthSession((current) =>
        current.role === nextRole && current.userId === nextUserId
          ? current
          : {
              key: String(++sessionRevision.current),
              role: nextRole,
              userId: nextUserId,
            },
      )
    }
    const verify = () => {
      void refreshAuthRole()
        .catch(() => undefined)
        .finally(() => {
          if (!active) return
          refreshSession()
          setAuthChecked(true)
        })
    }
    // Guests are not re-asked on focus; another tab's login reaches them via the channel.
    const verifySignedIn = () => {
      if (knownAuthRole() && document.visibilityState === 'visible') verify()
    }
    // Ask once per page load; later mounts reuse the answer already received.
    if (!authStateKnown()) verify()
    const stopListening = onAuthChangedInOtherTab(verify)
    window.addEventListener(AUTH_ROLE_CHANGED_EVENT, refreshSession)
    window.addEventListener('focus', verifySignedIn)
    document.addEventListener('visibilitychange', verifySignedIn)
    return () => {
      active = false
      stopListening()
      window.removeEventListener(AUTH_ROLE_CHANGED_EVENT, refreshSession)
      window.removeEventListener('focus', verifySignedIn)
      document.removeEventListener('visibilitychange', verifySignedIn)
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
        if (
          navigation?.querySelector(
            '.account-menu-trigger[aria-expanded="true"]',
          )
        ) {
          return
        }
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

  async function signOut(session: (typeof sessionNavigation)[AuthRole]) {
    setLoggingOut(true)
    setLogoutError(undefined)
    try {
      await logout()
      restoreMenuFocusRef.current = false
      setMenuOpen(false)
      void navigate(session.afterLogout, {
        replace: true,
        viewTransition: true,
      })
    } catch (error) {
      if (error instanceof ApiError && error.sessionExpired) {
        restoreMenuFocusRef.current = false
        setMenuOpen(false)
        void navigate(session.loginOnExpiry, { replace: true })
        return
      }
      setLogoutError('Çıkış yapılamadı. Tekrar deneyin.')
      setMenuOpen(false)
    } finally {
      // The layout stays mounted across logout → login, so always release the busy state.
      setLoggingOut(false)
    }
  }

  const session = role && sessionNavigation[role]

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
            const target = event.target as HTMLElement
            if (
              menuOpen &&
              target.closest('a, button') &&
              !target.closest('[data-keep-navigation-open]')
            ) {
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
            {!authChecked ? null : session ? (
              <>
                {session.home && (
                  <NavLink to={session.home.to} viewTransition>
                    {session.home.label}
                  </NavLink>
                )}
                <NotificationNavLink key={role} to={session.notifications} />
                <AccountMenu
                  key={authSession.key}
                  loggingOut={loggingOut}
                  onSignOut={() => void signOut(session)}
                  session={session}
                />
              </>
            ) : (
              <>
                <NavLink className="site-nav-login" to="/login" viewTransition>
                  Giriş yap
                </NavLink>
                <NavLink
                  className="site-nav-primary"
                  to="/register"
                  viewTransition
                >
                  Kayıt ol
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
        <Outlet
          context={
            {
              authChecked,
              role: authChecked ? role : undefined,
              sessionKey: authChecked ? authSession.key : undefined,
              userId: authChecked ? authSession.userId : undefined,
            } satisfies PublicAuthContext
          }
        />
      </main>
      <footer className="site-footer" inert={menuOpen || undefined}>
        <div className="site-footer-inner">
          <div className="site-footer-brand">
            <BrandLockup />
            <p className="site-footer-tagline">
              Okul servisi aramanın daha açık yolu.
            </p>
          </div>
          <nav aria-label="Alt menü" className="site-footer-nav">
            {footerLinkGroups.map((group) => (
              <div className="site-footer-group" key={group.id}>
                <p className="site-footer-group-label" id={group.id}>
                  {group.label}
                </p>
                <ul aria-labelledby={group.id}>
                  {group.links.map((link) => (
                    <li key={link.to}>
                      <NavLink end to={link.to} viewTransition>
                        {link.label}
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
      </footer>
    </div>
  )
}

export interface PublicAuthContext {
  authChecked: boolean
  role: AuthRole | undefined
  sessionKey: string | undefined
  userId: string | undefined
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
      if (focusNewHeading()) stopWaiting()
    })
    // A late heading must not take focus from a user who already acted.
    const stopWaiting = () => {
      observer.disconnect()
      window.clearTimeout(timeout)
      document.removeEventListener('pointerdown', stopWaiting, true)
      document.removeEventListener('keydown', stopWaiting, true)
    }
    observer.observe(document.body, { childList: true, subtree: true })
    const timeout = window.setTimeout(stopWaiting, 2_000)
    document.addEventListener('pointerdown', stopWaiting, true)
    document.addEventListener('keydown', stopWaiting, true)
    return stopWaiting
  }, [location.pathname, navigation.state, pageTitle])

  return (
    <>
      <RoutePendingIndicator />
      <Outlet />
    </>
  )
}

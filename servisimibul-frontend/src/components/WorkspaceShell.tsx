import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { BrandLockup, Button } from './design-system'

export function WorkspaceShell({
  accountLabel,
  currentPage,
  email,
  error,
  loggingOut,
  navigation,
  homePath,
  notificationPath,
  onSignOut,
}: {
  accountLabel: string
  currentPage: string
  email: string
  error?: string
  loggingOut: boolean
  navigation: ReactNode
  homePath: string
  notificationPath: string
  onSignOut: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const closeButtonRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLElement>(null)
  const menuButtonRef = useRef<HTMLButtonElement>(null)
  const restoreFocusRef = useRef(true)
  const wasOpenRef = useRef(false)
  function closeMenu(restoreFocus = true) {
    restoreFocusRef.current = restoreFocus
    setMenuOpen(false)
  }

  useEffect(() => {
    if (!menuOpen) {
      if (wasOpenRef.current && restoreFocusRef.current) {
        menuButtonRef.current?.focus()
      }
      wasOpenRef.current = false
      return
    }

    wasOpenRef.current = true
    restoreFocusRef.current = true
    const drawer = drawerRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    const focusableElements = () =>
      Array.from(
        drawer?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      )

    const containFocus = (event: FocusEvent) => {
      if (drawer?.contains(event.target as Node)) return
      closeButtonRef.current?.focus()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        closeMenu()
        return
      }
      if (event.key !== 'Tab') return

      const focusable = focusableElements()
      const first = focusable[0]
      const last = focusable.at(-1)
      if (!first || !last) {
        event.preventDefault()
        drawer?.focus()
        return
      }
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

  return (
    <div className="workspace-shell">
      <a
        aria-hidden={menuOpen || undefined}
        className="skip-link"
        href="#workspace-content"
        tabIndex={menuOpen ? -1 : undefined}
      >
        İçeriğe geç
      </a>
      <header className="workspace-mobile-bar" inert={menuOpen || undefined}>
        <div className="workspace-mobile-context">
          <small>{accountLabel}</small>
          <strong>{currentPage}</strong>
        </div>
        <button
          ref={menuButtonRef}
          className="workspace-menu-toggle"
          type="button"
          aria-controls="workspace-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <span aria-hidden="true" />
          Menü
        </button>
      </header>
      {menuOpen && (
        <button
          className="workspace-sidebar-backdrop"
          type="button"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => closeMenu()}
        />
      )}
      <aside
        ref={drawerRef}
        aria-label={menuOpen ? `${accountLabel} menüsü` : undefined}
        aria-modal={menuOpen || undefined}
        className={`workspace-sidebar${menuOpen ? ' open' : ''}`}
        id="workspace-navigation"
        role={menuOpen ? 'dialog' : undefined}
        tabIndex={menuOpen ? -1 : undefined}
      >
        <div className="workspace-sidebar-heading">
          <Link aria-label="ServisimiBul ana sayfa" to="/" viewTransition>
            <BrandLockup />
          </Link>
          <button
            ref={closeButtonRef}
            className="workspace-sidebar-close"
            type="button"
            onClick={() => closeMenu()}
          >
            Menüyü kapat
          </button>
        </div>
        <div className="workspace-account">
          <span className="workspace-account-mark" aria-hidden="true">
            {email.slice(0, 1).toLocaleUpperCase('tr-TR')}
          </span>
          <span>
            <strong>{accountLabel}</strong>
            <small>{email}</small>
          </span>
        </div>
        <nav
          aria-label={`${accountLabel} menüsü`}
          onClick={(event) => {
            if ((event.target as HTMLElement).closest('a')) closeMenu(false)
          }}
        >
          {navigation}
        </nav>
        <Link className="workspace-home-link" to="/" viewTransition>
          Ana sayfaya dön
        </Link>
        <Button
          className="sidebar-action"
          disabled={loggingOut}
          onClick={onSignOut}
          tone="secondary"
          type="button"
        >
          {loggingOut ? 'Çıkış yapılıyor…' : 'Çıkış yap'}
        </Button>
        {error && (
          <p className="workspace-error" role="alert">
            {error}
          </p>
        )}
      </aside>
      <header className="workspace-topbar" inert={menuOpen || undefined}>
        <nav aria-label="Sayfa yolu">
          <Link to={homePath} viewTransition>
            {accountLabel}
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{currentPage}</span>
        </nav>
        <div className="workspace-topbar-actions">
          <Link to={notificationPath} viewTransition>
            Bildirimler
          </Link>
          <span className="workspace-topbar-account">
            <span className="workspace-account-mark" aria-hidden="true">
              {email.slice(0, 1).toLocaleUpperCase('tr-TR')}
            </span>
            <span>
              <strong>{accountLabel}</strong>
              <small>{email}</small>
            </span>
          </span>
        </div>
      </header>
      <main
        id="workspace-content"
        className="workspace-content"
        inert={menuOpen || undefined}
      >
        <div className="workspace-content-inner">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

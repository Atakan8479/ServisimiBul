import { useEffect, useState, type ReactNode } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { BrandLockup, Button } from './design-system'

export function WorkspaceShell({
  accountLabel,
  email,
  error,
  loggingOut,
  navigation,
  onSignOut,
}: {
  accountLabel: string
  email: string
  error?: string
  loggingOut: boolean
  navigation: ReactNode
  onSignOut: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    if (!menuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [menuOpen])

  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-content">
        İçeriğe geç
      </a>
      <header className="workspace-mobile-bar">
        <Link aria-label="ServisimiBul ana sayfa" to="/" viewTransition>
          <BrandLockup compact />
        </Link>
        <button
          className="workspace-menu-toggle"
          type="button"
          aria-controls="workspace-navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span aria-hidden="true" />
          Menü
        </button>
      </header>
      {menuOpen && (
        <button
          className="workspace-sidebar-backdrop"
          type="button"
          aria-label="Menüyü kapat"
          onClick={() => setMenuOpen(false)}
        />
      )}
      <aside
        className={`workspace-sidebar${menuOpen ? ' open' : ''}`}
        id="workspace-navigation"
      >
        <div className="workspace-sidebar-heading">
          <Link aria-label="ServisimiBul ana sayfa" to="/" viewTransition>
            <BrandLockup />
          </Link>
          <button
            className="workspace-sidebar-close"
            type="button"
            onClick={() => setMenuOpen(false)}
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
            if ((event.target as HTMLElement).closest('a')) setMenuOpen(false)
          }}
        >
          {navigation}
        </nav>
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
      <main id="workspace-content" className="workspace-content">
        <div className="workspace-content-inner">
          <Outlet />
        </div>
      </main>
    </div>
  )
}

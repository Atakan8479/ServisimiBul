import { NavLink, Outlet } from 'react-router-dom'

type WorkspaceKind = 'operator' | 'admin'

export function PublicLayout() {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        İçeriğe geç
      </a>
      <header className="site-header">
        <NavLink className="brand" to="/">
          ServisimiBul
        </NavLink>
        <nav aria-label="Ana menü">
          <NavLink to="/">Ana sayfa</NavLink>
          <NavLink to="/operator">İşletmeci</NavLink>
          <NavLink to="/admin">Yönetim</NavLink>
        </nav>
      </header>
      <main id="main-content" className="page-content">
        <Outlet />
      </main>
    </div>
  )
}

export function OperatorLayout() {
  return <WorkspaceLayout kind="operator" />
}

export function AdminLayout() {
  return <WorkspaceLayout kind="admin" />
}

function WorkspaceLayout({ kind }: { kind: WorkspaceKind }) {
  const title = kind === 'admin' ? 'Yönetim alanı' : 'İşletmeci alanı'

  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-content">
        İçeriğe geç
      </a>
      <aside className="workspace-sidebar">
        <NavLink className="brand" to="/">
          ServisimiBul
        </NavLink>
        <p>{title}</p>
        <nav aria-label={`${title} menüsü`}>
          <NavLink to={`/${kind}`} end>
            Genel bakış
          </NavLink>
        </nav>
      </aside>
      <main id="workspace-content" className="workspace-content">
        <Outlet />
      </main>
    </div>
  )
}

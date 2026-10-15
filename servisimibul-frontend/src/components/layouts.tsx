import { NavLink, Outlet } from 'react-router-dom'

export function PublicLayout() {
  return (
    <div className="app-shell">
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
          <NavLink to="/operator/login" viewTransition>
            İşletmeci girişi
          </NavLink>
          <NavLink to="/admin" viewTransition>
            Yönetim
          </NavLink>
        </nav>
      </header>
      <main id="main-content" className="page-content">
        <Outlet />
      </main>
    </div>
  )
}

export function AdminLayout() {
  return <WorkspaceLayout />
}

function WorkspaceLayout() {
  const title = 'Yönetim alanı'

  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-content">
        İçeriğe geç
      </a>
      <aside className="workspace-sidebar">
        <NavLink className="brand" to="/" viewTransition>
          ServisimiBul
        </NavLink>
        <p>{title}</p>
        <nav aria-label={`${title} menüsü`}>
          <NavLink to="/admin" end viewTransition>
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

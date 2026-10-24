import { useState } from 'react'
import {
  NavLink,
  Outlet,
  useNavigate,
  useRouteLoaderData,
} from 'react-router-dom'
import { ApiError } from '../../api/client'
import { logout, type AuthUser } from '../auth/auth-api'

export function AdminWorkspaceLayout() {
  const user = useRouteLoaderData('admin') as AuthUser
  const navigate = useNavigate()
  const [error, setError] = useState<string>()
  const [loggingOut, setLoggingOut] = useState(false)

  async function signOut() {
    setLoggingOut(true)
    setError(undefined)
    try {
      await logout()
      void navigate('/operator/login', { replace: true })
    } catch (reason) {
      if (reason instanceof ApiError && reason.sessionExpired) {
        void navigate('/operator/login?reason=session', { replace: true })
        return
      }
      setError(
        reason instanceof ApiError
          ? reason.problem.detail
          : 'Çıkış yapılamadı. Lütfen tekrar deneyin.',
      )
      setLoggingOut(false)
    }
  }

  return (
    <div className="workspace-shell">
      <a className="skip-link" href="#workspace-content">
        İçeriğe geç
      </a>
      <aside className="workspace-sidebar">
        <NavLink className="brand" to="/" viewTransition>
          ServisimiBul
        </NavLink>
        <div>
          <p className="workspace-label">Yönetim alanı</p>
          <small>{user.email}</small>
        </div>
        <nav aria-label="Yönetim alanı menüsü">
          <NavLink to="/admin/applications" viewTransition>
            {user.operatorApprovalRequired ? 'Başvurular' : 'İşletmeciler'}
          </NavLink>
          <NavLink to="/admin/schools" viewTransition>
            Okullar
          </NavLink>
          <NavLink to="/admin/tariffs" viewTransition>
            Tarifeler
          </NavLink>
          <NavLink to="/admin/moderation" viewTransition>
            Bildirimler
          </NavLink>
        </nav>
        <button
          className="secondary-button sidebar-action"
          disabled={loggingOut}
          onClick={signOut}
          type="button"
        >
          {loggingOut ? 'Çıkış yapılıyor…' : 'Çıkış yap'}
        </button>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </aside>
      <main id="workspace-content" className="workspace-content">
        <Outlet />
      </main>
    </div>
  )
}

import { useState } from 'react'
import {
  NavLink,
  Outlet,
  useNavigate,
  useRouteLoaderData,
} from 'react-router-dom'
import { ApiError } from '../../api/client'
import { logout, type AuthUser } from '../auth/auth-api'

export function OperatorWorkspaceLayout() {
  const user = useRouteLoaderData('operator') as AuthUser
  const navigate = useNavigate()
  const [error, setError] = useState<string>()
  const [loggingOut, setLoggingOut] = useState(false)
  const canManageResources =
    !user.operatorApprovalRequired || user.approvalStatus === 'APPROVED'

  async function signOut() {
    setLoggingOut(true)
    setError(undefined)
    try {
      await logout()
      void navigate('/operator/login', {
        replace: true,
        viewTransition: typeof document.startViewTransition === 'function',
      })
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
          <p className="workspace-label">İşletmeci alanı</p>
          <small>{user.email}</small>
        </div>
        <nav aria-label="İşletmeci alanı menüsü">
          <NavLink to="/operator" end viewTransition>
            Genel bakış
          </NavLink>
          <NavLink to="/operator/profile" viewTransition>
            {user.operatorApprovalRequired ? 'Profil ve başvuru' : 'Profil'}
          </NavLink>
          {canManageResources && (
            <>
              <NavLink to="/operator/schools" viewTransition>
                Okullar ve kapsam
              </NavLink>
              <NavLink to="/operator/offerings" viewTransition>
                Araçlar ve servisler
              </NavLink>
            </>
          )}
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

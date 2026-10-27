import { useState } from 'react'
import { NavLink, useNavigate, useRouteLoaderData } from 'react-router-dom'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { ApiError } from '../../api/client'
import { logout, type AuthUser } from '../auth/auth-api'
import { NotificationNavLink } from '../notification/NotificationNavLink'

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
    <WorkspaceShell
      accountLabel="Yönetim alanı"
      email={user.email}
      error={error}
      loggingOut={loggingOut}
      onSignOut={signOut}
      navigation={
        <>
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
            İçerik inceleme
          </NavLink>
          <NotificationNavLink to="/admin/notifications" />
        </>
      }
    />
  )
}

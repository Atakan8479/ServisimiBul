import { useState } from 'react'
import {
  NavLink,
  useMatches,
  useNavigate,
  useRouteLoaderData,
} from 'react-router-dom'
import { WorkspaceShell } from '../../components/WorkspaceShell'
import { ApiError } from '../../api/client'
import { logout, type AuthUser } from '../auth/auth-api'
import { NotificationNavLink } from '../notification/NotificationNavLink'
import './operator-workspace.css'

export function OperatorWorkspaceLayout() {
  const user = useRouteLoaderData('operator') as AuthUser
  const navigate = useNavigate()
  const matches = useMatches()
  const [error, setError] = useState<string>()
  const [loggingOut, setLoggingOut] = useState(false)
  const canManageResources =
    !user.operatorApprovalRequired || user.approvalStatus === 'APPROVED'
  const currentPage =
    [...matches]
      .reverse()
      .map(
        (match) =>
          (match.handle as { pageTitle?: string } | undefined)?.pageTitle,
      )
      .find(Boolean) ?? 'Genel bakış'

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
    <WorkspaceShell
      accountLabel="İşletmeci alanı"
      currentPage={currentPage}
      email={user.email}
      error={error}
      homePath="/operator"
      loggingOut={loggingOut}
      notificationPath="/operator/notifications"
      onSignOut={signOut}
      navigation={
        <>
          <NavLink to="/operator" end viewTransition>
            Genel bakış
          </NavLink>
          <NavLink to="/operator/profile" viewTransition>
            {user.operatorApprovalRequired ? 'Profil ve başvuru' : 'Profil'}
          </NavLink>
          <NotificationNavLink to="/operator/notifications" />
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
        </>
      }
    />
  )
}

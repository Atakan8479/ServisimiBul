import { Link, useRouteLoaderData } from 'react-router-dom'
import type { AuthUser } from '../auth/auth-api'

export function OperatorOverviewPage() {
  const user = useRouteLoaderData('operator') as AuthUser
  const canManageResources =
    !user.operatorApprovalRequired || user.approvalStatus === 'APPROVED'

  return (
    <section className="workspace-page">
      <p className="eyebrow">Genel bakış</p>
      <h1>İşletmeci alanı</h1>
      <p className="page-lead">
        {user.operatorApprovalRequired
          ? `${user.email} hesabıyla başvurunuzu ve yetkili hizmet alanınızı yönetin.`
          : `${user.email} hesabıyla pilot profilinizi ve hizmet alanınızı doğrudan yönetin.`}
      </p>
      <div className="action-grid">
        <Link className="action-card" to="/operator/profile" viewTransition>
          <span>01</span>
          <strong>
            {user.operatorApprovalRequired ? 'Profil ve başvuru' : 'Profil'}
          </strong>
          <small>
            {user.operatorApprovalRequired
              ? 'Bilgilerinizi düzenleyin ve başvurunuzu takip edin.'
              : 'Pilot profil bilgilerinizi ve görünürlük tercihinizi yönetin.'}
          </small>
        </Link>
        {canManageResources && (
          <Link className="action-card" to="/operator/schools" viewTransition>
            <span>02</span>
            <strong>Okullar ve kapsam</strong>
            <small>Okulları ve hizmet verdiğiniz mahalleleri seçin.</small>
          </Link>
        )}
      </div>
    </section>
  )
}

import { Link, useRouteLoaderData } from 'react-router-dom'
import type { AuthUser } from '../auth/auth-api'

export function OperatorOverviewPage() {
  const user = useRouteLoaderData('operator') as AuthUser

  return (
    <section className="workspace-page">
      <p className="eyebrow">Genel bakış</p>
      <h1>İşletmeci alanı</h1>
      <p className="page-lead">
        {user.email} hesabıyla profilinizi ve hizmet verdiğiniz okulları
        yönetebilirsiniz.
      </p>
      <div className="action-grid">
        <Link className="action-card" to="/operator/profile" viewTransition>
          <span>01</span>
          <strong>Profil ve başvuru</strong>
          <small>Bilgilerinizi düzenleyin ve başvurunuzu takip edin.</small>
        </Link>
        <Link className="action-card" to="/operator/schools" viewTransition>
          <span>02</span>
          <strong>Okullar ve kapsam</strong>
          <small>Okulları ve hizmet verdiğiniz mahalleleri seçin.</small>
        </Link>
      </div>
    </section>
  )
}

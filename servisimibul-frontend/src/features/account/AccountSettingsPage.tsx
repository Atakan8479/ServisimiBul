import {
  Link,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useRevalidator,
  useRouteError,
} from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  Button,
  SectionShell,
  StatePanel,
  StatusBadge,
  SurfaceCard,
} from '../../components/design-system'
import type { AuthUser } from '../auth/auth-api'
import './account-settings.css'

export function AccountSettingsPage() {
  const user = useLoaderData() as AuthUser
  const isOperator = user.role === 'OPERATOR'

  return (
    <section className="account-settings-page">
      <header className="account-settings-header">
        <div>
          <h1>Hesap ve gizlilik</h1>
          <p>
            Giriş hesabınızı görüntüleyin ve kullanıma açılacak hesap
            işlemlerini takip edin.
          </p>
        </div>
        <StatusBadge tone="info">
          {isOperator ? 'İşletmeci hesabı' : 'Veli hesabı'}
        </StatusBadge>
      </header>

      <SurfaceCard className="account-summary-card">
        <div className="account-summary-heading">
          <span className="account-avatar" aria-hidden="true">
            {user.email.slice(0, 1).toLocaleUpperCase('tr-TR')}
          </span>
          <div>
            <h2>{isOperator ? 'İşletmeci hesabı' : 'Veli hesabı'}</h2>
            <p>Kimlik bilgileri mevcut oturumunuzdan alınır.</p>
          </div>
        </div>
        <dl className="account-facts">
          <div>
            <dt>Hesap e-postası</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>Kullanıcı rolü</dt>
            <dd>{isOperator ? 'İşletmeci' : 'Veli'}</dd>
          </div>
        </dl>
      </SurfaceCard>

      <div className="account-settings-grid">
        <SectionShell
          className="account-settings-section"
          title="Güvenlik"
          description="Giriş bilgileriniz ve oturumlarınız."
        >
          <SurfaceCard className="account-action-card">
            <FutureAction
              description="E-posta değişikliği henüz kullanıma açık değil."
              title="E-posta adresini değiştir"
            />
            <FutureAction
              description="Şifre değiştirme işlemi henüz kullanıma açık değil."
              title="Şifreyi değiştir"
            />
            <FutureAction
              description="Diğer oturumları sonlandırma işlemi henüz kullanıma açık değil."
              title="Tüm cihazlardan çıkış yap"
            />
          </SurfaceCard>
        </SectionShell>

        <SectionShell
          className="account-settings-section"
          title="Gizlilik"
          description="Kişisel veri ve hesap yaşam döngüsü işlemleri."
        >
          <SurfaceCard className="account-action-card">
            <FutureAction
              description="Başvuru kanalı ve hukuki metinler onaylandıktan sonra kullanıma açılacak."
              title="Kişisel veri başvuruları"
            />
            <FutureAction
              description="Hesap devre dışı bırakma politikası henüz onaylanmadı."
              title="Hesabı devre dışı bırak"
            />
            <FutureAction
              description="Hesap ve veri silme başvurusu henüz kullanıma açık değil."
              title="Hesap silme başvurusu"
            />
          </SurfaceCard>
        </SectionShell>
      </div>

      {isOperator && (
        <SurfaceCard className="account-profile-note">
          <div>
            <h2>İşletme profili ayrı yönetilir</h2>
            <p>
              Herkese açık işletme ve iletişim bilgileriniz mevcut profil
              ekranında kalır.
            </p>
          </div>
          <Link
            className="ui-button ui-button-secondary"
            to="/operator/profile"
            viewTransition
          >
            İşletme profiline git
          </Link>
        </SurfaceCard>
      )}

      <Link
        className="account-back-link"
        to={isOperator ? '/operator' : '/demands'}
        viewTransition
      >
        {isOperator ? 'Genel bakışa dön' : 'Talep panosuna dön'}
      </Link>
    </section>
  )
}

export function AccountSettingsRouteError() {
  const error = useRouteError()
  const revalidator = useRevalidator()
  const location = useLocation()
  const operatorRoute = location.pathname.startsWith('/operator/')
  const backPath = operatorRoute ? '/operator' : '/demands'
  const backLabel = operatorRoute ? 'Genel bakışa dön' : 'Talep panosuna dön'

  if (isRouteErrorResponse(error) && error.status === 403) {
    return (
      <div className="account-route-state">
        <StatePanel
          action={
            <Link className="ui-button ui-button-secondary" to={backPath}>
              {backLabel}
            </Link>
          }
          detail="Bu sayfa yalnızca ilgili hesap rolüyle kullanılabilir."
          title="Bu alana erişiminiz yok"
          tone="error"
        />
      </div>
    )
  }

  return (
    <div className="account-route-state">
      <StatePanel
        action={
          <Button
            disabled={revalidator.state !== 'idle'}
            onClick={() => revalidator.revalidate()}
            tone="secondary"
            type="button"
          >
            {revalidator.state === 'idle' ? 'Yeniden dene' : 'Yükleniyor…'}
          </Button>
        }
        detail={
          error instanceof ApiError
            ? error.problem.detail
            : 'Hesap bilgileri yüklenemedi. Lütfen tekrar deneyin.'
        }
        title="Hesap bilgileri yüklenemedi"
        tone="error"
      />
    </div>
  )
}

function FutureAction({
  description,
  title,
}: {
  description: string
  title: string
}) {
  return (
    <div className="account-action-row">
      <div>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
      <div className="account-action-state">
        <Button disabled tone="quiet" type="button">
          Kullanılamıyor
        </Button>
      </div>
    </div>
  )
}

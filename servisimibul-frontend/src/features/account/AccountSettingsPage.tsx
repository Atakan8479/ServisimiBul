import { useEffect, useId, useRef, useState } from 'react'
import {
  Link,
  isRouteErrorResponse,
  useLoaderData,
  useLocation,
  useNavigate,
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
import {
  clearKnownAuthRole,
  deactivateAccount,
  logoutAllDevices,
  type AuthUser,
} from '../auth/auth-api'
import {
  listNotificationPreferences,
  updateNotificationPreference,
  type NotificationPreference,
} from '../notification/notification-api'
import './account-settings.css'

export function AccountSettingsPage() {
  const user = useLoaderData() as AuthUser
  const navigate = useNavigate()
  const isOperator = user.role === 'OPERATOR'
  const loginPath = isOperator ? '/operator/login' : '/parent/login'
  const [signOutAllOpen, setSignOutAllOpen] = useState(false)
  const [signOutAllPending, setSignOutAllPending] = useState(false)
  const [signOutAllError, setSignOutAllError] = useState<string>()
  const [deactivateOpen, setDeactivateOpen] = useState(false)
  const [deactivatePending, setDeactivatePending] = useState(false)
  const [deactivateError, setDeactivateError] = useState<string>()

  async function confirmSignOutAll() {
    setSignOutAllPending(true)
    setSignOutAllError(undefined)
    try {
      await logoutAllDevices()
      void navigate(`${loginPath}?loggedOutAll=true`, { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.sessionExpired) {
        clearKnownAuthRole()
        void navigate(`${loginPath}?reason=session`, { replace: true })
        return
      }
      setSignOutAllPending(false)
      if (error instanceof ApiError) {
        setSignOutAllError(
          error.problem.code === 'RATE_LIMITED'
            ? 'Çok sık denediniz. Biraz sonra tekrar deneyin.'
            : error.problem.detail,
        )
        return
      }
      setSignOutAllError(
        'Bağlantı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.',
      )
    }
  }

  async function confirmDeactivate() {
    setDeactivatePending(true)
    setDeactivateError(undefined)
    try {
      await deactivateAccount()
      void navigate(`${loginPath}?accountDeactivated=true`, { replace: true })
    } catch (error) {
      if (error instanceof ApiError && error.sessionExpired) {
        clearKnownAuthRole()
        void navigate(`${loginPath}?reason=session`, { replace: true })
        return
      }
      setDeactivatePending(false)
      if (error instanceof ApiError) {
        setDeactivateError(
          error.problem.code === 'RATE_LIMITED'
            ? 'Çok sık denediniz. Biraz sonra tekrar deneyin.'
            : error.problem.detail,
        )
        return
      }
      setDeactivateError(
        'Bağlantı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.',
      )
    }
  }

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
            {user.emailChangeAvailable ? (
              <EmailChangeAction
                path={
                  isOperator
                    ? '/operator/account/email'
                    : '/parent/account/email'
                }
              />
            ) : (
              <FutureAction
                description="E-posta teslimi ve gerekli hukuki kararlar tamamlanana kadar bu işlem kullanılamaz."
                title="E-posta adresini değiştir"
              />
            )}
            <PasswordAction
              path={
                isOperator
                  ? '/operator/account/password'
                  : '/parent/account/password'
              }
            />
            <SignOutAllAction
              onRequestConfirm={() => setSignOutAllOpen(true)}
            />
          </SurfaceCard>
        </SectionShell>

        <SectionShell
          className="account-settings-section"
          title="Gizlilik"
          description="Kişisel veri ve hesap yaşam döngüsü işlemleri."
        >
          <SurfaceCard className="account-action-card">
            <PrivacyRequestAction
              path={
                isOperator
                  ? '/operator/privacy/requests/new'
                  : '/parent/privacy/requests/new'
              }
            />
            {user.accountDeactivationAvailable ? (
              <DeactivateAccountAction
                onRequestConfirm={() => setDeactivateOpen(true)}
              />
            ) : (
              <FutureAction
                description="Hesap devre dışı bırakma politikası henüz onaylanmadı."
                title="Hesabı devre dışı bırak"
              />
            )}
            {user.dataRightsRequestsAvailable ? (
              <ErasureRequestAction
                path={
                  isOperator
                    ? '/operator/privacy/erasure'
                    : '/parent/privacy/erasure'
                }
              />
            ) : (
              <FutureAction
                description="Hesap ve veri silme başvurusu henüz kullanıma açık değil."
                title="Hesap silme başvurusu"
              />
            )}
          </SurfaceCard>
        </SectionShell>
      </div>

      {isOperator && <NotificationPreferencesSection />}

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

      {signOutAllOpen && (
        <SignOutAllDialog
          error={signOutAllError}
          onCancel={() => {
            if (signOutAllPending) return
            setSignOutAllOpen(false)
            setSignOutAllError(undefined)
          }}
          onConfirm={confirmSignOutAll}
          pending={signOutAllPending}
        />
      )}

      {deactivateOpen && (
        <DeactivateAccountDialog
          error={deactivateError}
          onCancel={() => {
            if (deactivatePending) return
            setDeactivateOpen(false)
            setDeactivateError(undefined)
          }}
          onConfirm={confirmDeactivate}
          pending={deactivatePending}
        />
      )}
    </section>
  )
}

function EmailChangeAction({ path }: { path: string }) {
  return (
    <div className="account-action-row">
      <div>
        <h3>E-posta adresini değiştir</h3>
        <p>Yeni adresi doğrulamadan mevcut hesap e-postanız değişmez.</p>
      </div>
      <div className="account-action-state">
        <Link className="ui-button ui-button-quiet" to={path} viewTransition>
          Değiştir
        </Link>
      </div>
    </div>
  )
}

function PasswordAction({ path }: { path: string }) {
  return (
    <div className="account-action-row">
      <div>
        <h3>Şifreyi değiştir</h3>
        <p>Mevcut şifrenizi doğrulayarak yeni bir şifre belirleyin.</p>
      </div>
      <div className="account-action-state">
        <Link className="ui-button ui-button-quiet" to={path} viewTransition>
          Değiştir
        </Link>
      </div>
    </div>
  )
}

function PrivacyRequestAction({ path }: { path: string }) {
  return (
    <div className="account-action-row">
      <div>
        <h3>Kişisel veri başvuruları</h3>
        <p>
          Başvuru formunu görüntüleyin. Hukuki onay tamamlanana kadar bilgi
          gönderilemez.
        </p>
      </div>
      <div className="account-action-state">
        <Link className="ui-button ui-button-quiet" to={path} viewTransition>
          Formu görüntüle
        </Link>
      </div>
    </div>
  )
}

function ErasureRequestAction({ path }: { path: string }) {
  return (
    <div className="account-action-row">
      <div>
        <h3>Hesap silme başvurusu</h3>
        <p>İnceleme talebi gönderin ve güncel durumunu takip edin.</p>
      </div>
      <div className="account-action-state">
        <Link className="ui-button ui-button-danger" to={path} viewTransition>
          Başvuruları yönet
        </Link>
      </div>
    </div>
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

const preferenceCopy: Partial<
  Record<NotificationPreference['type'], { title: string; description: string }>
> = {
  DEMAND_CREATED: {
    title: 'Yeni servis talepleri',
    description:
      'Hizmet verdiğiniz okul ve bölgelerde yeni bir talep açıldığında uygulama içi bildirim alın.',
  },
}

function NotificationPreferencesSection() {
  const [preferences, setPreferences] = useState<NotificationPreference[]>()
  const [loadFailed, setLoadFailed] = useState(false)
  const [pendingType, setPendingType] = useState<string>()
  const [error, setError] = useState<string>()

  useEffect(() => {
    const controller = new AbortController()
    listNotificationPreferences(controller.signal)
      .then(setPreferences)
      .catch(() => {
        if (!controller.signal.aborted) setLoadFailed(true)
      })
    return () => controller.abort()
  }, [])

  async function toggle(preference: NotificationPreference) {
    setPendingType(preference.type)
    setError(undefined)
    try {
      const saved = await updateNotificationPreference(
        preference.type,
        !preference.enabled,
      )
      setPreferences((current) =>
        current?.map((item) => (item.type === saved.type ? saved : item)),
      )
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.problem.detail
          : 'Bağlantı kurulamadı. Bağlantınızı kontrol edip tekrar deneyin.',
      )
    } finally {
      setPendingType(undefined)
    }
  }

  if (preferences?.length === 0) return null

  return (
    <SectionShell
      className="account-settings-section"
      title="Bildirimler"
      description="Hesap, güvenlik ve işlem bildirimleri her zaman gönderilir; yalnızca isteğe bağlı bildirimleri kapatabilirsiniz."
    >
      <SurfaceCard className="account-action-card">
        {loadFailed && (
          <p className="account-confirm-error" role="alert">
            Bildirim tercihleri yüklenemedi.
          </p>
        )}
        {!preferences && !loadFailed && <p>Yükleniyor…</p>}
        {preferences?.map((preference) => {
          const copy = preferenceCopy[preference.type]
          if (!copy) return null
          const inputId = `notification-preference-${preference.type}`
          return (
            <div className="account-action-row" key={preference.type}>
              <div>
                <h3>
                  <label htmlFor={inputId}>{copy.title}</label>
                </h3>
                <p id={`${inputId}-description`}>{copy.description}</p>
              </div>
              <div className="account-action-state">
                <input
                  aria-describedby={`${inputId}-description`}
                  checked={preference.enabled}
                  className="account-preference-toggle"
                  disabled={pendingType === preference.type}
                  id={inputId}
                  onChange={() => void toggle(preference)}
                  role="switch"
                  type="checkbox"
                />
              </div>
            </div>
          )
        })}
        {error && (
          <p className="account-confirm-error" role="alert">
            {error}
          </p>
        )}
      </SurfaceCard>
    </SectionShell>
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

function SignOutAllAction({
  onRequestConfirm,
}: {
  onRequestConfirm: () => void
}) {
  return (
    <div className="account-action-row">
      <div>
        <h3>Oturumları sonlandır</h3>
        <p>
          Tüm cihazlardan çıkış yaparak bu cihaz dahil açık olan oturumları
          sonlandırın.
        </p>
      </div>
      <div className="account-action-state">
        <Button onClick={onRequestConfirm} tone="quiet" type="button">
          Oturumları sonlandır
        </Button>
      </div>
    </div>
  )
}

function DeactivateAccountAction({
  onRequestConfirm,
}: {
  onRequestConfirm: () => void
}) {
  return (
    <div className="account-action-row">
      <div>
        <h3>Hesabı devre dışı bırak</h3>
        <p>
          Hesabınıza erişimi durdurur ve tüm oturumları sonlandırır. Hesap
          verilerinizin silinmesi değildir.
        </p>
      </div>
      <div className="account-action-state">
        <Button onClick={onRequestConfirm} tone="danger" type="button">
          Hesabı devre dışı bırak
        </Button>
      </div>
    </div>
  )
}

function DeactivateAccountDialog({
  error,
  onCancel,
  onConfirm,
  pending,
}: {
  error?: string
  onCancel: () => void
  onConfirm: () => void
  pending: boolean
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    dialog?.showModal()
    cancelRef.current?.focus()
    return () => {
      dialog?.close()
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  useEffect(() => {
    if (error) {
      dialogRef.current
        ?.querySelector<HTMLButtonElement>('.ui-button-danger')
        ?.focus()
    }
  }, [error])

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="account-confirm-dialog"
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onCancel()
      }}
      onClose={(event) => {
        const dialog = event.currentTarget
        if (dialog.open) return
        if (pending) dialog.showModal()
        else onCancel()
      }}
      ref={dialogRef}
    >
      <h2 id={titleId}>Hesabı devre dışı bırak</h2>
      <div className="account-confirm-body">
        <p id={descriptionId}>
          Bu işlem bu cihaz dahil, hesabınızla açık olan tüm oturumları
          sonlandırır ve hesabınıza yeniden giriş yapılamaz. Hesap verilerinizin
          silinmesi değildir ve şu an kendi kendine yeniden etkinleştirme
          seçeneği yoktur.
        </p>
        {error && (
          <p className="account-confirm-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="account-confirm-actions">
        <button
          className="ui-button ui-button-secondary"
          disabled={pending}
          onClick={onCancel}
          ref={cancelRef}
          type="button"
        >
          Vazgeç
        </button>
        <Button
          disabled={pending}
          onClick={onConfirm}
          tone="danger"
          type="button"
        >
          {pending ? 'Devre dışı bırakılıyor…' : 'Evet, devre dışı bırak'}
        </Button>
      </div>
    </dialog>
  )
}

function SignOutAllDialog({
  error,
  onCancel,
  onConfirm,
  pending,
}: {
  error?: string
  onCancel: () => void
  onConfirm: () => void
  pending: boolean
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    dialog?.showModal()
    cancelRef.current?.focus()
    return () => {
      dialog?.close()
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className="account-confirm-dialog"
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onCancel()
      }}
      onClose={(event) => {
        // Repeated Escape can close a native dialog without a cancel event.
        const dialog = event.currentTarget
        if (dialog.open) return
        if (pending) dialog.showModal()
        else onCancel()
      }}
      ref={dialogRef}
    >
      <h2 id={titleId}>Tüm cihazlardan çıkış yap</h2>
      <div className="account-confirm-body">
        <p id={descriptionId}>
          Bu işlem bu cihaz dahil, hesabınızla açık olan tüm oturumları
          sonlandırır. Devam etmek için yeniden giriş yapmanız gerekir.
        </p>
        {error && (
          <p className="account-confirm-error" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="account-confirm-actions">
        <button
          className="ui-button ui-button-secondary"
          disabled={pending}
          onClick={onCancel}
          ref={cancelRef}
          type="button"
        >
          Vazgeç
        </button>
        <Button
          disabled={pending}
          onClick={onConfirm}
          tone="danger"
          type="button"
        >
          {pending ? 'Çıkış yapılıyor…' : 'Tüm cihazlardan çıkış yap'}
        </Button>
      </div>
    </dialog>
  )
}

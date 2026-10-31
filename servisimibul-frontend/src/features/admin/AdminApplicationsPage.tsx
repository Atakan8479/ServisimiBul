import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Link,
  useNavigate,
  useParams,
  useRouteLoaderData,
} from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  FormField,
  StatePanel,
  StatusBadge,
} from '../../components/design-system'
import type { AuthUser } from '../auth/auth-api'
import { AdminConfirmDialog } from './AdminConfirmDialog'
import {
  approveApplication,
  getApplication,
  getApplications,
  requestApplicationRevision,
  suspendOperator,
  type ApplicationDetail,
  type ApplicationPage,
  type ApplicationStatus,
} from './admin-api'

type OperatorProfile = ApplicationDetail['profile']

const statusLabels: Record<ApplicationStatus, string> = {
  DRAFT: 'Taslak',
  PENDING: 'İncelemede',
  CHANGES_REQUESTED: 'Düzeltme istendi',
  APPROVED: 'Onaylandı',
}

const statusTones: Record<
  ApplicationStatus,
  'neutral' | 'warning' | 'success'
> = {
  DRAFT: 'neutral',
  PENDING: 'warning',
  CHANGES_REQUESTED: 'warning',
  APPROVED: 'success',
}

const reviewDecisionLabels: Record<
  ApplicationDetail['reviewHistory'][number]['decision'],
  string
> = {
  APPROVED: 'Onaylandı',
  CHANGES_REQUESTED: 'Düzeltme istendi',
  SUSPENDED: 'Askıya alındı',
}

const statusFilters: Array<{
  label: string
  value: ApplicationStatus | undefined
}> = [
  { label: 'Tümü', value: undefined },
  { label: statusLabels.PENDING, value: 'PENDING' },
  { label: statusLabels.CHANGES_REQUESTED, value: 'CHANGES_REQUESTED' },
  { label: statusLabels.APPROVED, value: 'APPROVED' },
  { label: statusLabels.DRAFT, value: 'DRAFT' },
]

export function AdminApplicationsPage() {
  const navigate = useNavigate()
  const user = useRouteLoaderData('admin') as AuthUser
  const approvalRequired = user.operatorApprovalRequired
  const [status, setStatus] = useState<ApplicationStatus | undefined>(
    approvalRequired ? 'PENDING' : undefined,
  )
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<ApplicationPage>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)

  const load = useCallback(() => {
    let active = true
    setLoading(true)
    setError(undefined)
    void getApplications(status, page)
      .then((response) => {
        if (active) setResult(response)
      })
      .catch((reason: unknown) => {
        if (active) handleSession(reason, navigate, setError)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [navigate, page, status])

  useEffect(() => {
    let cleanup: (() => void) | undefined
    const timer = window.setTimeout(() => {
      cleanup = load()
    }, 0)
    return () => {
      window.clearTimeout(timer)
      cleanup?.()
    }
  }, [load])

  return (
    <section className="workspace-page admin-page admin-applications-page">
      <header className="admin-page-header admin-operator-header">
        <p className="admin-eyebrow">Yönetim paneli</p>
        <h1>{approvalRequired ? 'İşletmeci başvuruları' : 'İşletmeciler'}</h1>
        <p>
          {approvalRequired
            ? 'Başvuruları inceleyin ve gerekli düzeltmeleri açıkça iletin.'
            : 'İşletmeci profillerini inceleyin ve hesap durumlarını yönetin.'}
        </p>
      </header>

      <div className="admin-operator-toolbar">
        {approvalRequired && (
          <div
            aria-label="Başvuru durumu"
            className="admin-status-filter"
            role="group"
          >
            {statusFilters.map((filter) => (
              <button
                aria-pressed={status === filter.value}
                key={filter.label}
                onClick={() => {
                  if (status === filter.value) return
                  setLoading(true)
                  setError(undefined)
                  setStatus(filter.value)
                  setPage(0)
                }}
                type="button"
              >
                {filter.label}
              </button>
            ))}
          </div>
        )}
        {result && !loading && !error && (
          <p className="admin-operator-count">{result.totalElements} kayıt</p>
        )}
      </div>

      {error ? (
        <StatePanel
          action={
            <button className="secondary-button" onClick={() => void load()}>
              Tekrar dene
            </button>
          }
          detail={error}
          title="Kayıtlar yüklenemedi"
          tone="error"
        />
      ) : loading ? (
        <StatePanel
          detail="Güncel başvuru kayıtları getiriliyor."
          title="Kayıtlar yükleniyor"
          tone="loading"
        />
      ) : result?.content.length ? (
        <div
          className={`admin-operator-table${
            approvalRequired ? ' admin-operator-table-review' : ''
          }`}
        >
          <div aria-hidden="true" className="admin-operator-columns">
            <span>İşletmeci</span>
            {approvalRequired && <span>Başvuru</span>}
            <span>Görünürlük</span>
            <span>Hesap</span>
            <span>Kayıt</span>
            <span>İşlem</span>
          </div>
          <ul>
            {result.content.map((profile) => (
              <li className="admin-operator-row" key={profile.id}>
                <div className="admin-operator-identity">
                  <OperatorInitials name={profile.businessName} />
                  <div>
                    <h2 id={`operator-${profile.id}`}>
                      {profile.businessName || 'İsimsiz işletme'}
                    </h2>
                    <p>{profile.contactPhone}</p>
                  </div>
                </div>
                <dl>
                  {approvalRequired && (
                    <div>
                      <dt>Başvuru</dt>
                      <dd>
                        <StatusBadge tone={statusTones[profile.approvalStatus]}>
                          {statusLabels[profile.approvalStatus]}
                        </StatusBadge>
                      </dd>
                    </div>
                  )}
                  <div>
                    <dt>Görünürlük</dt>
                    <dd>{visibilityLabel(profile)}</dd>
                  </div>
                  <div>
                    <dt>Hesap</dt>
                    <dd>
                      <AccountBadge active={profile.active} />
                    </dd>
                  </div>
                  <div>
                    <dt>Kayıt</dt>
                    <dd>{formatDay(profile.createdAt)}</dd>
                  </div>
                </dl>
                <Link
                  aria-describedby={`operator-${profile.id}`}
                  className="admin-operator-link"
                  to={`/admin/applications/${profile.id}`}
                  viewTransition
                >
                  {approvalRequired ? 'Başvuruyu incele' : 'Profili incele'}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="empty-state">
          <h2>{status ? 'Bu durumda başvuru yok' : 'Henüz işletmeci yok'}</h2>
          {status && (
            <p>Başka bir durum seçerek listeyi değiştirebilirsiniz.</p>
          )}
        </div>
      )}

      {result && result.totalPages > 1 && (
        <nav className="button-row pagination" aria-label="Sayfalama">
          <button
            className="secondary-button"
            disabled={page === 0}
            onClick={() => {
              setLoading(true)
              setPage((current) => current - 1)
            }}
            type="button"
          >
            Önceki
          </button>
          <span>
            Sayfa {page + 1} / {result.totalPages}
          </span>
          <button
            className="secondary-button"
            disabled={page + 1 >= result.totalPages}
            onClick={() => {
              setLoading(true)
              setPage((current) => current + 1)
            }}
            type="button"
          >
            Sonraki
          </button>
        </nav>
      )}
    </section>
  )
}

export function AdminApplicationDetailPage() {
  const { applicationId } = useParams()
  const navigate = useNavigate()
  const user = useRouteLoaderData('admin') as AuthUser
  const approvalRequired = user.operatorApprovalRequired
  const [detail, setDetail] = useState<ApplicationDetail>()
  const [attempt, setAttempt] = useState(0)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string>()
  const [suspensionReason, setSuspensionReason] = useState('')
  const [suspensionReasonError, setSuspensionReasonError] = useState<string>()
  const [confirmation, setConfirmation] = useState<
    'approve' | 'revision' | 'suspend'
  >()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const feedbackRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!applicationId) return
    let active = true
    void getApplication(applicationId)
      .then((response) => {
        if (active) setDetail(response)
      })
      .catch((failure: unknown) => {
        if (active) handleSession(failure, navigate, setError)
      })
    return () => {
      active = false
    }
  }, [applicationId, attempt, navigate])

  useEffect(() => {
    if (notice || error) feedbackRef.current?.focus()
  }, [error, notice])

  function openRevision(event: FormEvent) {
    event.preventDefault()
    if (!reason.trim()) {
      setReasonError('Düzeltme nedeni zorunludur.')
      return
    }
    setConfirmation('revision')
  }

  async function confirmAction() {
    if (!applicationId) return
    if (confirmation === 'approve') {
      await runAction(
        () => approveApplication(applicationId),
        'Başvuru onaylandı.',
      )
    } else if (confirmation === 'revision') {
      const sent = await runAction(
        () => requestApplicationRevision(applicationId, reason.trim()),
        'Düzeltme talebi gönderildi.',
      )
      if (sent) setReason('')
    } else if (confirmation === 'suspend') {
      const trimmedReason = suspensionReason.trim()
      if (!trimmedReason) {
        setSuspensionReasonError('Askıya alma gerekçesi zorunludur.')
        return
      }
      await runAction(
        () => suspendOperator(applicationId, trimmedReason),
        'İşletmeci askıya alındı.',
      )
    }
  }

  async function runAction(
    action: () => Promise<ApplicationDetail>,
    successMessage: string,
  ) {
    setPending(true)
    setError(undefined)
    setNotice(undefined)
    try {
      setDetail(await action())
      setNotice(successMessage)
      return true
    } catch (failure) {
      handleSession(failure, navigate, setError)
      return false
    } finally {
      setPending(false)
      setConfirmation(undefined)
    }
  }

  const backLabel = approvalRequired ? 'Başvurulara dön' : 'İşletmecilere dön'

  if (!detail && !error) {
    return (
      <StatePanel
        detail="İşletmeci bilgileri ve inceleme geçmişi getiriliyor."
        title="Başvuru yükleniyor"
        tone="loading"
      />
    )
  }

  if (!detail) {
    return (
      <section className="workspace-page admin-page admin-application-detail-page">
        <Link
          className="admin-back-link"
          to="/admin/applications"
          viewTransition
        >
          ← {backLabel}
        </Link>
        <StatePanel
          action={
            <button
              className="secondary-button"
              onClick={() => {
                setError(undefined)
                setAttempt((current) => current + 1)
              }}
              type="button"
            >
              Tekrar dene
            </button>
          }
          detail={error ?? ''}
          title="Başvuru yüklenemedi"
          tone="error"
        />
      </section>
    )
  }

  const { profile, reviewHistory } = detail
  const reviewable = approvalRequired && profile.approvalStatus === 'PENDING'

  return (
    <section className="workspace-page admin-page admin-application-detail-page">
      <Link className="admin-back-link" to="/admin/applications" viewTransition>
        ← {backLabel}
      </Link>
      <header className="admin-page-header admin-operator-header admin-detail-header">
        <div>
          <p className="admin-eyebrow">İşletmeci ayrıntısı</p>
          <h1>{profile.businessName || 'İsimsiz işletme'}</h1>
          <p>
            Profil bilgilerini, başvuru durumunu ve inceleme geçmişini yönetin.
          </p>
        </div>
        <div className="admin-detail-badges">
          {approvalRequired && (
            <StatusBadge tone={statusTones[profile.approvalStatus]}>
              {statusLabels[profile.approvalStatus]}
            </StatusBadge>
          )}
          <AccountBadge active={profile.active} />
        </div>
      </header>

      {(error || notice) && (
        <div ref={feedbackRef} tabIndex={-1}>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          {notice && (
            <div className="status-banner success" role="status">
              {notice}
            </div>
          )}
        </div>
      )}

      <div className="admin-detail-layout">
        <div className="admin-detail-main">
          <article className="admin-detail-card">
            <div className="admin-detail-card-title">
              <OperatorInitials name={profile.businessName} />
              <div>
                <h2>Profil bilgileri</h2>
                <p>İşletmecinin kaydettiği bilgiler</p>
              </div>
            </div>
            <dl className="admin-detail-facts">
              <div>
                <dt>Telefon</dt>
                <dd>{profile.contactPhone}</dd>
              </div>
              <div>
                <dt>Herkese açık</dt>
                <dd>{profile.publiclyVisible ? 'Evet' : 'Hayır'}</dd>
              </div>
              <div>
                <dt>Oluşturulma</dt>
                <dd>{formatDay(profile.createdAt)}</dd>
              </div>
              <div>
                <dt>Son güncelleme</dt>
                <dd>{formatDay(profile.updatedAt)}</dd>
              </div>
              <div className="admin-detail-fact-wide">
                <dt>Açıklama</dt>
                <dd>{profile.description || 'Belirtilmedi'}</dd>
              </div>
            </dl>
          </article>

          <section className="admin-detail-card">
            <p className="admin-eyebrow">Hesap geçmişi</p>
            <h2>İnceleme geçmişi</h2>
            {reviewHistory.length ? (
              <ol className="admin-review-timeline">
                {reviewHistory.map((review) => (
                  <li key={review.id}>
                    <span
                      aria-hidden="true"
                      className={`admin-review-mark${
                        review.decision === 'APPROVED'
                          ? ' admin-review-mark-approved'
                          : ''
                      }`}
                    >
                      {review.decision === 'APPROVED' ? '✓' : '!'}
                    </span>
                    <div>
                      <strong>{reviewDecisionLabels[review.decision]}</strong>
                      {review.reason && <p>{review.reason}</p>}
                      <small>{formatDate(review.reviewedAt)}</small>
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="admin-detail-muted">
                Henüz bir inceleme kaydı yok.
              </p>
            )}
          </section>
        </div>

        <aside
          aria-labelledby="admin-actions-title"
          className="admin-detail-card admin-detail-actions"
        >
          <p className="admin-eyebrow">Yönetim aksiyonları</p>
          <h2 id="admin-actions-title">Hesap durumunu yönetin</h2>

          {reviewable && (
            <div className="admin-review-actions">
              <h3>Başvuruyu sonuçlandır</h3>
              <button
                className="primary-button"
                disabled={pending}
                onClick={() => setConfirmation('approve')}
                type="button"
              >
                Başvuruyu onayla
              </button>
              <form className="form-stack" onSubmit={openRevision}>
                <FormField
                  error={reasonError}
                  htmlFor="revision-reason"
                  label="Düzeltme nedeni"
                >
                  <textarea
                    onChange={(event) => {
                      setReason(event.target.value)
                      setReasonError(undefined)
                    }}
                    rows={4}
                    value={reason}
                  />
                </FormField>
                <button
                  className="secondary-button"
                  disabled={pending}
                  type="submit"
                >
                  Düzeltme iste
                </button>
              </form>
            </div>
          )}

          {profile.active ? (
            <button
              className="admin-danger-solid"
              disabled={pending}
              onClick={() => setConfirmation('suspend')}
              type="button"
            >
              İşletmeciyi askıya al
            </button>
          ) : (
            <p className="admin-detail-muted">
              Bu hesap askıda. Hesap girişe kapalı ve profil aramalarda
              görünmüyor.
            </p>
          )}

          {!approvalRequired && (
            <p className="admin-detail-note">
              Bu ortamda profilin yayımlanması için yönetici onayı zorunlu
              değildir.
            </p>
          )}
        </aside>
      </div>

      {confirmation === 'approve' && (
        <AdminConfirmDialog
          confirmLabel="Evet, onayla"
          onCancel={() => setConfirmation(undefined)}
          onConfirm={() => void confirmAction()}
          pending={pending}
          title="Başvuru onaylansın mı?"
        >
          <p>
            Yayın koşulları sağlandığında profil aramalarda görünmeye başlar.
          </p>
        </AdminConfirmDialog>
      )}
      {confirmation === 'revision' && (
        <AdminConfirmDialog
          confirmLabel="Talebi gönder"
          onCancel={() => setConfirmation(undefined)}
          onConfirm={() => void confirmAction()}
          pending={pending}
          title="Düzeltme talebi gönderilsin mi?"
        >
          <p>Bu gerekçe işletmeciye iletilir ve inceleme geçmişine eklenir:</p>
          <blockquote>{reason.trim()}</blockquote>
        </AdminConfirmDialog>
      )}
      {confirmation === 'suspend' && (
        <AdminConfirmDialog
          confirmLabel="Askıya al"
          danger
          onCancel={() => setConfirmation(undefined)}
          onConfirm={() => void confirmAction()}
          pending={pending}
          title="İşletmeci askıya alınsın mı?"
        >
          <p>
            Hesap girişe kapanır, açık oturumları sonlandırılır ve profil
            aramalardan kalkar. Bu işlem bu panelden geri alınamaz.
          </p>
          <FormField
            error={suspensionReasonError}
            htmlFor="suspension-reason"
            label="Askıya alma gerekçesi"
          >
            <textarea
              disabled={pending}
              onChange={(event) => {
                setSuspensionReason(event.target.value)
                setSuspensionReasonError(undefined)
              }}
              rows={4}
              value={suspensionReason}
            />
          </FormField>
        </AdminConfirmDialog>
      )}
    </section>
  )
}

function OperatorInitials({ name }: { name: string | null }) {
  const initials = (name ?? '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word.charAt(0).toLocaleUpperCase('tr-TR'))
    .join('')
  return (
    <span aria-hidden="true" className="admin-operator-initials">
      {initials || '–'}
    </span>
  )
}

function AccountBadge({ active }: { active: boolean }) {
  return active ? (
    <StatusBadge tone="success">Aktif</StatusBadge>
  ) : (
    <StatusBadge tone="danger">Askıda</StatusBadge>
  )
}

function visibilityLabel(profile: OperatorProfile) {
  return profile.publiclyVisible ? 'Herkese açık' : 'Gizli'
}

function handleSession(
  error: unknown,
  navigate: ReturnType<typeof useNavigate>,
  setError: (message: string) => void,
) {
  if (error instanceof ApiError && error.sessionExpired) {
    void navigate('/operator/login?reason=session', { replace: true })
    return
  }
  setError(
    error instanceof ApiError
      ? error.problem.detail
      : 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(
    new Date(value),
  )
}

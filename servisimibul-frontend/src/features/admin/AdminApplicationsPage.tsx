import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
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

const statusLabels: Record<ApplicationStatus, string> = {
  DRAFT: 'Taslak',
  PENDING: 'İncelemede',
  CHANGES_REQUESTED: 'Düzeltme istendi',
  APPROVED: 'Onaylandı',
}

export function AdminApplicationsPage() {
  const navigate = useNavigate()
  const [status, setStatus] = useState<ApplicationStatus>('PENDING')
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<ApplicationPage>()
  const [error, setError] = useState<string>()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
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

  return (
    <section className="workspace-page">
      <p className="eyebrow">Başvuru yönetimi</p>
      <h1>İşletmeci başvuruları</h1>
      <p className="page-lead">
        Başvuruları durumuna göre inceleyin ve gerekli işlemi uygulayın.
      </p>

      <label className="form-field application-filter">
        <span>Başvuru durumu</span>
        <select
          onChange={(event) => {
            setLoading(true)
            setError(undefined)
            setStatus(event.target.value as ApplicationStatus)
            setPage(0)
          }}
          value={status}
        >
          {Object.entries(statusLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {loading ? (
        <InlineLoading label="Başvurular yükleniyor" />
      ) : result?.content.length ? (
        <div className="school-list">
          {result.content.map((profile) => (
            <article className="school-card" key={profile.id}>
              <div className="school-title-row">
                <div>
                  <h2>{profile.businessName || 'İsimsiz işletme'}</h2>
                  <p>{profile.contactPhone}</p>
                </div>
                <span className="status-pill neutral">
                  {statusLabels[profile.approvalStatus]}
                </span>
              </div>
              <Link to={`/admin/applications/${profile.id}`} viewTransition>
                Başvuruyu incele
              </Link>
            </article>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <h2>Bu durumda başvuru yok</h2>
          <p>Başka bir durum seçerek listeyi değiştirebilirsiniz.</p>
        </div>
      )}

      {result && result.totalPages > 1 && (
        <div className="button-row pagination" aria-label="Sayfalama">
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
        </div>
      )}
    </section>
  )
}

export function AdminApplicationDetailPage() {
  const { applicationId } = useParams()
  const navigate = useNavigate()
  const [detail, setDetail] = useState<ApplicationDetail>()
  const [reason, setReason] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()

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
  }, [applicationId, navigate])

  async function approve() {
    if (
      !applicationId ||
      !window.confirm('Bu işletmeci başvurusu onaylansın mı?')
    ) {
      return
    }
    await runAction(
      () => approveApplication(applicationId),
      'Başvuru onaylandı.',
    )
  }

  async function requestRevision(event: FormEvent) {
    event.preventDefault()
    const trimmedReason = reason.trim()
    if (!applicationId || !trimmedReason) {
      setError('Düzeltme nedeni zorunludur.')
      return
    }
    if (!window.confirm('Düzeltme talebi işletmeciye gönderilsin mi?')) return
    await runAction(
      () => requestApplicationRevision(applicationId, trimmedReason),
      'Düzeltme talebi gönderildi.',
    )
    setReason('')
  }

  async function suspend() {
    if (
      !applicationId ||
      !window.confirm('Bu işletmecinin hesabı askıya alınsın mı?')
    ) {
      return
    }
    await runAction(
      () => suspendOperator(applicationId),
      'İşletmeci askıya alındı.',
    )
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
    } catch (failure) {
      handleSession(failure, navigate, setError)
    } finally {
      setPending(false)
    }
  }

  if (!detail && !error) return <InlineLoading label="Başvuru yükleniyor" />

  const profile = detail?.profile
  return (
    <section className="workspace-page">
      <Link to="/admin/applications" viewTransition>
        ← Başvurulara dön
      </Link>
      <p className="eyebrow">Başvuru detayı</p>
      <h1>{profile?.businessName || 'İsimsiz işletme'}</h1>

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

      {profile && (
        <>
          <article className="form-card compact-card application-detail">
            <div className="school-title-row">
              <h2>Profil bilgileri</h2>
              <span className="status-pill neutral">
                {statusLabels[profile.approvalStatus]}
              </span>
            </div>
            <dl className="detail-list">
              <div>
                <dt>Telefon</dt>
                <dd>{profile.contactPhone}</dd>
              </div>
              <div>
                <dt>Açıklama</dt>
                <dd>{profile.description || 'Belirtilmedi'}</dd>
              </div>
              <div>
                <dt>Herkese açık</dt>
                <dd>{profile.publiclyVisible ? 'Evet' : 'Hayır'}</dd>
              </div>
              <div>
                <dt>Hesap</dt>
                <dd>{profile.active ? 'Aktif' : 'Askıda'}</dd>
              </div>
            </dl>
          </article>

          {profile.approvalStatus === 'PENDING' && (
            <section className="form-card compact-card form-stack">
              <h2>Başvuruyu sonuçlandır</h2>
              <button
                className="primary-button"
                disabled={pending}
                onClick={approve}
                type="button"
              >
                Başvuruyu onayla
              </button>
              <form className="form-stack" onSubmit={requestRevision}>
                <label className="form-field">
                  <span>Düzeltme nedeni</span>
                  <textarea
                    onChange={(event) => setReason(event.target.value)}
                    rows={4}
                    value={reason}
                  />
                </label>
                <button
                  className="secondary-button"
                  disabled={pending}
                  type="submit"
                >
                  Düzeltme iste
                </button>
              </form>
            </section>
          )}

          {profile.active && profile.approvalStatus === 'APPROVED' && (
            <button
              className="danger-button admin-danger-action"
              disabled={pending}
              onClick={suspend}
              type="button"
            >
              İşletmeciyi askıya al
            </button>
          )}

          <section className="form-card compact-card">
            <h2>İnceleme geçmişi</h2>
            {detail.reviewHistory.length ? (
              <ol className="review-list">
                {detail.reviewHistory.map((review) => (
                  <li key={review.id}>
                    <strong>
                      {review.decision === 'APPROVED'
                        ? 'Onaylandı'
                        : 'Düzeltme istendi'}
                    </strong>
                    {review.reason && <p>{review.reason}</p>}
                    <small>{formatDate(review.reviewedAt)}</small>
                  </li>
                ))}
              </ol>
            ) : (
              <p>Henüz bir inceleme kaydı yok.</p>
            )}
          </section>
        </>
      )}
    </section>
  )
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

function InlineLoading({ label }: { label: string }) {
  return (
    <div className="inline-loading" aria-busy="true" aria-live="polite">
      <span className="loading-dot" aria-hidden="true" />
      {label}
    </div>
  )
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

import { useEffect, useId, useState, type FormEvent } from 'react'
import { Link, useLoaderData, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  Button,
  StatePanel,
  StatusBadge,
  SurfaceCard,
} from '../../components/design-system'
import { clearKnownAuthRole, type AuthUser } from '../auth/auth-api'
import {
  listDataRightsRequests,
  submitErasureRequest,
  type DataRightsRequest,
  type DataRightsRequestStatus,
} from './data-rights-api'
import './erasure-request.css'

const statusCopy: Record<
  DataRightsRequestStatus,
  {
    label: string
    detail: string
    tone: 'info' | 'warning' | 'success' | 'danger'
  }
> = {
  RECEIVED: {
    label: 'Alındı',
    detail: 'Talebiniz kaydedildi ve inceleme sırasına alındı.',
    tone: 'info',
  },
  UNDER_REVIEW: {
    label: 'İnceleniyor',
    detail:
      'Hesabınız ve ilişkili kayıtlar yetkili ekip tarafından inceleniyor.',
    tone: 'info',
  },
  AWAITING_VERIFICATION: {
    label: 'Ek doğrulama bekleniyor',
    detail:
      'İncelemeye devam edilebilmesi için ek kimlik doğrulaması gerekiyor.',
    tone: 'warning',
  },
  RESPONDED: {
    label: 'Yanıtlandı',
    detail: 'İnceleme sonucu kayıt altına alındı.',
    tone: 'success',
  },
  PARTIALLY_RESPONDED: {
    label: 'Kısmen yanıtlandı',
    detail:
      'Talebin bir bölümü sonuçlandırıldı; bazı kayıtlar kapsam dışında kaldı.',
    tone: 'warning',
  },
  REJECTED: {
    label: 'Reddedildi',
    detail: 'Talep inceleme sonucunda kabul edilmedi.',
    tone: 'danger',
  },
}

export function ErasureRequestPage() {
  const user = useLoaderData() as AuthUser
  const navigate = useNavigate()
  const operator = user.role === 'OPERATOR'
  const accountPath = operator ? '/operator/account' : '/parent/account'
  const loginPath = operator ? '/operator/login' : '/parent/login'
  const [requests, setRequests] = useState<DataRightsRequest[]>()
  const [loadError, setLoadError] = useState<string>()
  const [reloadKey, setReloadKey] = useState(0)
  const [details, setDetails] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string>()
  const [receiptId, setReceiptId] = useState<string>()
  const detailsHintId = useId()

  useEffect(() => {
    if (!user.dataRightsRequestsAvailable) return
    const controller = new AbortController()
    listDataRightsRequests(controller.signal)
      .then((items) =>
        setRequests(items.filter((item) => item.type === 'ERASURE')),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted) return
        setLoadError(
          error instanceof ApiError
            ? error.problem.detail
            : 'Başvurular yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
        )
      })
    return () => controller.abort()
  }, [reloadKey, user.dataRightsRequestsAvailable])

  if (!user.dataRightsRequestsAvailable) {
    return (
      <section className="erasure-page">
        <header className="erasure-page-header">
          <h1>Hesap silme başvurusu</h1>
          <p>Bu işlem hesabınızı veya verilerinizi hemen silmez.</p>
        </header>
        <StatePanel
          detail="Başvuru kanalı ve saklama kuralları onaylanmadan hesap silme başvurusu gönderilemez."
          title="Başvuru gönderimi henüz kullanılamıyor"
          tone="neutral"
        />
        <BackLink path={accountPath} />
      </section>
    )
  }

  const openRequest = requests?.find((request) => !request.closedAt)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setSubmitError(undefined)
    try {
      const request = await submitErasureRequest(details)
      setRequests((current) => [
        request,
        ...(current ?? []).filter((item) => item.id !== request.id),
      ])
      setDetails('')
      setReceiptId(request.id)
    } catch (error) {
      if (error instanceof ApiError && error.sessionExpired) {
        clearKnownAuthRole()
        void navigate(`${loginPath}?reason=session`, { replace: true })
        return
      }
      setSubmitError(
        error instanceof ApiError
          ? error.problem.detail
          : 'Başvuru gönderilemedi. Bağlantınızı kontrol edip tekrar deneyin.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section className="erasure-page">
      <header className="erasure-page-header">
        <h1>Hesap silme başvurusu</h1>
        <p>
          Başvurunuz incelemeye alınır. Bu form hesabınızı veya verilerinizi
          hemen silmez ve belirli bir sonucu garanti etmez.
        </p>
      </header>
      <div className="erasure-layout">
        <div className="erasure-main-column">
          {receiptId && (
            <StatePanel
              detail={`Başvuru numaranız: ${receiptId}`}
              title="Başvurunuz kaydedildi"
              tone="neutral"
            />
          )}
          {!openRequest && (
            <SurfaceCard className="erasure-form-card">
              <div>
                <h2>Yeni başvuru</h2>
                <p>
                  İnceleme için gerekli kısa açıklamayı yazın. Kimlik numarası,
                  sağlık bilgisi veya öğrenci bilgisi eklemeyin.
                </p>
              </div>
              <form onSubmit={submit}>
                <label htmlFor="erasure-details">Başvuru açıklaması</label>
                <textarea
                  aria-describedby={detailsHintId}
                  disabled={submitting}
                  id="erasure-details"
                  maxLength={2000}
                  onChange={(event) => setDetails(event.target.value)}
                  required
                  rows={6}
                  value={details}
                />
                <div className="erasure-form-meta" id={detailsHintId}>
                  <span>En fazla 2.000 karakter</span>
                  <span>{details.length}/2.000</span>
                </div>
                {submitError && (
                  <p className="erasure-error" role="alert">
                    {submitError}
                  </p>
                )}
                <Button disabled={submitting || !details.trim()} type="submit">
                  {submitting ? 'Gönderiliyor…' : 'İnceleme talebi gönder'}
                </Button>
              </form>
            </SurfaceCard>
          )}
          {openRequest && (
            <p className="erasure-open-note">
              Açık başvurunuz sonuçlanana kadar yeni bir hesap silme başvurusu
              oluşturamazsınız.
            </p>
          )}
        </div>
        <section
          className="erasure-history"
          aria-labelledby="erasure-history-title"
        >
          <div className="erasure-history-heading">
            <div>
              <h2 id="erasure-history-title">Başvuru durumu</h2>
              <p>En yeni başvuru önce gösterilir.</p>
            </div>
            {loadError && (
              <Button
                onClick={() => {
                  setLoadError(undefined)
                  setReloadKey((current) => current + 1)
                }}
                tone="secondary"
                type="button"
              >
                Yeniden dene
              </Button>
            )}
          </div>
          {!requests && !loadError && <p aria-live="polite">Yükleniyor…</p>}
          {loadError && (
            <p className="erasure-error" role="alert">
              {loadError}
            </p>
          )}
          {requests?.length === 0 && (
            <p className="erasure-empty">Henüz hesap silme başvurunuz yok.</p>
          )}
          {requests?.map((request) => (
            <RequestStatus key={request.id} request={request} />
          ))}
        </section>
      </div>
      <BackLink path={accountPath} />
    </section>
  )
}

function RequestStatus({ request }: { request: DataRightsRequest }) {
  const copy = statusCopy[request.status]
  const received = new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'long',
    timeStyle: 'short',
  }).format(new Date(request.receivedAt))
  return (
    <SurfaceCard className="erasure-status-card">
      <div className="erasure-status-topline">
        <StatusBadge tone={copy.tone}>{copy.label}</StatusBadge>
        <time dateTime={request.receivedAt}>{received}</time>
      </div>
      <p>{copy.detail}</p>
      <dl>
        <div>
          <dt>Başvuru numarası</dt>
          <dd>{request.id}</dd>
        </div>
      </dl>
    </SurfaceCard>
  )
}

function BackLink({ path }: { path: string }) {
  return (
    <Link className="erasure-back-link" to={path} viewTransition>
      Hesap ve gizlilik sayfasına dön
    </Link>
  )
}

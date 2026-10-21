import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { ApiError } from '../../api/client'
import { currentUser } from '../auth/auth-api'
import {
  getDemand,
  joinDemand,
  updateDemandSupport,
  withdrawDemandSupport,
  type Demand,
  type SupportValues,
} from './demand-api'
import { reasonLabel } from './demand-labels'
import { DemandSupportForm } from './DemandSupportForm'
import { DemandComments } from './DemandComments'

type SupportMode = 'join' | 'edit' | 'reactivate'

export function DemandDetailPage() {
  const { demandId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [demand, setDemand] = useState<Demand>()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const [supportMode, setSupportMode] = useState<SupportMode>()
  const [actionError, setActionError] = useState<string>()
  const [notice, setNotice] = useState<string | undefined>(
    (location.state as { notice?: string } | null)?.notice,
  )
  const [withdrawing, setWithdrawing] = useState(false)
  const requestVersion = useRef(0)
  const resumeHandled = useRef(false)

  const loadDemand = useCallback(async () => {
    if (!demandId) return
    const request = ++requestVersion.current
    setLoading(true)
    setLoadError(undefined)
    try {
      const result = await getDemand(demandId)
      if (request === requestVersion.current) setDemand(result)
    } catch (error) {
      if (request !== requestVersion.current) return
      setDemand(undefined)
      setLoadError(
        error instanceof ApiError && error.problem.status === 404
          ? 'Bu talep bulunamadı veya artık görüntülenemiyor.'
          : 'Talep ayrıntıları yüklenemedi. Tekrar deneyin.',
      )
    } finally {
      if (request === requestVersion.current) setLoading(false)
    }
  }, [demandId])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDemand(), 0)
    return () => {
      window.clearTimeout(timer)
      requestVersion.current += 1
    }
  }, [loadDemand])

  useEffect(() => {
    if (
      loading ||
      !demand ||
      searchParams.get('action') !== 'support' ||
      resumeHandled.current
    ) {
      return
    }
    resumeHandled.current = true
    setSearchParams({}, { replace: true })
    void beginSupport()
    // The resume action is deliberately consumed only once after login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demand, loading, searchParams, setSearchParams])

  function loginReturnPath() {
    return `${location.pathname}?action=support`
  }

  function redirectToLogin(sessionExpired = false) {
    const reason = sessionExpired ? '&reason=session' : ''
    void navigate(
      `/operator/login?next=${encodeURIComponent(loginReturnPath())}${reason}`,
    )
  }

  async function beginSupport(mode?: SupportMode) {
    setActionError(undefined)
    setNotice(undefined)
    try {
      const user = await currentUser()
      if (user.role !== 'PARENT') {
        setActionError(
          'Talep desteği yalnızca doğrulanmış veli hesabıyla yönetilebilir.',
        )
        return
      }
      const support = demand?.currentUserSupport
      setSupportMode(
        mode ??
          (support?.status === 'ACTIVE'
            ? 'edit'
            : support?.status === 'WITHDRAWN'
              ? 'reactivate'
              : 'join'),
      )
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 401) {
        redirectToLogin(error.sessionExpired)
        return
      }
      setActionError('Oturum bilgisi kontrol edilemedi. Tekrar deneyin.')
    }
  }

  async function submitSupport(values: SupportValues) {
    if (!demandId || !supportMode) return
    setActionError(undefined)
    try {
      const result =
        supportMode === 'edit'
          ? await updateDemandSupport(demandId, values)
          : await joinDemand(demandId, values)
      setDemand(result)
      setSupportMode(undefined)
      setNotice(
        supportMode === 'edit'
          ? 'Destek tercihleriniz güncellendi.'
          : supportMode === 'reactivate'
            ? 'Desteğiniz yeniden etkinleştirildi.'
            : 'Desteğiniz talebe eklendi.',
      )
    } catch (error) {
      handleMutationError(error, 'Desteğiniz kaydedilemedi. Tekrar deneyin.')
    }
  }

  async function withdrawSupport() {
    if (!demandId) return
    setWithdrawing(true)
    setActionError(undefined)
    setNotice(undefined)
    try {
      await withdrawDemandSupport(demandId)
      await loadDemand()
      setSupportMode(undefined)
      setNotice(
        'Desteğiniz geri çekildi. İsterseniz daha sonra yeniden katılabilirsiniz.',
      )
    } catch (error) {
      handleMutationError(error, 'Desteğiniz geri çekilemedi. Tekrar deneyin.')
    } finally {
      setWithdrawing(false)
    }
  }

  function handleMutationError(error: unknown, fallback: string) {
    if (error instanceof ApiError && error.problem.status === 401) {
      redirectToLogin(true)
      return
    }
    setActionError(error instanceof ApiError ? error.problem.detail : fallback)
  }

  if (loading) {
    return (
      <section className="demand-detail-page" aria-busy="true">
        <div className="demand-list-skeleton" role="status">
          <span>Talep ayrıntıları yükleniyor…</span>
          <div aria-hidden="true">
            <i />
            <i />
          </div>
        </div>
      </section>
    )
  }

  if (loadError || !demand) {
    return (
      <section className="demand-detail-page">
        <h1>Talep ayrıntısı</h1>
        <div className="demand-load-error" role="alert">
          <p>{loadError ?? 'Talep görüntülenemiyor.'}</p>
          <button
            className="secondary-button"
            type="button"
            onClick={() => void loadDemand()}
          >
            Tekrar dene
          </button>
        </div>
        <Link className="text-link" to="/demands">
          Talep panosuna dön
        </Link>
      </section>
    )
  }

  const activeReasons = demand.reasonCounts.filter((item) => item.count > 0)
  const activeSupport = demand.currentUserSupport?.status === 'ACTIVE'
  const withdrawnSupport = demand.currentUserSupport?.status === 'WITHDRAWN'
  const open = demand.status === 'OPEN'
  const initialValues = demand.currentUserSupport
    ? {
        needsMorning: demand.currentUserSupport.needsMorning,
        needsAfternoon: demand.currentUserSupport.needsAfternoon,
        reasons: demand.currentUserSupport.reasons,
      }
    : undefined

  return (
    <section className="demand-detail-page">
      <Link className="back-link" to="/demands" viewTransition>
        ← Talep panosuna dön
      </Link>
      <header className="demand-detail-header">
        <div>
          <span className="eyebrow">{demand.academicYear} eğitim yılı</span>
          <h1>{demand.school.name}</h1>
          <p>
            {demand.neighborhood.provinceName} ·{' '}
            {demand.neighborhood.districtName} · {demand.neighborhood.name}
          </p>
        </div>
        <span className={`status-pill ${open ? 'success' : 'neutral'}`}>
          {open ? 'Açık talep' : 'Katılıma kapalı'}
        </span>
      </header>

      {notice && (
        <div className="status-banner success" role="status">
          {notice}
        </div>
      )}

      <div className="demand-detail-grid">
        <section
          className="demand-detail-card"
          aria-labelledby="demand-count-title"
        >
          <h2 id="demand-count-title">Toplu ihtiyaç görünümü</h2>
          <p>
            Bu sayılar yalnızca etkin, doğrulanmış veli hesaplarının anonim
            desteklerini gösterir.
          </p>
          <dl className="demand-counts prominent">
            <div>
              <dt>Destekleyen veli</dt>
              <dd>{demand.supporterCount}</dd>
            </div>
            <div>
              <dt>Sabah</dt>
              <dd>{demand.morningCount}</dd>
            </div>
            <div>
              <dt>Öğleden sonra</dt>
              <dd>{demand.afternoonCount}</dd>
            </div>
          </dl>
        </section>

        <section
          className="demand-detail-card"
          aria-labelledby="demand-reasons-title"
        >
          <h2 id="demand-reasons-title">Paylaşılan ihtiyaçlar</h2>
          {activeReasons.length > 0 ? (
            <ul className="demand-reason-list">
              {activeReasons.map((item) => (
                <li key={item.reason}>
                  <span>{reasonLabel(item.reason)}</span>
                  <strong>{item.count}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>Henüz toplu neden verisi bulunmuyor.</p>
          )}
        </section>
      </div>

      <section className="demand-support-panel" aria-labelledby="support-title">
        <div className="section-heading">
          <div>
            <h2 id="support-title">Sizin desteğiniz</h2>
            <p>
              Öğrenci adı ve açık adres istenmez. Tercihleriniz yalnızca toplu
              sayılara katılır.
            </p>
          </div>
          {activeSupport && (
            <span className="status-pill success">Destekliyorsunuz</span>
          )}
          {withdrawnSupport && (
            <span className="status-pill neutral">Geri çekildi</span>
          )}
        </div>

        {!open && (
          <div className="status-banner neutral">
            Bu talep yeni destek ve güncellemelere kapalıdır.
          </div>
        )}

        {open && !supportMode && (
          <div className="button-row demand-support-actions">
            <button
              className="primary-button"
              type="button"
              onClick={() => void beginSupport()}
            >
              {activeSupport
                ? 'Desteğimi düzenle'
                : withdrawnSupport
                  ? 'Desteğimi yeniden etkinleştir'
                  : 'Benim de ihtiyacım var'}
            </button>
            {activeSupport && (
              <button
                className="danger-button"
                disabled={withdrawing}
                type="button"
                onClick={() => void withdrawSupport()}
              >
                {withdrawing ? 'Geri çekiliyor…' : 'Desteğimi geri çek'}
              </button>
            )}
          </div>
        )}

        {open && supportMode && (
          <DemandSupportForm
            initialValues={initialValues}
            submitLabel={
              supportMode === 'edit'
                ? 'Tercihlerimi kaydet'
                : supportMode === 'reactivate'
                  ? 'Desteğimi yeniden etkinleştir'
                  : 'Talebe katıl'
            }
            busyLabel="Kaydediliyor…"
            onCancel={() => setSupportMode(undefined)}
            onSubmit={submitSupport}
          />
        )}

        {actionError && (
          <div className="form-error" role="alert">
            {actionError}
          </div>
        )}
      </section>

      <DemandComments
        demandId={demand.id}
        open={open}
        parentHasActiveSupport={activeSupport}
      />
    </section>
  )
}

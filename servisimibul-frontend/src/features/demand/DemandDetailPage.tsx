import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom'
import { ApiError } from '../../api/client'
import { StatusBadge } from '../../components/design-system'
import { currentUser } from '../auth/auth-api'
import {
  getDemand,
  getServiceResponseEligibility,
  joinDemand,
  listDemandServiceResponses,
  publishDemandServiceResponse,
  updateDemandSupport,
  withdrawDemandServiceResponse,
  withdrawDemandSupport,
  type Demand,
  type PublicServiceResponsePage,
  type ServiceResponseBlocker,
  type ServiceResponseEligibility,
  type ServiceResponseValues,
  type SupportValues,
} from './demand-api'
import { demandStateLabel, reasonLabel } from './demand-labels'
import { DemandServiceResponseForm } from './DemandServiceResponseForm'
import { DemandSupportForm } from './DemandSupportForm'
import { DemandComments } from './DemandComments'
import { DemandFeedbackPanel } from './DemandFeedbackPanel'
import { ReportControl } from '../moderation/ReportControl'

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
  const [serviceResponses, setServiceResponses] =
    useState<PublicServiceResponsePage>()
  const [responsesLoading, setResponsesLoading] = useState(true)
  const [responsesError, setResponsesError] = useState<string>()
  const [responsePage, setResponsePage] = useState(0)
  const [serviceEligibility, setServiceEligibility] =
    useState<ServiceResponseEligibility>()
  const [serviceFormOpen, setServiceFormOpen] = useState(false)
  const [servicePending, setServicePending] = useState(false)
  const [serviceError, setServiceError] = useState<string>()
  const [serviceNotice, setServiceNotice] = useState<string>()
  const requestVersion = useRef(0)
  const responseRequestVersion = useRef(0)
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

  const loadServiceResponses = useCallback(async () => {
    if (!demandId) return
    const request = ++responseRequestVersion.current
    setResponsesLoading(true)
    setResponsesError(undefined)
    try {
      const result = await listDemandServiceResponses(demandId, responsePage)
      if (request === responseRequestVersion.current) {
        setServiceResponses(result)
      }
    } catch {
      if (request === responseRequestVersion.current) {
        setServiceResponses(undefined)
        setResponsesError(
          'İşletmeci servis bildirimleri yüklenemedi. Tekrar deneyin.',
        )
      }
    } finally {
      if (request === responseRequestVersion.current) {
        setResponsesLoading(false)
      }
    }
  }, [demandId, responsePage])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadDemand(), 0)
    return () => {
      window.clearTimeout(timer)
      requestVersion.current += 1
    }
  }, [loadDemand])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadServiceResponses(), 0)
    return () => {
      window.clearTimeout(timer)
      responseRequestVersion.current += 1
    }
  }, [loadServiceResponses])

  useEffect(() => {
    if (loading || !demand || resumeHandled.current) {
      return
    }
    const action = searchParams.get('action')
    if (action !== 'support' && action !== 'response') return
    resumeHandled.current = true
    setSearchParams({}, { replace: true })
    if (action === 'support') void beginSupport()
    else void beginServiceResponse()
    // The resume action is deliberately consumed only once after login.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [demand, loading, searchParams, setSearchParams])

  function loginReturnPath(action: 'support' | 'response') {
    return `${location.pathname}?action=${action}`
  }

  function redirectToLogin(
    action: 'support' | 'response',
    sessionExpired = false,
  ) {
    const reason = sessionExpired ? '&reason=session' : ''
    const loginPath = action === 'support' ? '/parent/login' : '/operator/login'
    void navigate(
      `${loginPath}?next=${encodeURIComponent(loginReturnPath(action))}${reason}`,
    )
  }

  async function beginSupport(mode?: SupportMode) {
    setActionError(undefined)
    setNotice(undefined)
    try {
      const user = await currentUser()
      if (user.role !== 'PARENT') {
        setActionError(
          'Desteğinizi yönetmek için veli hesabınızla giriş yapın.',
        )
        return
      }
      const support = demand?.currentUserSupport
      setSupportMode(
        mode ??
          (support?.status === 'ACTIVE' ||
          support?.status === 'AWAITING_FEEDBACK'
            ? 'edit'
            : support?.status === 'WITHDRAWN' ||
                support?.status === 'INACTIVE_EXPIRED'
              ? 'reactivate'
              : 'join'),
      )
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 401) {
        redirectToLogin('support', error.sessionExpired)
        return
      }
      setActionError('Oturum bilgisi kontrol edilemedi. Tekrar deneyin.')
    }
  }

  async function beginServiceResponse() {
    if (!demandId) return
    setServicePending(true)
    setServiceError(undefined)
    setServiceNotice(undefined)
    try {
      const user = await currentUser()
      if (user.role !== 'OPERATOR') {
        setServiceError(
          'Servis bildirimi yalnızca doğrulanmış işletmeci hesabıyla yayınlanabilir.',
        )
        return
      }
      const eligibility = await getServiceResponseEligibility(demandId)
      setServiceEligibility(eligibility)
      setServiceFormOpen(
        eligibility.eligible && eligibility.response?.status !== 'ACTIVE',
      )
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 401) {
        redirectToLogin('response', error.sessionExpired)
        return
      }
      setServiceError(
        error instanceof ApiError
          ? error.problem.detail
          : 'İşletmeci uygunluğu kontrol edilemedi. Tekrar deneyin.',
      )
    } finally {
      setServicePending(false)
    }
  }

  async function submitServiceResponse(values: ServiceResponseValues) {
    if (!demandId) return
    setServiceError(undefined)
    setServiceNotice(undefined)
    try {
      const result = await publishDemandServiceResponse(demandId, values)
      setServiceEligibility((current) =>
        current
          ? {
              ...current,
              eligible: true,
              blockers: [],
              response: result.response,
            }
          : current,
      )
      setServiceFormOpen(false)
      setServiceNotice(
        result.published
          ? 'Servis bildiriminiz velilere hemen yayınlandı.'
          : 'Servis bildiriminiz zaten yayında; yeni bir yayın olayı oluşturulmadı.',
      )
      await loadServiceResponses()
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 401) {
        redirectToLogin('response', true)
        return
      }
      setServiceError(
        error instanceof ApiError
          ? error.problem.detail
          : 'Servis bildirimi yayınlanamadı. Okul ve mahalle bilgilerinizi yenileyin.',
      )
    }
  }

  async function withdrawServiceResponse() {
    if (!demandId) return
    setServicePending(true)
    setServiceError(undefined)
    setServiceNotice(undefined)
    try {
      const response = await withdrawDemandServiceResponse(demandId)
      setServiceEligibility((current) =>
        current ? { ...current, response } : current,
      )
      setServiceFormOpen(false)
      setServiceNotice(
        'Servis bildiriminiz geri çekildi ve artık velilere gösterilmiyor.',
      )
      await loadServiceResponses()
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 401) {
        redirectToLogin('response', true)
        return
      }
      setServiceError(
        error instanceof ApiError
          ? error.problem.detail
          : 'Servis bildirimi geri çekilemedi. Tekrar deneyin.',
      )
    } finally {
      setServicePending(false)
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
      redirectToLogin('support', true)
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
  const activeSupport =
    demand.currentUserSupport?.status === 'ACTIVE' ||
    demand.currentUserSupport?.status === 'AWAITING_FEEDBACK'
  const withdrawnSupport =
    demand.currentUserSupport?.status === 'WITHDRAWN' ||
    demand.currentUserSupport?.status === 'INACTIVE_EXPIRED'
  const feedbackVisible =
    demand.currentUserSupport?.status === 'ACTIVE' ||
    demand.currentUserSupport?.status === 'AWAITING_FEEDBACK' ||
    demand.currentUserSupport?.status === 'SATISFIED' ||
    demand.currentUserSupport?.status === 'INACTIVE_EXPIRED'
  const open = demand.status === 'OPEN'
  const canManageSupport =
    open || (withdrawnSupport && demand.closureReason === 'INACTIVE')
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
        <div className="demand-detail-heading">
          <div className="demand-detail-meta">
            <StatusBadge>{demand.academicYear} eğitim yılı</StatusBadge>
            <StatusBadge tone={open ? 'success' : 'warning'}>
              {open ? 'Katılıma açık' : 'Katılıma kapalı'}
            </StatusBadge>
          </div>
          <h1>{demand.school.name}</h1>
          <p>
            {demand.neighborhood.provinceName} ·{' '}
            {demand.neighborhood.districtName} · {demand.neighborhood.name}
          </p>
        </div>
        <div className="demand-detail-header-actions">
          {open && (
            <ReportControl
              label="Talebi bildir"
              targetId={demand.id}
              targetType="DEMAND"
            />
          )}
        </div>
      </header>

      <section className="demand-lifecycle-summary" aria-label="Talep durumu">
        <div>
          <h2>{demandStateLabel(demand)}</h2>
          <p>{demandLifecycleDescription(demand)}</p>
        </div>
        <dl>
          <div>
            <dt>Oluşturulma</dt>
            <dd>
              <time dateTime={demand.createdAt}>
                {formatDemandDate(demand.createdAt)}
              </time>
            </dd>
          </div>
          <div>
            <dt>{demand.closedAt ? 'Kapanma' : 'Son güncelleme'}</dt>
            <dd>
              <time dateTime={demand.closedAt ?? demand.updatedAt}>
                {formatDemandDate(demand.closedAt ?? demand.updatedAt)}
              </time>
            </dd>
          </div>
        </dl>
      </section>

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
          <h2 id="demand-count-title">Talep özeti</h2>

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
            <p>Henüz neden belirtilmemiş.</p>
          )}
        </section>
      </div>

      <section
        className="demand-service-panel"
        aria-labelledby="service-responses-title"
      >
        <div className="section-heading demand-service-heading">
          <div>
            <h2 id="service-responses-title">
              İşletmecilerin servis duyuruları
            </h2>
            <p>
              Bilgiler işletmeciler tarafından paylaşılır. Ücret ve müsaitliği
              işletmeciyle görüşün.
            </p>
          </div>
          {serviceResponses && serviceResponses.totalElements > 0 && (
            <span className="count-badge">
              {serviceResponses.totalElements} bildirim
            </span>
          )}
        </div>

        {responsesLoading && (
          <div className="demand-response-loading" role="status">
            Servis bildirimleri yükleniyor…
          </div>
        )}
        {!responsesLoading && responsesError && (
          <div className="demand-load-error" role="alert">
            <p>{responsesError}</p>
            <button
              className="secondary-button"
              onClick={() => void loadServiceResponses()}
              type="button"
            >
              Tekrar dene
            </button>
          </div>
        )}
        {!responsesLoading && !responsesError && serviceResponses && (
          <>
            {serviceResponses.content.length > 0 ? (
              <ul className="demand-service-response-list">
                {serviceResponses.content.map((response) => (
                  <li key={response.id}>
                    <div className="demand-service-operator">
                      <strong>
                        {response.businessName ?? 'İsimsiz işletmeci'}
                      </strong>
                      <span>
                        Yayın {response.publicationVersion} ·{' '}
                        <time dateTime={response.publishedAt}>
                          {formatDemandDate(response.publishedAt)}
                        </time>
                      </span>
                    </div>
                    <div
                      className="demand-service-directions"
                      aria-label="Sunulan servis yönleri"
                    >
                      {response.offersMorning && <span>Sabah</span>}
                      {response.offersAfternoon && <span>Öğleden sonra</span>}
                    </div>
                    <div className="demand-service-response-actions">
                      <a
                        className="button-link"
                        href={`tel:${response.contactPhone}`}
                      >
                        {response.contactPhone} numarasını ara
                      </a>
                      <ReportControl
                        label="Bildir"
                        targetId={response.id}
                        targetType="SERVICE_RESPONSE"
                      />
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="demand-service-empty">
                <h3>Henüz servis bildirimi yok</h3>
              </div>
            )}
            {serviceResponses.totalPages > 1 && (
              <nav
                className="pagination"
                aria-label="Servis bildirimi sayfaları"
              >
                <button
                  className="secondary-button"
                  disabled={serviceResponses.page === 0}
                  onClick={() =>
                    setResponsePage((page) => Math.max(0, page - 1))
                  }
                  type="button"
                >
                  Önceki sayfa
                </button>
                <span>
                  Sayfa {serviceResponses.page + 1} /{' '}
                  {serviceResponses.totalPages}
                </span>
                <button
                  className="secondary-button"
                  disabled={
                    serviceResponses.page + 1 >= serviceResponses.totalPages
                  }
                  onClick={() => setResponsePage((page) => page + 1)}
                  type="button"
                >
                  Sonraki sayfa
                </button>
              </nav>
            )}
          </>
        )}

        {open && (
          <div className="demand-service-publish">
            <div>
              <h3>Bu konuma servis sunuyor musunuz?</h3>
              <p>
                Bu okul ve mahallede hizmet veriyorsanız servis duyurusu
                paylaşabilirsiniz.
              </p>
            </div>
            {!serviceEligibility && (
              <button
                className="primary-button"
                disabled={servicePending}
                onClick={() => void beginServiceResponse()}
                type="button"
              >
                {servicePending
                  ? 'Bilgiler kontrol ediliyor…'
                  : 'Bu talep için servis ekle'}
              </button>
            )}
          </div>
        )}

        {serviceEligibility && serviceEligibility.blockers.length > 0 && (
          <div className="demand-service-guidance" role="status">
            <h3>Yayınlamadan önce tamamlanması gerekenler</h3>
            <ul>
              {serviceEligibility.blockers.map((blocker) => (
                <li key={blocker}>{serviceResponseBlockerMessage(blocker)}</li>
              ))}
            </ul>
            {serviceEligibility.blockers.some((blocker) =>
              [
                'SCHOOL_NOT_LINKED',
                'SCHOOL_RELATIONSHIP_INACTIVE',
                'COVERAGE_MISSING',
              ].includes(blocker),
            ) && (
              <Link className="button-link" to="/operator/schools">
                Okul ve kapsam yönetimine git
              </Link>
            )}
            {serviceEligibility.blockers.includes('PROFILE_HIDDEN') && (
              <Link className="button-link" to="/operator/profile">
                Profil görünürlüğünü düzenle
              </Link>
            )}
            <button
              className="secondary-button"
              disabled={servicePending}
              onClick={() => void beginServiceResponse()}
              type="button"
            >
              Uygunluğu yeniden kontrol et
            </button>
          </div>
        )}

        {serviceEligibility?.response?.status === 'ACTIVE' && (
          <div className="demand-service-owned" role="status">
            <div>
              <span
                className={`status-pill ${
                  serviceEligibility.response.currentlyPublic
                    ? 'success'
                    : 'neutral'
                }`}
              >
                {serviceEligibility.response.currentlyPublic
                  ? 'Bildiriminiz yayında'
                  : 'Bildiriminiz şu anda gizli'}
              </span>
              <p>
                {serviceEligibility.response.offersMorning && 'Sabah'}
                {serviceEligibility.response.offersMorning &&
                  serviceEligibility.response.offersAfternoon &&
                  ' ve '}
                {serviceEligibility.response.offersAfternoon && 'öğleden sonra'}{' '}
                yönü{' '}
                {serviceEligibility.response.currentlyPublic
                  ? 'velilere gösteriliyor.'
                  : 'gerekli koşullar sağlanana kadar velilere gösterilmiyor.'}
              </p>
            </div>
            <button
              className="danger-button"
              disabled={servicePending}
              onClick={() => void withdrawServiceResponse()}
              type="button"
            >
              {servicePending ? 'Geri çekiliyor…' : 'Bildirimi geri çek'}
            </button>
          </div>
        )}

        {serviceFormOpen && serviceEligibility?.eligible && (
          <DemandServiceResponseForm
            initialValues={
              serviceEligibility.response
                ? {
                    offersMorning: serviceEligibility.response.offersMorning,
                    offersAfternoon:
                      serviceEligibility.response.offersAfternoon,
                  }
                : undefined
            }
            onCancel={() => setServiceFormOpen(false)}
            onSubmit={submitServiceResponse}
          />
        )}

        {serviceNotice && (
          <div className="status-banner success" role="status">
            {serviceNotice}
          </div>
        )}
        {serviceError && (
          <div className="form-error" role="alert">
            {serviceError}
          </div>
        )}
      </section>

      {feedbackVisible && (
        <DemandFeedbackPanel demandId={demand.id} onResolved={loadDemand} />
      )}

      <section className="demand-support-panel" aria-labelledby="support-title">
        <div className="section-heading">
          <div>
            <h2 id="support-title">Sizin desteğiniz</h2>
            <p>
              Katılımınız ve yön tercihleriniz yalnızca kendi hesabınızda
              yönetilir.
            </p>
          </div>
          {activeSupport && (
            <span className="status-pill success">
              {demand.currentUserSupport?.status === 'AWAITING_FEEDBACK'
                ? 'Yanıtınız bekleniyor'
                : 'Destekliyorsunuz'}
            </span>
          )}
          {withdrawnSupport && (
            <span className="status-pill neutral">Geri çekildi</span>
          )}
        </div>

        {!open && (
          <div className="status-banner neutral">
            {demand.closureReason === 'INACTIVE' && withdrawnSupport
              ? 'Talep hareketsizlik nedeniyle kapandı. Desteğinizi yeniden etkinleştirerek talebi açabilirsiniz.'
              : demand.closureReason === 'FULFILLED'
                ? 'Bu talep bir velinin açık geri bildirimiyle karşılandı olarak kapatıldı.'
                : 'Bu talep yeni destek ve güncellemelere kapalıdır.'}
          </div>
        )}

        {demand.currentUserSupport && (
          <div className="demand-current-support" aria-label="Katılım özetiniz">
            <div>
              <span>Katılım durumu</span>
              <strong>
                {supportStateLabel(demand.currentUserSupport.status)}
              </strong>
            </div>
            <div>
              <span>İhtiyaç yönü</span>
              <strong>
                {directionSummary(
                  demand.currentUserSupport.needsMorning,
                  demand.currentUserSupport.needsAfternoon,
                )}
              </strong>
            </div>
          </div>
        )}

        {canManageSupport && !supportMode && (
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

        {canManageSupport && supportMode && (
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

function demandLifecycleDescription(
  demand: Pick<Demand, 'status' | 'closureReason'>,
) {
  if (demand.status === 'OPEN') {
    return 'Yeni veli destekleri, uygun işletmeci bildirimleri ve yorumlar kabul ediliyor.'
  }
  if (demand.status === 'ARCHIVED') {
    return 'Talep geçmiş kaydı olarak korunuyor; yeni katılım ve yayın kabul edilmiyor.'
  }
  if (demand.closureReason === 'FULFILLED') {
    return 'En az bir veli, yayımlanan servis bildiriminin ihtiyacını karşıladığını bildirdi.'
  }
  if (demand.closureReason === 'INACTIVE') {
    return 'Etkin destek kalmadığı için talep kapandı; uygun bir veli desteği yeniden açabilir.'
  }
  return 'Talep yönetim kararıyla kapatıldı; geçmiş katılım bilgileri korunuyor.'
}

function supportStateLabel(
  status: NonNullable<Demand['currentUserSupport']>['status'],
) {
  switch (status) {
    case 'ACTIVE':
      return 'Etkin destek'
    case 'AWAITING_FEEDBACK':
      return 'Geri bildirim bekleniyor'
    case 'SATISFIED':
      return 'İhtiyaç karşılandı'
    case 'INACTIVE_EXPIRED':
      return 'Yanıt süresi doldu'
    case 'WITHDRAWN':
      return 'Geri çekildi'
  }
}

function directionSummary(morning: boolean, afternoon: boolean) {
  if (morning && afternoon) return 'Sabah ve öğleden sonra'
  return morning ? 'Sabah' : 'Öğleden sonra'
}

function formatDemandDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function serviceResponseBlockerMessage(blocker: ServiceResponseBlocker) {
  switch (blocker) {
    case 'ACCOUNT_EMAIL_UNVERIFIED':
      return 'İşletmeci hesabının e-posta adresi doğrulanmış olmalı.'
    case 'ACCOUNT_DISABLED':
      return 'İşletmeci hesabı etkin olmalı.'
    case 'PROFILE_INACTIVE':
      return 'Askıya alınmış işletmeci profili servis bildirimi yayınlayamaz.'
    case 'PROFILE_HIDDEN':
      return 'İşletmeci profili herkese görünür olmalı.'
    case 'APPROVAL_REQUIRED':
      return 'Bu ortamda işletmeci başvurusunun onaylanmış olması gerekiyor.'
    case 'DEMAND_NOT_OPEN':
      return 'Talep artık yeni servis bildirimlerine açık değil.'
    case 'SCHOOL_INACTIVE':
      return 'Talebin okulu şu anda etkin değil.'
    case 'SCHOOL_NOT_LINKED':
      return 'Bu okulu önce işletmeci hesabınıza ekleyin.'
    case 'SCHOOL_RELATIONSHIP_INACTIVE':
      return 'İşletmeci hesabınızdaki okul bağlantısını etkinleştirin.'
    case 'COVERAGE_MISSING':
      return 'Talebin mahallesini bu okulun genel kapsamına ekleyin.'
  }
}

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { StatusBadge } from '../../components/design-system'
import {
  getModerationCase,
  listModerationCases,
  moderateCase,
  moderationCaseStatuses,
  moderationTargetTypes,
  reportReasons,
  type ModerationAction,
  type ModerationCaseDetail,
  type ModerationCasePage,
  type ModerationCaseStatus,
  type ModerationTargetType,
  type ReportReason,
} from '../moderation/moderation-api'

const statusLabels: Record<ModerationCaseStatus, string> = {
  OPEN: 'Açık',
  IN_REVIEW: 'İnceleniyor',
  RESOLVED: 'Sonuçlandı',
  DISMISSED: 'Reddedildi',
}
const targetLabels: Record<ModerationTargetType, string> = {
  COMMENT: 'Yorum',
  DEMAND: 'Talep',
  SERVICE_RESPONSE: 'Servis bildirimi',
}
const reasonLabels: Record<ReportReason, string> = {
  ABUSE_HARASSMENT: 'Hakaret veya taciz',
  HATE_DISCRIMINATION: 'Nefret veya ayrımcılık',
  PERSONAL_DATA: 'Kişisel bilgi paylaşımı',
  SPAM_ADVERTISING: 'Spam veya reklam',
  MISLEADING_SERVICE: 'Yanıltıcı hizmet bilgisi',
  OTHER: 'Diğer',
}
const actionLabels: Record<ModerationAction, string> = {
  MARK_IN_REVIEW: 'İncelemeye al',
  DISMISS: 'Bildirimi reddet',
  RESOLVE_NO_ACTION: 'İşlem yapmadan sonuçlandır',
  HIDE_COMMENT: 'Yorumu gizle',
  RESTORE_COMMENT: 'Yorumu geri getir',
  WITHDRAW_SERVICE_RESPONSE: 'Servis bildirimini geri çek',
  SUSPEND_OPERATOR: 'İşletmeciyi askıya al',
  CLOSE_DEMAND: 'Talebi kapat',
}
const statusTones: Record<
  ModerationCaseStatus,
  'neutral' | 'info' | 'success' | 'warning'
> = {
  OPEN: 'warning',
  IN_REVIEW: 'info',
  RESOLVED: 'success',
  DISMISSED: 'neutral',
}
const defaultFilters = {
  status: 'OPEN' as ModerationCaseStatus | '',
  targetType: '' as ModerationTargetType | '',
  reason: '' as ReportReason | '',
  reportedFrom: '',
  reportedTo: '',
}

export function AdminModerationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const openedCaseId = useRef<string | undefined>(undefined)
  const [filters, setFilters] = useState({ ...defaultFilters })
  const [submitted, setSubmitted] = useState(filters)
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<ModerationCasePage>()
  const [selected, setSelected] = useState<ModerationCaseDetail>()
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [pendingAction, setPendingAction] = useState<ModerationAction>()
  const [decisionReason, setDecisionReason] = useState('')
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()

  const handleFailure = useCallback(
    (failure: unknown, fallback: string) => {
      if (failure instanceof ApiError && failure.sessionExpired) {
        void navigate('/operator/login?reason=session', { replace: true })
        return
      }
      setError(failure instanceof ApiError ? failure.problem.detail : fallback)
    },
    [navigate],
  )

  useEffect(() => {
    const caseId = searchParams.get('caseId')
    if (!caseId || openedCaseId.current === caseId) return
    openedCaseId.current = caseId
    setDetailLoading(true)
    void getModerationCase(caseId)
      .then((detail) => setSelected(detail))
      .catch((failure: unknown) =>
        handleFailure(
          failure,
          'Bildirim ayrıntısı yüklenemedi. Tekrar deneyin.',
        ),
      )
      .finally(() => setDetailLoading(false))
  }, [handleFailure, searchParams])

  const loadQueue = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      const response = await listModerationCases({
        status: submitted.status || undefined,
        targetType: submitted.targetType || undefined,
        reason: submitted.reason || undefined,
        reportedFrom: toIso(submitted.reportedFrom),
        reportedTo: toIso(submitted.reportedTo),
        page,
      })
      setResult(response)
      setSelected((current) =>
        current &&
        !response.content.some((item) => item.id === current.summary.id)
          ? undefined
          : current,
      )
    } catch (failure) {
      handleFailure(failure, 'Bildirim kuyruğu yüklenemedi. Tekrar deneyin.')
    } finally {
      setLoading(false)
    }
  }, [handleFailure, page, submitted])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQueue(), 0)
    return () => window.clearTimeout(timer)
  }, [loadQueue])

  async function chooseCase(id: string) {
    setDetailLoading(true)
    setError(undefined)
    setNotice(undefined)
    try {
      setSelected(await getModerationCase(id))
      setDecisionReason('')
    } catch (failure) {
      handleFailure(failure, 'Bildirim ayrıntısı yüklenemedi. Tekrar deneyin.')
    } finally {
      setDetailLoading(false)
    }
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault()
    if (
      filters.reportedFrom &&
      filters.reportedTo &&
      new Date(filters.reportedFrom) >= new Date(filters.reportedTo)
    ) {
      setError('Bitiş zamanı başlangıç zamanından sonra olmalıdır.')
      return
    }
    setError(undefined)
    setPage(0)
    setSubmitted(filters)
  }

  async function act(action: ModerationAction) {
    const normalized = decisionReason.trim()
    if (Array.from(normalized).length < 2) {
      setError('Yönetici gerekçesi en az 2 karakter olmalıdır.')
      return
    }
    if (!selected) return
    if (
      isEnforcementAction(action) &&
      !window.confirm(
        `${actionLabels[action]} işlemi içeriğin veya hesabın görünürlüğünü etkileyebilir. Devam edilsin mi?`,
      )
    ) {
      return
    }
    setPendingAction(action)
    setError(undefined)
    setNotice(undefined)
    try {
      const updated = await moderateCase(
        selected.summary.id,
        action,
        normalized,
      )
      setSelected(updated)
      setDecisionReason('')
      setNotice(`${actionLabels[action]} işlemi kaydedildi.`)
      await loadQueue()
    } catch (failure) {
      handleFailure(failure, 'Yönetim işlemi tamamlanamadı. Tekrar deneyin.')
    } finally {
      setPendingAction(undefined)
    }
  }

  return (
    <section className="workspace-page admin-page moderation-page">
      <header className="admin-page-header">
        <h1>İçerik bildirimleri</h1>
        <p>
          Bildirilen içerikleri inceleyin. Bildirilmesi içeriği otomatik olarak
          kaldırmaz.
        </p>
      </header>

      <form className="moderation-filters" onSubmit={applyFilters}>
        <label>
          Durum
          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                status: event.target.value as ModerationCaseStatus | '',
              }))
            }
          >
            <option value="">Tümü</option>
            {moderationCaseStatuses.map((status) => (
              <option key={status} value={status}>
                {statusLabels[status]}
              </option>
            ))}
          </select>
        </label>
        <label>
          İçerik türü
          <select
            value={filters.targetType}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                targetType: event.target.value as ModerationTargetType | '',
              }))
            }
          >
            <option value="">Tümü</option>
            {moderationTargetTypes.map((target) => (
              <option key={target} value={target}>
                {targetLabels[target]}
              </option>
            ))}
          </select>
        </label>
        <label>
          Neden
          <select
            value={filters.reason}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                reason: event.target.value as ReportReason | '',
              }))
            }
          >
            <option value="">Tümü</option>
            {reportReasons.map((reason) => (
              <option key={reason} value={reason}>
                {reasonLabels[reason]}
              </option>
            ))}
          </select>
        </label>
        <details className="admin-advanced-filters">
          <summary>Tarih aralığı</summary>
          <div>
            <label>
              Başlangıç
              <input
                type="datetime-local"
                value={filters.reportedFrom}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    reportedFrom: event.target.value,
                  }))
                }
              />
            </label>
            <label>
              Bitiş
              <input
                type="datetime-local"
                value={filters.reportedTo}
                onChange={(event) =>
                  setFilters((current) => ({
                    ...current,
                    reportedTo: event.target.value,
                  }))
                }
              />
            </label>
          </div>
        </details>
        <button className="primary-button" type="submit">
          Filtrele
        </button>
        <button
          className="text-button"
          onClick={() => {
            setFilters({ ...defaultFilters })
            setSubmitted({ ...defaultFilters })
            setPage(0)
          }}
          type="button"
        >
          Seçimleri temizle
        </button>
      </form>

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

      <div className="moderation-workbench">
        <section aria-labelledby="moderation-queue-title">
          <div className="section-heading">
            <h2 id="moderation-queue-title">İnceleme kuyruğu</h2>
            {result && (
              <span className="count-badge">{result.totalElements} kayıt</span>
            )}
          </div>
          {loading ? (
            <p role="status">Bildirimler yükleniyor…</p>
          ) : !result || result.content.length === 0 ? (
            <div className="empty-state">
              <h3>Bu filtrelerle bildirim yok</h3>
              <p>Filtreleri değiştirerek diğer kayıtları inceleyebilirsiniz.</p>
            </div>
          ) : (
            <ul className="moderation-case-list">
              {result.content.map((item) => (
                <li key={item.id}>
                  <button
                    aria-current={
                      selected?.summary.id === item.id ? 'true' : undefined
                    }
                    onClick={() => void chooseCase(item.id)}
                    type="button"
                  >
                    <span>
                      <strong>{item.target.title}</strong>
                      <small>
                        {targetLabels[item.targetType]} ·{' '}
                        {formatDate(item.updatedAt)}
                      </small>
                    </span>
                    <span className="moderation-case-meta">
                      <StatusBadge tone={statusTones[item.status]}>
                        {statusLabels[item.status]}
                      </StatusBadge>
                      <span>{item.reporterCount} bildiren</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {result && result.totalPages > 1 && (
            <nav className="pagination" aria-label="Bildirim kuyruğu sayfaları">
              <button
                className="secondary-button"
                disabled={page === 0}
                onClick={() => setPage((value) => value - 1)}
                type="button"
              >
                Önceki
              </button>
              <span>
                Sayfa {result.page + 1} / {result.totalPages}
              </span>
              <button
                className="secondary-button"
                disabled={page + 1 >= result.totalPages}
                onClick={() => setPage((value) => value + 1)}
                type="button"
              >
                Sonraki
              </button>
            </nav>
          )}
        </section>

        <section
          className="moderation-detail"
          aria-labelledby="moderation-detail-title"
        >
          <h2 id="moderation-detail-title">İnceleme ayrıntısı</h2>
          {detailLoading ? (
            <p role="status">Ayrıntı yükleniyor…</p>
          ) : !selected ? (
            <p className="moderation-detail-placeholder">
              İncelemek için kuyruktan bir kayıt seçin.
            </p>
          ) : (
            <ModerationDetail
              detail={selected}
              decisionReason={decisionReason}
              pendingAction={pendingAction}
              onReasonChange={setDecisionReason}
              onAction={act}
            />
          )}
        </section>
      </div>
    </section>
  )
}

function ModerationDetail({
  detail,
  decisionReason,
  pendingAction,
  onReasonChange,
  onAction,
}: {
  detail: ModerationCaseDetail
  decisionReason: string
  pendingAction?: ModerationAction
  onReasonChange: (value: string) => void
  onAction: (action: ModerationAction) => Promise<void>
}) {
  const actions = availableActions(detail)
  const caseActions = actions.filter((action) => !isEnforcementAction(action))
  const enforcementActions = actions.filter(isEnforcementAction)
  return (
    <div className="moderation-detail-content">
      <div>
        <StatusBadge tone={statusTones[detail.summary.status]}>
          {statusLabels[detail.summary.status]}
        </StatusBadge>
        <h3>{detail.summary.target.title}</h3>
        <p className="moderation-snapshot">{detail.summary.target.snapshot}</p>
        <p>
          {detail.summary.reporterCount} farklı hesap bildirdi. Bildirenlerin
          kimliği bu görünümde paylaşılmaz.
        </p>
      </div>
      <dl className="moderation-reason-counts">
        {Object.entries(detail.summary.reasonCounts).map(([reason, count]) => (
          <div key={reason}>
            <dt>{reasonLabels[reason as ReportReason]}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
      <section>
        <h3>Bildirim açıklamaları</h3>
        <ul className="moderation-report-list">
          {detail.reports.map((report) => (
            <li key={report.id}>
              <strong>{reasonLabels[report.reason]}</strong>
              <span>{report.explanation ?? 'Açıklama eklenmedi.'}</span>
              <time dateTime={report.createdAt}>
                {formatDate(report.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      </section>
      <label htmlFor="moderation-decision-reason">Yönetici gerekçesi</label>
      <textarea
        id="moderation-decision-reason"
        maxLength={500}
        onChange={(event) => onReasonChange(event.target.value)}
        rows={3}
        value={decisionReason}
      />
      <small className="character-count">
        {Array.from(decisionReason).length}/500 karakter
      </small>
      {caseActions.length > 0 && (
        <section className="moderation-action-group">
          <h3>İnceleme durumu</h3>
          <p>Kaydı incelemeye alın veya bildirim sürecini sonuçlandırın.</p>
          <div className="button-row moderation-actions">
            {caseActions.map((action) => (
              <button
                className="secondary-button"
                disabled={Boolean(pendingAction)}
                key={action}
                onClick={() => void onAction(action)}
                type="button"
              >
                {pendingAction === action
                  ? 'Kaydediliyor…'
                  : actionLabels[action]}
              </button>
            ))}
          </div>
        </section>
      )}
      {enforcementActions.length > 0 && (
        <section className="moderation-action-group moderation-enforcement">
          <h3>İçerik veya hesap işlemleri</h3>
          <p>Bu işlemler görünürlüğü veya hesap erişimini etkiler.</p>
          <div className="button-row moderation-actions">
            {enforcementActions.map((action) => (
              <button
                className="danger-button"
                disabled={Boolean(pendingAction)}
                key={action}
                onClick={() => void onAction(action)}
                type="button"
              >
                {pendingAction === action
                  ? 'Kaydediliyor…'
                  : actionLabels[action]}
              </button>
            ))}
          </div>
        </section>
      )}
      {detail.audit.length > 0 && (
        <section className="moderation-audit">
          <h3>İşlem geçmişi</h3>
          <ol>
            {detail.audit.map((event) => (
              <li key={event.id}>
                <strong>{actionLabels[event.action]}</strong>
                <span>{event.reason}</span>
                <time dateTime={event.createdAt}>
                  {formatDate(event.createdAt)}
                </time>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  )
}

function isEnforcementAction(action: ModerationAction) {
  return [
    'HIDE_COMMENT',
    'RESTORE_COMMENT',
    'WITHDRAW_SERVICE_RESPONSE',
    'SUSPEND_OPERATOR',
    'CLOSE_DEMAND',
  ].includes(action)
}

function availableActions(detail: ModerationCaseDetail): ModerationAction[] {
  const active =
    detail.summary.status === 'OPEN' || detail.summary.status === 'IN_REVIEW'
  const actions: ModerationAction[] = []
  if (active) actions.push('MARK_IN_REVIEW', 'DISMISS', 'RESOLVE_NO_ACTION')
  if (detail.summary.targetType === 'COMMENT') {
    if (detail.summary.target.currentlyVisible && active)
      actions.push('HIDE_COMMENT')
    if (!detail.summary.target.currentlyVisible) actions.push('RESTORE_COMMENT')
  }
  if (detail.summary.targetType === 'SERVICE_RESPONSE' && active) {
    if (detail.summary.target.currentlyVisible)
      actions.push('WITHDRAW_SERVICE_RESPONSE')
    if (detail.summary.target.operatorProfileId)
      actions.push('SUSPEND_OPERATOR')
  }
  if (
    detail.summary.targetType === 'DEMAND' &&
    detail.summary.target.currentlyVisible &&
    active
  ) {
    actions.push('CLOSE_DEMAND')
  }
  return actions
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : undefined
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  FormField,
  StatePanel,
  StatusBadge,
} from '../../components/design-system'
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
import { AdminConfirmDialog } from './AdminConfirmDialog'

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

type Filters = typeof defaultFilters
type StatusCounts = Record<ModerationCaseStatus, number>
type DecisionErrors = { action?: string; reason?: string }

export function AdminModerationPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const openedCaseId = useRef<string | undefined>(undefined)
  const feedbackRef = useRef<HTMLDivElement>(null)
  // Responses apply only while their request is still the latest of its kind.
  const queueRequest = useRef(0)
  const countsRequest = useRef(0)
  const detailRequest = useRef(0)
  const [filters, setFilters] = useState({ ...defaultFilters })
  const [submitted, setSubmitted] = useState(filters)
  const [filterError, setFilterError] = useState<string>()
  const [page, setPage] = useState(0)
  const [result, setResult] = useState<ModerationCasePage>()
  const [counts, setCounts] = useState<StatusCounts>()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [reviewCaseId, setReviewCaseId] = useState<string>()
  const [selected, setSelected] = useState<ModerationCaseDetail>()
  const [detailError, setDetailError] = useState<string>()
  const [decisionAction, setDecisionAction] = useState<ModerationAction | ''>(
    '',
  )
  const [decisionReason, setDecisionReason] = useState('')
  const [decisionErrors, setDecisionErrors] = useState<DecisionErrors>({})
  const [actionError, setActionError] = useState<string>()
  const [confirming, setConfirming] = useState(false)
  const [saving, setSaving] = useState(false)

  const failureMessage = useCallback(
    (failure: unknown, fallback: string) => {
      if (failure instanceof ApiError && failure.sessionExpired) {
        void navigate('/operator/login?reason=session', { replace: true })
        return undefined
      }
      return failure instanceof ApiError ? failure.problem.detail : fallback
    },
    [navigate],
  )

  const loadCase = useCallback(
    async (id: string) => {
      const request = ++detailRequest.current
      setDetailError(undefined)
      try {
        const detail = await getModerationCase(id)
        if (request === detailRequest.current) setSelected(detail)
      } catch (failure) {
        if (request === detailRequest.current) {
          setDetailError(
            failureMessage(
              failure,
              'Bildirim ayrıntısı yüklenemedi. Tekrar deneyin.',
            ),
          )
        }
      }
    },
    [failureMessage],
  )

  const openCase = useCallback(
    (id: string) => {
      setNotice(undefined)
      setSelected(undefined)
      setDecisionAction('')
      setDecisionReason('')
      setDecisionErrors({})
      setActionError(undefined)
      setReviewCaseId(id)
      void loadCase(id)
    },
    [loadCase],
  )

  useEffect(() => {
    const caseId = searchParams.get('caseId')
    if (!caseId || openedCaseId.current === caseId) return
    openedCaseId.current = caseId
    const timer = window.setTimeout(() => openCase(caseId), 0)
    return () => window.clearTimeout(timer)
  }, [openCase, searchParams])

  const loadQueue = useCallback(async () => {
    const request = ++queueRequest.current
    setLoading(true)
    setLoadError(undefined)
    try {
      const response = await listModerationCases({
        ...queueQuery(submitted),
        page,
      })
      if (request !== queueRequest.current) return
      const lastPage = Math.max(response.totalPages - 1, 0)
      if (response.content.length === 0 && page > lastPage) {
        // A decision can empty the last page of a filtered view.
        setPage(lastPage)
        return
      }
      setResult(response)
      setLoading(false)
    } catch (failure) {
      if (request !== queueRequest.current) return
      setLoadError(
        failureMessage(
          failure,
          'Bildirim kuyruğu yüklenemedi. Tekrar deneyin.',
        ),
      )
      setLoading(false)
    }
  }, [failureMessage, page, submitted])

  // Totals are supplementary and never block the queue. They ignore the status
  // tab and the page, so only the other filters or a decision refresh them.
  const { targetType, reason, reportedFrom, reportedTo } = submitted
  const loadCounts = useCallback(async () => {
    const request = ++countsRequest.current
    setCounts(undefined)
    try {
      const nextCounts = await loadStatusCounts({
        targetType,
        reason,
        reportedFrom,
        reportedTo,
      })
      if (request === countsRequest.current) setCounts(nextCounts)
    } catch (failure) {
      // Only an expired session matters here: failed totals stay unavailable.
      if (request === countsRequest.current) failureMessage(failure, '')
    }
  }, [failureMessage, reason, reportedFrom, reportedTo, targetType])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadQueue(), 0)
    return () => window.clearTimeout(timer)
  }, [loadQueue])

  useEffect(() => {
    const timer = window.setTimeout(() => void loadCounts(), 0)
    return () => window.clearTimeout(timer)
  }, [loadCounts])

  useEffect(() => {
    if (notice) feedbackRef.current?.focus()
  }, [notice])

  function closeReview() {
    detailRequest.current += 1
    setReviewCaseId(undefined)
    setSelected(undefined)
    setDetailError(undefined)
    setConfirming(false)
  }

  function chooseStatus(status: ModerationCaseStatus | '') {
    const next = { ...filters, status }
    setFilters(next)
    setSubmitted(next)
    setFilterError(undefined)
    setNotice(undefined)
    setPage(0)
  }

  function applyFilters(event: FormEvent) {
    event.preventDefault()
    if (
      filters.reportedFrom &&
      filters.reportedTo &&
      new Date(filters.reportedFrom) >= new Date(filters.reportedTo)
    ) {
      setFilterError('Bitiş zamanı başlangıç zamanından sonra olmalıdır.')
      return
    }
    setFilterError(undefined)
    setNotice(undefined)
    setPage(0)
    setSubmitted({ ...filters })
  }

  function resetFilters() {
    setFilters({ ...defaultFilters })
    setSubmitted({ ...defaultFilters })
    setFilterError(undefined)
    setNotice(undefined)
    setPage(0)
  }

  function submitDecision(event: FormEvent) {
    event.preventDefault()
    const errors: DecisionErrors = {}
    if (!decisionAction) errors.action = 'Bir karar seçin.'
    if (Array.from(decisionReason.trim()).length < 2) {
      errors.reason = 'Yönetici gerekçesi en az 2 karakter olmalıdır.'
    }
    setDecisionErrors(errors)
    setActionError(undefined)
    if (!decisionAction || errors.reason) return
    if (isEnforcementAction(decisionAction)) setConfirming(true)
    else void saveDecision(decisionAction)
  }

  async function saveDecision(action: ModerationAction) {
    if (!selected) return
    setSaving(true)
    setActionError(undefined)
    try {
      await moderateCase(selected.summary.id, action, decisionReason.trim())
      closeReview()
      setNotice(`${actionLabels[action]} işlemi kaydedildi.`)
      void loadCounts()
      await loadQueue()
    } catch (failure) {
      setConfirming(false)
      setActionError(
        failureMessage(
          failure,
          'Yönetim işlemi tamamlanamadı. Tekrar deneyin.',
        ),
      )
      if (failure instanceof ApiError && failure.problem.status === 409) {
        // Another administrator changed the case: offer only what still applies.
        setDecisionAction('')
        void loadCase(selected.summary.id)
        void loadQueue()
        void loadCounts()
      }
    } finally {
      setSaving(false)
    }
  }

  const pendingCount = counts && counts.OPEN + counts.IN_REVIEW
  const completedCount = counts && counts.RESOLVED + counts.DISMISSED
  const narrowed = Boolean(
    submitted.targetType ||
    submitted.reason ||
    submitted.reportedFrom ||
    submitted.reportedTo,
  )

  return (
    <section className="workspace-page admin-page moderation-page">
      <header className="admin-page-header admin-operator-header">
        <p className="admin-eyebrow">Yönetim paneli</p>
        <h1>Raporlama ve moderasyon</h1>
        <p>
          İçerik bildirimlerini inceleyin ve gerekçeli işlem kaydı oluşturun.
        </p>
        <p className="moderation-human-note">
          Kararlar insan tarafından verilir; yapay zekâ moderasyonu veya
          otomatik silme yoktur.
        </p>
      </header>

      {notice && (
        <div
          className="status-banner success admin-feedback"
          ref={feedbackRef}
          role="status"
          tabIndex={-1}
        >
          {notice}
        </div>
      )}

      <div className="moderation-summary">
        <SummaryCard
          label="Bekleyen bildirim"
          narrowed={narrowed}
          value={pendingCount}
        />
        <SummaryCard
          label="Sonuçlanan"
          narrowed={narrowed}
          value={completedCount}
        />
        <div className="moderation-guidance">
          <ShieldIcon />
          <p>
            Bildirilen içerik otomatik kaldırılmaz. Kaydı inceleyin, gerekçenizi
            yazın ve uygun kararı seçin.
          </p>
        </div>
      </div>

      <div className="admin-operator-toolbar moderation-toolbar">
        <div
          aria-label="Bildirim durumu"
          className="admin-status-filter"
          role="group"
        >
          <StatusTab
            active={submitted.status === ''}
            count={counts && sumCounts(counts)}
            label="Tüm bildirimler"
            onClick={() => chooseStatus('')}
          />
          {moderationCaseStatuses.map((status) => (
            <StatusTab
              active={submitted.status === status}
              count={counts?.[status]}
              key={status}
              label={statusLabels[status]}
              onClick={() => chooseStatus(status)}
            />
          ))}
        </div>
        <button
          className="secondary-button"
          onClick={resetFilters}
          type="button"
        >
          Filtreyi sıfırla
        </button>
      </div>

      <details className="moderation-more-filters">
        <summary>Diğer filtreler</summary>
        <form className="moderation-filters" onSubmit={applyFilters}>
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
          <button className="primary-button" type="submit">
            Filtrele
          </button>
          {filterError && (
            <div className="form-error" role="alert">
              {filterError}
            </div>
          )}
        </form>
      </details>

      {loadError ? (
        <StatePanel
          action={
            <button
              className="secondary-button"
              onClick={() => {
                void loadQueue()
                void loadCounts()
              }}
              type="button"
            >
              Tekrar dene
            </button>
          }
          detail={loadError}
          title="Bildirimler yüklenemedi"
          tone="error"
        />
      ) : loading ? (
        <StatePanel
          detail="Güncel bildirim kayıtları getiriliyor."
          title="Bildirimler yükleniyor"
          tone="loading"
        />
      ) : !result || result.content.length === 0 ? (
        <StatePanel
          detail="Diğer durumları seçebilir veya filtreyi sıfırlayabilirsiniz."
          title="Bu görünümde bildirim yok"
        />
      ) : (
        <ul className="moderation-report-cards">
          {result.content.map((item) => (
            <li className="moderation-report-card" key={item.id}>
              <span className="moderation-report-icon">
                <ShieldIcon />
              </span>
              <div className="moderation-report-main">
                <p className="moderation-report-meta">
                  <StatusBadge tone={statusTones[item.status]}>
                    {statusLabels[item.status]}
                  </StatusBadge>
                  <span>
                    {targetLabels[item.targetType]} ·{' '}
                    {formatDate(item.updatedAt)}
                  </span>
                </p>
                <h2>{item.target.title}</h2>
                <p className="moderation-report-snapshot">
                  {item.target.snapshot}
                </p>
                <small>
                  {reasonSummary(item.reasonCounts)} · {item.reporterCount}{' '}
                  bildiren
                </small>
              </div>
              <button
                aria-label={`İncele: ${item.target.title}`}
                className="secondary-button"
                onClick={() => openCase(item.id)}
                type="button"
              >
                İncele
              </button>
            </li>
          ))}
        </ul>
      )}

      {!loadError && !loading && result && result.totalPages > 1 && (
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

      {reviewCaseId && (
        <ReviewDialog onClose={closeReview} pending={saving}>
          {detailError ? (
            <StatePanel
              action={
                <button
                  className="secondary-button"
                  onClick={() => void loadCase(reviewCaseId)}
                  type="button"
                >
                  Tekrar dene
                </button>
              }
              detail={detailError}
              title="Ayrıntı yüklenemedi"
              tone="error"
            />
          ) : !selected ? (
            <p role="status">Ayrıntı yükleniyor…</p>
          ) : (
            <ModerationDetail
              action={decisionAction}
              actionError={actionError}
              detail={selected}
              errors={decisionErrors}
              onActionChange={(value) => {
                setDecisionAction(value)
                setDecisionErrors((current) => ({
                  ...current,
                  action: undefined,
                }))
              }}
              onClose={closeReview}
              onReasonChange={(value) => {
                setDecisionReason(value)
                setDecisionErrors((current) => ({
                  ...current,
                  reason: undefined,
                }))
              }}
              onSubmit={submitDecision}
              reason={decisionReason}
              saving={saving}
            />
          )}
        </ReviewDialog>
      )}

      {confirming && decisionAction && (
        <AdminConfirmDialog
          confirmLabel={actionLabels[decisionAction]}
          danger
          onCancel={() => setConfirming(false)}
          onConfirm={() => void saveDecision(decisionAction)}
          pending={saving}
          title={`${actionLabels[decisionAction]} işlemi onaylansın mı?`}
        >
          <p>
            Bu işlem içeriğin görünürlüğünü veya hesap erişimini etkileyebilir.
          </p>
          <blockquote>{decisionReason.trim()}</blockquote>
        </AdminConfirmDialog>
      )}
    </section>
  )
}

function SummaryCard({
  label,
  narrowed,
  value,
}: {
  label: string
  narrowed: boolean
  value?: number
}) {
  return (
    <div className="moderation-summary-card">
      <span>{label}</span>
      <strong>{value ?? '—'}</strong>
      {narrowed && <small>Seçili filtrelere göre</small>}
    </div>
  )
}

function StatusTab({
  active,
  count,
  label,
  onClick,
}: {
  active: boolean
  count?: number
  label: string
  onClick: () => void
}) {
  return (
    <button aria-pressed={active} onClick={onClick} type="button">
      {label}{' '}
      {count !== undefined && (
        <span className="moderation-tab-count">{count}</span>
      )}
    </button>
  )
}

function ReviewDialog({
  children,
  onClose,
  pending,
}: {
  children: ReactNode
  onClose: () => void
  pending: boolean
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    dialog?.showModal()
    titleRef.current?.focus()
    return () => {
      dialog?.close()
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  return (
    <dialog
      aria-labelledby={titleId}
      className="admin-confirm-dialog moderation-review-dialog"
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onClose()
      }}
      onClose={(event) => {
        // Repeated Escape can close a native dialog without a cancel event.
        const dialog = event.currentTarget
        if (dialog.open) return
        if (pending) dialog.showModal()
        else onClose()
      }}
      ref={dialogRef}
    >
      <h2 id={titleId} ref={titleRef} tabIndex={-1}>
        Bildirim ayrıntısı
      </h2>
      {children}
    </dialog>
  )
}

function ModerationDetail({
  action,
  actionError,
  detail,
  errors,
  onActionChange,
  onClose,
  onReasonChange,
  onSubmit,
  reason,
  saving,
}: {
  action: ModerationAction | ''
  actionError?: string
  detail: ModerationCaseDetail
  errors: DecisionErrors
  onActionChange: (value: ModerationAction | '') => void
  onClose: () => void
  onReasonChange: (value: string) => void
  onSubmit: (event: FormEvent) => void
  reason: string
  saving: boolean
}) {
  const actions = availableActions(detail)
  const caseActions = actions.filter((item) => !isEnforcementAction(item))
  const enforcementActions = actions.filter(isEnforcementAction)
  return (
    <div className="moderation-detail-content">
      <div className="moderation-report-preview">
        <p className="moderation-report-meta">
          <StatusBadge tone={statusTones[detail.summary.status]}>
            {statusLabels[detail.summary.status]}
          </StatusBadge>
          <span>{targetLabels[detail.summary.targetType]}</span>
        </p>
        <h3>{detail.summary.target.title}</h3>
        <p className="moderation-snapshot">{detail.summary.target.snapshot}</p>
        <small>
          {detail.summary.reporterCount} farklı hesap bildirdi. Bildirenlerin
          kimliği bu görünümde paylaşılmaz.
        </small>
      </div>
      <dl className="moderation-reason-counts">
        {Object.entries(detail.summary.reasonCounts).map(([key, count]) => (
          <div key={key}>
            <dt>{reasonLabels[key as ReportReason]}</dt>
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
      {detail.decisionReason && (
        <section className="moderation-decision-summary">
          <h3>Kayıtlı karar gerekçesi</h3>
          <p>{detail.decisionReason}</p>
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
      {actionError && (
        <div className="form-error" role="alert">
          {actionError}
        </div>
      )}
      {actions.length === 0 ? (
        <>
          <p className="moderation-closed-note">
            Bu kayıt için uygulanabilecek başka işlem yok.
          </p>
          <div className="admin-confirm-actions">
            <button
              className="secondary-button"
              onClick={onClose}
              type="button"
            >
              Kapat
            </button>
          </div>
        </>
      ) : (
        <form
          className="moderation-decision-form"
          noValidate
          onSubmit={onSubmit}
        >
          <FormField
            error={errors.reason}
            hint={`${Array.from(reason).length}/500 karakter`}
            htmlFor="moderation-decision-reason"
            label="Yönetici gerekçesi"
          >
            <textarea
              maxLength={500}
              onChange={(event) => onReasonChange(event.target.value)}
              placeholder="Nedenini kısaca yazın…"
              rows={3}
              value={reason}
            />
          </FormField>
          <FormField
            error={errors.action}
            htmlFor="moderation-decision-action"
            label="Karar"
          >
            <select
              onChange={(event) =>
                onActionChange(event.target.value as ModerationAction | '')
              }
              value={action}
            >
              <option value="">Karar seçin</option>
              {caseActions.length > 0 && (
                <optgroup label="İnceleme durumu">
                  {caseActions.map((item) => (
                    <option key={item} value={item}>
                      {actionLabels[item]}
                    </option>
                  ))}
                </optgroup>
              )}
              {enforcementActions.length > 0 && (
                <optgroup label="İçerik veya hesap işlemleri">
                  {enforcementActions.map((item) => (
                    <option key={item} value={item}>
                      {actionLabels[item]}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </FormField>
          {action && isEnforcementAction(action) && (
            <p className="moderation-enforcement-note">
              Bu karar görünürlüğü veya hesap erişimini etkiler; kaydetmeden
              önce onay istenir.
            </p>
          )}
          <div className="admin-confirm-actions">
            <button
              className="secondary-button"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              Vazgeç
            </button>
            <button className="primary-button" disabled={saving} type="submit">
              {saving ? 'Kaydediliyor…' : 'Kararı kaydet'}
            </button>
          </div>
        </form>
      )}
    </div>
  )
}

function ShieldIcon() {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="18"
      viewBox="0 0 24 24"
      width="18"
    >
      <path
        d="M12 3 5 6v5.5c0 4.4 2.9 8 7 9.5 4.1-1.5 7-5.1 7-9.5V6l-7-3Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function queueQuery(filters: Filters) {
  return {
    status: filters.status || undefined,
    targetType: filters.targetType || undefined,
    reason: filters.reason || undefined,
    reportedFrom: toIso(filters.reportedFrom),
    reportedTo: toIso(filters.reportedTo),
  }
}

async function loadStatusCounts(
  filters: Omit<Filters, 'status'>,
): Promise<StatusCounts> {
  const [OPEN, IN_REVIEW, RESOLVED, DISMISSED] = await Promise.all(
    moderationCaseStatuses.map((status) =>
      listModerationCases({
        ...queueQuery({ ...filters, status }),
        page: 0,
        size: 1,
      }).then((response) => response.totalElements),
    ),
  )
  return { OPEN, IN_REVIEW, RESOLVED, DISMISSED }
}

function sumCounts(counts: StatusCounts) {
  return counts.OPEN + counts.IN_REVIEW + counts.RESOLVED + counts.DISMISSED
}

function reasonSummary(reasonCounts: Partial<Record<ReportReason, number>>) {
  return Object.keys(reasonCounts)
    .map((reason) => reasonLabels[reason as ReportReason])
    .join(', ')
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
  if (detail.summary.status === 'OPEN') actions.push('MARK_IN_REVIEW')
  if (active) actions.push('DISMISS', 'RESOLVE_NO_ACTION')
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

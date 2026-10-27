import { useId, useRef, useState, type FormEvent } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { currentUser, knownAuthRole, type AuthRole } from '../auth/auth-api'
import {
  reportContent,
  reportReasons,
  type ModerationTargetType,
  type ReportReason,
} from './moderation-api'

const reasonLabels: Record<ReportReason, string> = {
  ABUSE_HARASSMENT: 'Hakaret veya taciz',
  HATE_DISCRIMINATION: 'Nefret veya ayrımcılık',
  PERSONAL_DATA: 'Kişisel bilgi paylaşımı',
  SPAM_ADVERTISING: 'Spam veya reklam',
  MISLEADING_SERVICE: 'Yanıltıcı hizmet bilgisi',
  OTHER: 'Diğer',
}

interface ReportControlProps {
  targetType: ModerationTargetType
  targetId: string
  label?: string
}

export function ReportControl({
  targetType,
  targetId,
  label = 'Bildir',
}: ReportControlProps) {
  const location = useLocation()
  const navigate = useNavigate()
  const fieldId = useId()
  const triggerRef = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<ReportReason>('ABUSE_HARASSMENT')
  const [explanation, setExplanation] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string>()
  const [sent, setSent] = useState(false)

  function redirectToLogin(
    sessionExpired: boolean,
    role: AuthRole | undefined = knownAuthRole(),
  ) {
    const loginPath = role === 'OPERATOR' ? '/operator/login' : '/parent/login'
    const next = encodeURIComponent(location.pathname + location.search)
    const reason = sessionExpired ? '&reason=session' : ''
    void navigate(`${loginPath}?next=${next}${reason}`)
  }

  async function begin() {
    setError(undefined)
    const role = knownAuthRole()
    try {
      const user = await currentUser()
      if (user.role !== 'PARENT' && user.role !== 'OPERATOR') {
        setError(
          'Bildirim yalnızca veli ve servis işletmecisi hesaplarıyla yapılabilir.',
        )
        return
      }
      setOpen(true)
    } catch (failure) {
      if (failure instanceof ApiError && failure.problem.status === 401) {
        redirectToLogin(failure.sessionExpired, role)
        return
      }
      setError('Hesabınız kontrol edilemedi. Tekrar deneyin.')
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    const normalized = explanation.trim()
    if (normalized && Array.from(normalized).length < 2) {
      setError('Açıklama en az 2 karakter olmalıdır.')
      return
    }
    setPending(true)
    setError(undefined)
    try {
      await reportContent({
        targetType,
        targetId,
        reason,
        explanation: normalized || null,
      })
      setSent(true)
      setOpen(false)
      setExplanation('')
    } catch (failure) {
      if (failure instanceof ApiError && failure.problem.status === 401) {
        redirectToLogin(failure.sessionExpired)
        return
      }
      setError(
        failure instanceof ApiError &&
          failure.problem.code === 'report_already_open'
          ? 'Bu içerik için açık bir bildiriminiz zaten var.'
          : failure instanceof ApiError
            ? failure.problem.detail
            : 'Bildirim gönderilemedi. Tekrar deneyin.',
      )
    } finally {
      setPending(false)
    }
  }

  if (sent) {
    return (
      <span className="report-sent" role="status">
        Bildirim alındı
      </span>
    )
  }

  return (
    <div className="report-control">
      {!open ? (
        <button
          className="text-button report-trigger"
          onClick={() => void begin()}
          ref={triggerRef}
          type="button"
        >
          {label}
        </button>
      ) : (
        <form className="report-form" onSubmit={submit}>
          <strong>İçeriği bildir</strong>
          <p>Bildiriminiz incelenecek. İçerik hemen kaldırılmaz.</p>
          <label htmlFor={`${fieldId}-reason`}>Bildirim nedeni</label>
          <select
            id={`${fieldId}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value as ReportReason)}
          >
            {reportReasons.map((value) => (
              <option key={value} value={value}>
                {reasonLabels[value]}
              </option>
            ))}
          </select>
          <label htmlFor={`${fieldId}-explanation`}>
            Açıklama (isteğe bağlı)
          </label>
          <textarea
            aria-describedby={`${fieldId}-privacy ${fieldId}-count`}
            id={`${fieldId}-explanation`}
            maxLength={500}
            onChange={(event) => setExplanation(event.target.value)}
            rows={3}
            value={explanation}
          />
          <small id={`${fieldId}-privacy`}>
            Öğrenci adı, açık adres veya telefon numarası yazmayın.
          </small>
          <small className="character-count" id={`${fieldId}-count`}>
            {Array.from(explanation).length}/500 karakter
          </small>
          <div className="button-row">
            <button className="primary-button" disabled={pending} type="submit">
              {pending ? 'Gönderiliyor…' : 'Bildirimi gönder'}
            </button>
            <button
              className="secondary-button"
              disabled={pending}
              onClick={() => {
                setOpen(false)
                setError(undefined)
                window.requestAnimationFrame(() => triggerRef.current?.focus())
              }}
              type="button"
            >
              Vazgeç
            </button>
          </div>
        </form>
      )}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

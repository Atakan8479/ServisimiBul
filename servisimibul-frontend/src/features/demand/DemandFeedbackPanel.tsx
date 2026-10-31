import { useEffect, useRef, useState } from 'react'
import { ApiError } from '../../api/client'
import {
  decideDemandFeedback,
  openDemandFeedback,
  type DemandFeedback,
  type DemandFeedbackList,
} from './demand-api'

interface DemandFeedbackPanelProps {
  demandId: string
  onResolved: () => Promise<void>
}

export function DemandFeedbackPanel({
  demandId,
  onResolved,
}: DemandFeedbackPanelProps) {
  const [data, setData] = useState<DemandFeedbackList>()
  const [error, setError] = useState<string>()
  const [pendingEventId, setPendingEventId] = useState<string>()
  const requestVersion = useRef(0)

  useEffect(() => {
    const request = ++requestVersion.current
    const timer = window.setTimeout(async () => {
      try {
        const result = await openDemandFeedback(demandId)
        if (request === requestVersion.current) setData(result)
      } catch (caught) {
        if (request !== requestVersion.current) return
        setError(
          caught instanceof ApiError && caught.problem.status === 401
            ? 'Geri bildirimi görmek için veli hesabınızla yeniden giriş yapın.'
            : 'Servis geri bildirimi yüklenemedi. Sayfayı yenileyip tekrar deneyin.',
        )
      }
    }, 0)
    return () => {
      window.clearTimeout(timer)
      requestVersion.current += 1
    }
  }, [demandId])

  async function decide(item: DemandFeedback, satisfied: boolean) {
    setPendingEventId(item.publicationEventId)
    setError(undefined)
    try {
      const result = await decideDemandFeedback(
        demandId,
        item.publicationEventId,
        satisfied,
      )
      setData(result)
      await onResolved()
    } catch (caught) {
      setError(
        caught instanceof ApiError && caught.problem.status === 401
          ? 'Geri bildirim göndermek için veli hesabınızla yeniden giriş yapın.'
          : caught instanceof ApiError
            ? caught.problem.detail
            : 'Geri bildiriminiz kaydedilemedi. Tekrar deneyin.',
      )
    } finally {
      setPendingEventId(undefined)
    }
  }

  return (
    <section className="demand-feedback-panel" aria-labelledby="feedback-title">
      <div className="section-heading demand-feedback-heading">
        <div>
          <h2 id="feedback-title">Servis ihtiyacınız karşılandı mı?</h2>
          <p>Yanıtınız rezervasyon oluşturmaz.</p>
        </div>
        {data?.feedback.some(
          (item) =>
            item.status === 'AWAITING_FEEDBACK' &&
            item.reminderTriggeredAt !== null,
        ) && <span className="status-pill neutral">Yanıt bekleniyor</span>}
      </div>

      {!data && !error && (
        <p className="demand-feedback-loading" role="status">
          Servis geri bildirimi hazırlanıyor…
        </p>
      )}

      {data && (
        <>
          {data.feedback.length === 0 && (
            <p className="demand-feedback-loading">
              Henüz değerlendirilecek servis bildirimi yok.
            </p>
          )}
          <ul className="demand-feedback-list">
            {data.feedback.map((item) => (
              <li data-status={item.status} key={item.publicationEventId}>
                <div className="demand-feedback-copy">
                  <strong>
                    {item.operatorBusinessName ?? 'İsimsiz işletmeci'}
                  </strong>
                  <span>{directionLabel(item)}</span>
                  <small>{feedbackStateLabel(item)}</small>
                  {item.status === 'AWAITING_FEEDBACK' && (
                    <time dateTime={item.expiresAt}>
                      {formatFeedbackDeadline(item.expiresAt)} tarihine kadar
                      yanıtlayın
                    </time>
                  )}
                </div>
                {item.canEvaluate && (
                  <div className="demand-feedback-actions">
                    <button
                      className="primary-button"
                      disabled={pendingEventId !== undefined}
                      onClick={() => void decide(item, true)}
                      type="button"
                    >
                      Talebim karşılandı
                    </button>
                    <button
                      className="secondary-button"
                      disabled={pendingEventId !== undefined}
                      onClick={() => void decide(item, false)}
                      type="button"
                    >
                      Karşılanmadı
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
          <p className="demand-feedback-disclaimer">{data.disclaimer}</p>
        </>
      )}

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </section>
  )
}

function directionLabel(item: DemandFeedback) {
  if (item.offersMorning && item.offersAfternoon)
    return 'Sabah ve öğleden sonra'
  return item.offersMorning ? 'Sabah servisi' : 'Öğleden sonra servisi'
}

function feedbackStateLabel(item: DemandFeedback) {
  switch (item.status) {
    case 'AWAITING_FEEDBACK':
      return item.reminderTriggeredAt
        ? 'Hatırlatma: Yanıt süresi dolmadan seçiminizi yapın.'
        : 'Değerlendirmeniz bekleniyor.'
    case 'SATISFIED':
      return 'Talebinizin karşılandığını bildirdiniz.'
    case 'NOT_SATISFIED':
      return 'Bu bildirimin ihtiyacınızı karşılamadığını bildirdiniz.'
    case 'INACTIVE_EXPIRED':
      return 'Yanıt süresi dolduğu için bu destek pasife alındı.'
    case 'SUPERSEDED':
      return 'Bu bildirim geri çekildi veya daha yeni bir yayınla değiştirildi.'
  }
}

function formatFeedbackDeadline(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

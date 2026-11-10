import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/design-system'
import type { Demand } from './demand-api'
import { demandStateLabel, reasonLabel } from './demand-labels'

export function DemandSummaryCard({ demand }: { demand: Demand }) {
  const activeReasons = demand.reasonCounts.filter((item) => item.count > 0)
  const open = demand.status === 'OPEN'
  const [previewOpen, setPreviewOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const restoreFocus = useRef(false)

  useEffect(() => {
    if (!previewOpen && restoreFocus.current) {
      restoreFocus.current = false
      triggerRef.current?.focus()
    }
  }, [previewOpen])

  return (
    <>
      <article
        className="demand-summary-card"
        onClick={() => setPreviewOpen(true)}
      >
        <div className="demand-summary-heading">
          <div>
            <div className="demand-summary-meta">
              <StatusBadge tone={open ? 'success' : 'neutral'}>
                {demandStateLabel(demand)}
              </StatusBadge>
              <time dateTime={demand.updatedAt}>
                {formatDemandDate(demand.updatedAt)} güncellendi
              </time>
            </div>
            <h2>{demand.school.name}</h2>
            <p>
              {demand.neighborhood.name}, {demand.neighborhood.districtName}
            </p>
          </div>
          <p className="demand-supporter-count">
            <strong>{demand.supporterCount}</strong>
            <span>destek</span>
          </p>
        </div>
        <div className="demand-summary-context">
          <span>{demand.academicYear}</span>
          <span>{demand.neighborhood.districtName}</span>
        </div>
        {activeReasons.length > 0 && (
          <div className="demand-reason-summary">
            <h3>Paylaşılan ihtiyaçlar</h3>
            <ul>
              {activeReasons.slice(0, 3).map((item) => (
                <li key={item.reason}>
                  <span>{reasonLabel(item.reason)}</span>
                  <strong>{item.count}</strong>
                </li>
              ))}
            </ul>
            {activeReasons.length > 3 && (
              <p>+{activeReasons.length - 3} ihtiyaç nedeni daha</p>
            )}
          </div>
        )}
        <footer className="demand-summary-footer">
          <dl className="demand-direction-counts" aria-label="İhtiyaç yönleri">
            <div>
              <dt>Sabah</dt>
              <dd>{demand.morningCount}</dd>
            </div>
            <div>
              <dt>Öğleden sonra</dt>
              <dd>{demand.afternoonCount}</dd>
            </div>
          </dl>
          <button
            className="button-link"
            ref={triggerRef}
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              setPreviewOpen(true)
            }}
          >
            Önizlemeyi aç
          </button>
        </footer>
      </article>
      {previewOpen && (
        <DemandPreviewDialog
          demand={demand}
          onClose={() => {
            restoreFocus.current = true
            setPreviewOpen(false)
          }}
        />
      )}
    </>
  )
}

function DemandPreviewDialog({
  demand,
  onClose,
}: {
  demand: Demand
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (typeof dialog?.showModal === 'function') dialog.showModal()
    else dialog?.setAttribute('open', '')
    closeRef.current?.focus()
    return () => {
      if (typeof dialog?.close === 'function') dialog.close()
      else dialog?.removeAttribute('open')
    }
  }, [])

  return (
    <dialog
      aria-labelledby={`demand-preview-${demand.id}`}
      className="demand-preview-dialog"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      ref={dialogRef}
    >
      <div className="demand-preview-heading">
        <div>
          <StatusBadge tone={demand.status === 'OPEN' ? 'success' : 'neutral'}>
            {demandStateLabel(demand)}
          </StatusBadge>
          <h2 id={`demand-preview-${demand.id}`}>{demand.school.name}</h2>
          <p>
            {demand.neighborhood.name}, {demand.neighborhood.districtName}
          </p>
        </div>
        <button
          aria-label="Önizlemeyi kapat"
          className="secondary-button"
          ref={closeRef}
          type="button"
          onClick={onClose}
        >
          Kapat
        </button>
      </div>
      <dl className="demand-confirm-summary">
        <div>
          <dt>Eğitim yılı</dt>
          <dd>{demand.academicYear}</dd>
        </div>
        <div>
          <dt>Destek sayısı</dt>
          <dd>{demand.supporterCount}</dd>
        </div>
        <div>
          <dt>Sabah ihtiyacı</dt>
          <dd>{demand.morningCount}</dd>
        </div>
        <div>
          <dt>Öğleden sonra ihtiyacı</dt>
          <dd>{demand.afternoonCount}</dd>
        </div>
      </dl>
      <Link className="button-link" to={`/demands/${demand.id}`} viewTransition>
        Tüm detayları görüntüle
      </Link>
    </dialog>
  )
}

function formatDemandDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value))
}

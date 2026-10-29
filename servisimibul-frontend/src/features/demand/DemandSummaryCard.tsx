import { Link } from 'react-router-dom'
import { StatusBadge } from '../../components/design-system'
import type { Demand } from './demand-api'
import { demandStateLabel, reasonLabel } from './demand-labels'

export function DemandSummaryCard({ demand }: { demand: Demand }) {
  const activeReasons = demand.reasonCounts.filter((item) => item.count > 0)
  const open = demand.status === 'OPEN'

  return (
    <article className="demand-summary-card">
      <div className="demand-summary-meta">
        <StatusBadge tone={open ? 'success' : 'neutral'}>
          {demandStateLabel(demand)}
        </StatusBadge>
        <StatusBadge>{demand.academicYear}</StatusBadge>
      </div>
      <div className="demand-summary-heading">
        <div>
          <h2>{demand.school.name}</h2>
          <p>
            {demand.neighborhood.name}, {demand.neighborhood.districtName}
          </p>
        </div>
      </div>
      <div className="demand-summary-participation">
        <p>
          <strong>{demand.supporterCount}</strong>
          <span>veli bu ihtiyacı destekliyor</span>
        </p>
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
        <time dateTime={demand.updatedAt}>
          {formatDemandDate(demand.updatedAt)} güncellendi
        </time>
        <Link
          className="button-link"
          to={`/demands/${demand.id}`}
          viewTransition
        >
          Talebi görüntüle
        </Link>
      </footer>
    </article>
  )
}

function formatDemandDate(value: string) {
  return new Intl.DateTimeFormat('tr-TR', {
    day: 'numeric',
    month: 'short',
  }).format(new Date(value))
}

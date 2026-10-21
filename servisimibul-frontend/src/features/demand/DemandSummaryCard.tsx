import { Link } from 'react-router-dom'
import type { Demand } from './demand-api'
import { reasonLabel } from './demand-labels'

export function DemandSummaryCard({ demand }: { demand: Demand }) {
  const activeReasons = demand.reasonCounts.filter((item) => item.count > 0)

  return (
    <article className="demand-summary-card">
      <div className="demand-summary-heading">
        <div>
          <h2>{demand.school.name}</h2>
          <p>
            {demand.neighborhood.districtName} · {demand.neighborhood.name}
          </p>
        </div>
        <span className="status-pill neutral">{demand.academicYear}</span>
      </div>
      <dl className="demand-counts">
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
      {activeReasons.length > 0 && (
        <div className="demand-reason-summary">
          <h3>Paylaşılan ihtiyaçlar</h3>
          <ul>
            {activeReasons.map((item) => (
              <li key={item.reason}>
                <span>{reasonLabel(item.reason)}</span>
                <strong>{item.count}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
      <Link className="button-link" to={`/demands/${demand.id}`} viewTransition>
        Talebi görüntüle
      </Link>
    </article>
  )
}

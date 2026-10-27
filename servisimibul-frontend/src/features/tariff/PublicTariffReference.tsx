import { useEffect, useState } from 'react'
import { ApiError } from '../../api/client'
import { formatKurus, getTariff, type Tariff } from './tariff-api'

export function PublicTariffReference({
  provinceCode,
}: {
  provinceCode?: string
}) {
  const [tariff, setTariff] = useState<Tariff>()
  const [state, setState] = useState<'idle' | 'loading' | 'missing' | 'error'>(
    provinceCode ? 'loading' : 'idle',
  )

  useEffect(() => {
    if (!provinceCode) return

    let current = true
    void getTariff(provinceCode)
      .then((response) => {
        if (!current) return
        setTariff(response)
        setState('idle')
      })
      .catch((reason: unknown) => {
        if (!current) return
        setState(
          reason instanceof ApiError &&
            reason.problem.code === 'tariff_not_found'
            ? 'missing'
            : 'error',
        )
      })

    return () => {
      current = false
    }
  }, [provinceCode])

  if (!provinceCode) return null

  return (
    <section className="tariff-reference" aria-live="polite">
      <div className="section-heading">
        <div>
          <h2>Okul servisi ücret tarifesi</h2>
          <p>
            Kesin ücret için işletmeciyle görüşün.
          </p>
        </div>
      </div>

      {state === 'loading' && (
        <div className="inline-loading" role="status">
          <span className="loading-dot" aria-hidden="true" />
          Tarife yükleniyor…
        </div>
      )}
      {state === 'missing' && (
        <div className="empty-state">
          <h3>Bu il için henüz ücret tarifesi yok.</h3>
          
        </div>
      )}
      {state === 'error' && (
        <div className="form-error" role="alert">
          Ücret tarifesini şu anda gösteremiyoruz. Daha sonra tekrar deneyin.
        </div>
      )}
      {tariff && <TariffDetails tariff={tariff} />}
    </section>
  )
}

function TariffDetails({ tariff }: { tariff: Tariff }) {
  return (
    <div className="tariff-card">
      <div className="tariff-meta">
        <div>
          <strong>{tariff.provinceName}</strong>
          <span>{tariff.academicYear}</span>
        </div>
        <div>
          <strong>{tariff.authority}</strong>
          <span>
            {formatDate(tariff.effectiveFrom)}–{formatDate(tariff.effectiveTo)}
          </span>
        </div>
      </div>
      <div className="tariff-band-list" aria-label="Mesafeye göre ücretler">
        {tariff.bands.map((band) => (
          <div key={`${band.minDistanceKm}-${band.maxDistanceKm ?? 'plus'}`}>
            <span>
              {formatDistance(band.minDistanceKm, band.maxDistanceKm)}
            </span>
            <strong>{formatKurus(band.amountKurus)}</strong>
          </div>
        ))}
      </div>
      <p className="tariff-disclaimer">
        Ücret, servis mesafesine ve geçerli tarifeye göre belirlenir.
      </p>
      <a href={tariff.officialSourceUrl} rel="noreferrer" target="_blank">
        {tariff.sourceTitle} kaynağını aç
      </a>
    </div>
  )
}

function formatDistance(minimum: number, maximum: number | null): string {
  return maximum === null
    ? `${minimum} km ve üzeri`
    : `${minimum}–${maximum} km`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR').format(new Date(`${value}T00:00:00`))
}

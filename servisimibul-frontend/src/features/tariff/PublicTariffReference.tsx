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
  const [resolvedProvinceCode, setResolvedProvinceCode] = useState<string>()
  const [requestKey, setRequestKey] = useState(0)

  useEffect(() => {
    if (!provinceCode) return

    let current = true
    void getTariff(provinceCode)
      .then((response) => {
        if (!current) return
        setTariff(response)
        setResolvedProvinceCode(provinceCode)
        setState('idle')
      })
      .catch((reason: unknown) => {
        if (!current) return
        setTariff(undefined)
        setResolvedProvinceCode(provinceCode)
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
  }, [provinceCode, requestKey])

  if (!provinceCode) return null
  const visibleState = resolvedProvinceCode === provinceCode ? state : 'loading'
  const visibleTariff =
    resolvedProvinceCode === provinceCode ? tariff : undefined
  const retryTariff = () => {
    setTariff(undefined)
    setState('loading')
    setRequestKey((value) => value + 1)
  }

  return (
    <section
      aria-busy={visibleState === 'loading'}
      className="tariff-reference"
      id="resmi-tarife"
    >
      <div className="section-heading">
        <div>
          <h2>Okul servisi ücret tarifesi</h2>
          <p>Kesin ücret için işletmeciyle görüşün.</p>
        </div>
      </div>

      {visibleState === 'loading' && (
        <div className="inline-loading" role="status">
          <span className="loading-dot" aria-hidden="true" />
          Tarife yükleniyor…
        </div>
      )}
      {visibleState === 'missing' && (
        <div className="empty-state">
          <h3>Bu il için henüz ücret tarifesi yok.</h3>
          <button
            className="secondary-button"
            onClick={retryTariff}
            type="button"
          >
            Tarifeyi yeniden dene
          </button>
        </div>
      )}
      {visibleState === 'error' && (
        <div className="state-panel tariff-load-error" role="alert">
          <div>
            <p>
              Ücret tarifesini şu anda gösteremiyoruz. Daha sonra tekrar
              deneyin.
            </p>
          </div>
          <button
            className="secondary-button"
            onClick={retryTariff}
            type="button"
          >
            Tarifeyi yeniden dene
          </button>
        </div>
      )}
      {visibleTariff && <TariffDetails tariff={visibleTariff} />}
    </section>
  )
}

export function TariffDetails({ tariff }: { tariff: Tariff }) {
  const featuredNotes = selectFeaturedNotes(tariff.notes ?? [])

  return (
    <div className="tariff-card">
      <div className="tariff-card-header">
        <div>
          <strong>
            {tariff.provinceName} · {tariff.academicYear}
          </strong>
          <span>{tariff.authority}</span>
        </div>
        <a href={tariff.officialSourceUrl} rel="noreferrer" target="_blank">
          Resmî belgeyi aç
          <span className="sr-only"> (yeni sekmede)</span>
        </a>
      </div>

      <dl className="tariff-meta">
        <div>
          <dt>Yürürlük</dt>
          <dd>
            {tariff.effectiveTo === null
              ? `${formatDate(tariff.effectiveFrom)} tarihinden itibaren`
              : `${formatDate(tariff.effectiveFrom)}–${formatDate(tariff.effectiveTo)}`}
          </dd>
        </div>
        <div>
          <dt>Sürüm</dt>
          <dd>{tariff.version}</dd>
        </div>
        <div>
          <dt>Kaynak</dt>
          <dd>{tariff.sourceTitle}</dd>
        </div>
      </dl>

      <div
        aria-label="Mesafeye göre aylık ve yıllık resmî ücretler"
        className="tariff-table-scroll"
        role="region"
        tabIndex={0}
      >
        <table className="tariff-table">
          <caption>Mesafe bantlarına göre azami ücretler</caption>
          <thead>
            <tr>
              <th scope="col">Mesafe</th>
              <th scope="col">Aylık</th>
              <th scope="col">Yıllık</th>
            </tr>
          </thead>
          <tbody>
            {tariff.bands.map((band) => (
              <tr key={`${band.minDistanceKm}-${band.maxDistanceKm ?? 'plus'}`}>
                <th scope="row">
                  {formatDistance(band.minDistanceKm, band.maxDistanceKm)}
                </th>
                <td>{formatKurus(band.amountKurus)}</td>
                <td>
                  {band.annualAmountKurus == null ? (
                    <>
                      <span aria-hidden="true">—</span>
                      <span className="sr-only">
                        Yıllık tutar kaynakta belirtilmemiş
                      </span>
                    </>
                  ) : (
                    formatKurus(band.annualAmountKurus)
                  )}
                </td>
              </tr>
            ))}
            {tariff.additionalKilometerRule && (
              <tr className="tariff-additional-rule">
                <th scope="row">
                  {tariff.additionalKilometerRule.startsAfterDistanceKm} km
                  üzerindeki her ek km
                </th>
                <td>
                  +
                  {formatKurus(
                    tariff.additionalKilometerRule
                      .monthlyAmountPerKilometerKurus,
                  )}
                </td>
                <td>
                  <span aria-hidden="true">—</span>
                  <span className="sr-only">
                    Yıllık tutar kaynakta belirtilmemiş
                  </span>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="tariff-guidance">
        <p>
          Ücret, servis mesafesine ve geçerli tarifeye göre belirlenir. Tutarlar
          resmî azami referanstır; mahalle seçimi mesafeyi belirlemez.
        </p>
      </div>

      {featuredNotes.length > 0 && (
        <div className="tariff-featured-notes">
          <h3>Ücreti etkileyebilen koşullar</h3>
          <ul>
            {featuredNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {(tariff.notes?.length ?? 0) > 0 && (
        <details className="tariff-all-notes">
          <summary>
            Kaynaktaki tüm koşulları göster ({tariff.notes?.length})
          </summary>
          <ol>
            {tariff.notes?.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ol>
        </details>
      )}
    </div>
  )
}

function selectFeaturedNotes(notes: string[]): string[] {
  const patterns = [/azami/i, /rehber personel ücreti/i, /kardeş/i]
  return patterns
    .map((pattern) => notes.find((note) => pattern.test(note)))
    .filter((note): note is string => note !== undefined)
}

function formatDistance(minimum: number, maximum: number | null): string {
  return maximum === null
    ? `${minimum} km ve üzeri`
    : `${minimum}–${maximum} km`
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('tr-TR').format(new Date(`${value}T00:00:00`))
}

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
          <p>
            Mesafe kademelerine göre azami tutarları inceleyin. Kesin ücret ve
            hizmet koşulları için işletmeciyle görüşün.
          </p>
        </div>
      </div>

      {visibleState === 'loading' && (
        <div className="tariff-state-card tariff-loading-state" role="status">
          <strong>Resmî tarife bilgisi yükleniyor…</strong>
          <span className="tariff-skeleton-line tariff-skeleton-wide" />
          <span className="tariff-skeleton-line" />
          <span className="tariff-skeleton-line tariff-skeleton-short" />
        </div>
      )}
      {visibleState === 'missing' && (
        <div className="tariff-state-card tariff-missing-state" role="status">
          <h3>Bu il için henüz ücret tarifesi yok.</h3>
          <p>Resmî bir tarife kaydı olmadığında ücret tutarı göstermiyoruz.</p>
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
        <div className="tariff-state-card tariff-load-error" role="alert">
          <div>
            <h3>Tarife bilgisi şu anda yüklenemedi</h3>
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
      {visibleTariff && <TariffDetails tariff={visibleTariff} periodSwitcher />}
    </section>
  )
}

export function TariffDetails({
  tariff,
  periodSwitcher = false,
}: {
  tariff: Tariff
  periodSwitcher?: boolean
}) {
  const [period, setPeriod] = useState<'monthly' | 'annual'>('monthly')
  const featuredNotes = selectFeaturedNotes(tariff.notes ?? [])
  const hasAnnualAmounts = tariff.bands.every(
    (band) => band.annualAmountKurus != null,
  )
  const visiblePeriod =
    period === 'annual' && hasAnnualAmounts ? period : 'monthly'

  return (
    <div className="tariff-card">
      <div className="tariff-card-header">
        <div>
          <strong>UKOME azami servis tarifesi</strong>
          <span>
            {tariff.academicYear} · {tariff.provinceName}
          </span>
          <span>{tariff.authority}</span>
        </div>
        {periodSwitcher && (
          <div
            aria-label="Tarife dönemi"
            className="tariff-period-switch"
            role="group"
          >
            <button
              aria-pressed={visiblePeriod === 'monthly'}
              onClick={() => setPeriod('monthly')}
              type="button"
            >
              Aylık
            </button>
            <button
              aria-describedby={
                hasAnnualAmounts ? undefined : 'annual-unavailable'
              }
              aria-pressed={visiblePeriod === 'annual'}
              disabled={!hasAnnualAmounts}
              onClick={() => setPeriod('annual')}
              type="button"
            >
              Yıllık
            </button>
            {!hasAnnualAmounts && (
              <span className="tariff-visually-hidden" id="annual-unavailable">
                Yıllık tutarlar resmî kaynakta belirtilmemiş
              </span>
            )}
          </div>
        )}
      </div>

      <div
        aria-label={
          periodSwitcher
            ? `Mesafeye göre ${visiblePeriod === 'monthly' ? 'aylık' : 'yıllık'} resmî ücretler`
            : 'Mesafeye göre aylık ve yıllık resmî ücretler'
        }
        className="tariff-table-scroll"
        role="region"
        tabIndex={0}
      >
        <table className="tariff-table">
          <caption className="tariff-visually-hidden">
            Mesafe bantlarına göre azami ücretler
          </caption>
          <thead>
            <tr>
              <th scope="col">Tek yön mesafe</th>
              <th scope="col">
                {periodSwitcher && visiblePeriod === 'annual'
                  ? 'Yıllık azami'
                  : 'Aylık azami'}
              </th>
              {!periodSwitcher && <th scope="col">Yıllık azami</th>}
            </tr>
          </thead>
          <tbody>
            {tariff.bands.map((band, index) => (
              <tr key={`${band.minDistanceKm}-${band.maxDistanceKm ?? 'plus'}`}>
                <th scope="row">
                  <span
                    className={
                      index === 0 ? 'tariff-row-dot featured' : 'tariff-row-dot'
                    }
                    aria-hidden="true"
                  />
                  {formatDistance(band.minDistanceKm, band.maxDistanceKm)}
                </th>
                <td>
                  {formatKurus(
                    !periodSwitcher || visiblePeriod === 'monthly'
                      ? band.amountKurus
                      : band.annualAmountKurus!,
                  )}
                </td>
                {!periodSwitcher && (
                  <td>
                    {band.annualAmountKurus == null ? (
                      <>
                        <span aria-hidden="true">—</span>
                        <span className="tariff-visually-hidden">
                          Yıllık tutar kaynakta belirtilmemiş
                        </span>
                      </>
                    ) : (
                      formatKurus(band.annualAmountKurus)
                    )}
                  </td>
                )}
              </tr>
            ))}
            {tariff.additionalKilometerRule && visiblePeriod === 'monthly' && (
              <tr className="tariff-additional-rule">
                <th scope="row">
                  {tariff.additionalKilometerRule.startsAfterDistanceKm} km
                  üzeri
                </th>
                <td>
                  Her km için +
                  {formatKurus(
                    tariff.additionalKilometerRule
                      .monthlyAmountPerKilometerKurus,
                  )}
                </td>
                {!periodSwitcher && (
                  <td>
                    <span aria-hidden="true">—</span>
                    <span className="tariff-visually-hidden">
                      Yıllık tutar kaynakta belirtilmemiş
                    </span>
                  </td>
                )}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {tariff.additionalKilometerRule &&
        periodSwitcher &&
        visiblePeriod === 'annual' && (
          <p className="tariff-additional-note">
            {tariff.additionalKilometerRule.startsAfterDistanceKm} km üzerindeki
            ek kilometre ücreti kaynakta yalnızca aylık olarak belirtilmiştir: +
            {formatKurus(
              tariff.additionalKilometerRule.monthlyAmountPerKilometerKurus,
            )}{' '}
            / km.
          </p>
        )}

      <div className="tariff-guidance">
        <p>
          Tutarlar resmî azami referanstır; kişisel güzergâh için kesin fiyat
          değildir. Mesafe ve hizmet ayrıntılarını işletmeciyle doğrulayın.
        </p>
      </div>

      <div className="tariff-source-row">
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
        <a href={tariff.officialSourceUrl} rel="noreferrer" target="_blank">
          Resmî belgeyi aç
          <span className="tariff-visually-hidden"> (yeni sekmede)</span>
        </a>
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

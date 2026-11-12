import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import {
  findOperators,
  type OperatorPage,
  type PublicOperator,
} from '../discovery/discovery-api'
import {
  listDemands,
  type DemandFilters,
  type DemandPage,
  type DemandListStatus,
} from './demand-api'
import {
  DemandLocationPicker,
  type DemandLocationSelection,
  type InitialDemandLocation,
} from './DemandLocationPicker'
import { DemandSummaryCard } from './DemandSummaryCard'

type DemandSort = DemandFilters['sort']

const statusFilters: Array<{
  value: DemandListStatus
  label: string
  title: string
  empty: string
  countLabel: string
}> = [
  {
    value: 'ALL',
    label: 'Tümü',
    title: 'Tüm talepler',
    empty: 'Bu seçim için listelenecek talep yok',
    countLabel: 'talep',
  },
  {
    value: 'OPEN',
    label: 'Açık',
    title: 'Açık servis talepleri',
    empty: 'Bu seçim için açık talep yok',
    countLabel: 'açık talep',
  },
  {
    value: 'FULFILLED',
    label: 'Karşılandı',
    title: 'Karşılanan talepler',
    empty: 'Bu seçim için karşılanan talep yok',
    countLabel: 'karşılanan talep',
  },
  {
    value: 'CLOSED',
    label: 'Kapalı',
    title: 'Hareketsizlik nedeniyle kapanan talepler',
    empty: 'Bu seçim için kapanan talep yok',
    countLabel: 'kapalı talep',
  },
]

export function DemandBoardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [pickerKey, setPickerKey] = useState(0)
  const [selection, setSelection] = useState<DemandLocationSelection>()
  const [hasLocationDraft, setHasLocationDraft] = useState(false)
  const [appliedSelection, setAppliedSelection] =
    useState<DemandLocationSelection>()
  const [academicYear, setAcademicYear] = useState(
    searchParams.get('academicYear') ?? '',
  )
  const [appliedAcademicYear, setAppliedAcademicYear] = useState(
    searchParams.get('academicYear') ?? '',
  )
  const [sort, setSort] = useState<DemandSort>('newest')
  const [status, setStatus] = useState<DemandListStatus>('OPEN')
  // Every load reads the latest status without threading it through each caller.
  const statusRef = useRef<DemandListStatus>('OPEN')
  const [demands, setDemands] = useState<DemandPage>()
  const [loadingDemands, setLoadingDemands] = useState(true)
  const [demandError, setDemandError] = useState<string>()
  const [filterError, setFilterError] = useState<string>()
  const [operators, setOperators] = useState<OperatorPage>()
  const [operatorPage, setOperatorPage] = useState(0)
  const [checkingOperators, setCheckingOperators] = useState(false)
  const [operatorError, setOperatorError] = useState<string>()
  const [returnNotice, setReturnNotice] = useState<string>()
  const demandRequest = useRef(0)
  const operatorRequest = useRef(0)
  const hydratedInitialSelection = useRef(false)

  const [initialLocation] = useState<InitialDemandLocation | undefined>(() => {
    const schoolId = searchParams.get('schoolId')
    const pickupDistrictId = Number(searchParams.get('pickupDistrictId'))
    const neighborhoodId = Number(searchParams.get('neighborhoodId'))
    return schoolId && pickupDistrictId > 0 && neighborhoodId > 0
      ? { schoolId, pickupDistrictId, neighborhoodId }
      : undefined
  })
  const initialLocationRef = useRef(initialLocation)
  const initialHydrationFailed = useRef(false)

  const loadDemands = useCallback(
    async (
      nextSelection: DemandLocationSelection | undefined,
      nextYear: string,
      nextSort: DemandSort,
      page: number,
    ) => {
      const request = ++demandRequest.current
      setLoadingDemands(true)
      setDemandError(undefined)
      try {
        const result = await listDemands({
          status: statusRef.current,
          schoolId: nextSelection?.school.id,
          neighborhoodId: nextSelection?.neighborhood.id,
          academicYear: nextYear || undefined,
          sort: nextSort,
          page,
        })
        if (request === demandRequest.current) setDemands(result)
      } catch {
        if (request === demandRequest.current) {
          setDemands(undefined)
          setDemandError('Bağlantıyı kontrol edip tekrar deneyin.')
        }
      } finally {
        if (request === demandRequest.current) setLoadingDemands(false)
      }
    },
    [],
  )

  useEffect(() => {
    const timer = initialLocationRef.current
      ? undefined
      : window.setTimeout(
          () => void loadDemands(undefined, appliedAcademicYear, sort, 0),
          0,
        )
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      demandRequest.current += 1
      operatorRequest.current += 1
    }
    // Initial board load intentionally ignores later filter edits until applied.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadDemands])

  const resetOperatorResults = useCallback(() => {
    operatorRequest.current += 1
    setOperators(undefined)
    setOperatorPage(0)
    setCheckingOperators(false)
    setOperatorError(undefined)
  }, [])

  const handleSelectionChange = useCallback(
    (nextSelection?: DemandLocationSelection) => {
      setSelection(nextSelection)
      if (nextSelection) setHasLocationDraft(false)
      resetOperatorResults()
      if (
        !nextSelection &&
        initialLocation &&
        !hydratedInitialSelection.current &&
        !initialHydrationFailed.current
      ) {
        // An invalid shared link must not leave the board stuck loading.
        initialHydrationFailed.current = true
        setAppliedSelection(undefined)
        setReturnNotice(
          'Seçtiğiniz okul veya mahalle artık bulunamıyor. Yeniden seçin.',
        )
        setSearchParams({}, { replace: true })
        void loadDemands(undefined, appliedAcademicYear, sort, 0)
      }
      if (
        nextSelection &&
        initialLocation &&
        !hydratedInitialSelection.current &&
        !initialHydrationFailed.current
      ) {
        hydratedInitialSelection.current = true
        setAppliedSelection(nextSelection)
        void loadDemands(nextSelection, appliedAcademicYear, sort, 0)
        void checkOperators(nextSelection, 0)
      }
    },
    [
      appliedAcademicYear,
      initialLocation,
      loadDemands,
      resetOperatorResults,
      setSearchParams,
      sort,
    ],
  )

  function validAcademicYear(value: string) {
    if (!value) return true
    const match = /^(\d{4})-(\d{4})$/.exec(value)
    return Boolean(match && Number(match[2]) === Number(match[1]) + 1)
  }

  async function applyFilters() {
    const year = academicYear.trim()
    if (!validAcademicYear(year)) {
      setFilterError('Eğitim yılını 2026-2027 biçiminde ve ardışık girin.')
      return
    }
    if (hasLocationDraft && !selection) {
      setFilterError(
        'Okul, servis alınacak ilçe ve mahalle seçimlerini tamamlayın.',
      )
      return
    }
    setFilterError(undefined)
    setAppliedSelection(selection)
    resetOperatorResults()
    setReturnNotice(undefined)
    hydratedInitialSelection.current = true

    const parameters = new URLSearchParams()
    if (selection) {
      parameters.set('schoolId', selection.school.id)
      parameters.set('pickupDistrictId', String(selection.pickupDistrict.id))
      parameters.set('neighborhoodId', String(selection.neighborhood.id))
    }
    if (year) parameters.set('academicYear', year)
    setSearchParams(parameters, { replace: true })
    setAppliedAcademicYear(year)
    const demandLoad = loadDemands(selection, year, sort, 0)
    if (selection) void checkOperators(selection, 0)
    await demandLoad
  }

  async function changeSort(nextSort: DemandSort) {
    setSort(nextSort)
    await loadDemands(appliedSelection, appliedAcademicYear, nextSort, 0)
  }

  async function changeStatus(nextStatus: DemandListStatus) {
    if (nextStatus === statusRef.current) return
    statusRef.current = nextStatus
    setStatus(nextStatus)
    await loadDemands(appliedSelection, appliedAcademicYear, sort, 0)
  }

  async function changeDemandPage(page: number) {
    await loadDemands(appliedSelection, appliedAcademicYear, sort, page)
  }

  function clearFilters() {
    setPickerKey((key) => key + 1)
    setSelection(undefined)
    setHasLocationDraft(false)
    setAppliedSelection(undefined)
    setAcademicYear('')
    setAppliedAcademicYear('')
    setSort('newest')
    statusRef.current = 'OPEN'
    setStatus('OPEN')
    setFilterError(undefined)
    setReturnNotice(undefined)
    resetOperatorResults()
    setSearchParams({}, { replace: true })
    void loadDemands(undefined, '', 'newest', 0)
  }

  async function checkOperators(
    nextSelection: DemandLocationSelection,
    page: number,
  ) {
    const request = ++operatorRequest.current
    setCheckingOperators(true)
    setOperatorError(undefined)
    try {
      const result = await findOperators(
        nextSelection.school.id,
        nextSelection.neighborhood.id,
        page,
      )
      if (request === operatorRequest.current) {
        setOperators(result)
        setOperatorPage(page)
      }
    } catch {
      if (request === operatorRequest.current) {
        setOperators(undefined)
        setOperatorError(
          'Mevcut servisler şu anda yüklenemiyor. Tekrar deneyin.',
        )
      }
    } finally {
      if (request === operatorRequest.current) setCheckingOperators(false)
    }
  }

  const statusFilter =
    statusFilters.find((item) => item.value === status) ?? statusFilters[1]!
  const resultsMatchDraft =
    !hasLocationDraft &&
    sameLocation(selection, appliedSelection) &&
    academicYear.trim() === appliedAcademicYear
  const createPath = selection
    ? createDemandPath(selection, academicYear.trim())
    : undefined

  return (
    <section className="demand-page">
      <nav className="demand-breadcrumb" aria-label="Sayfa yolu">
        <Link to="/" viewTransition>
          Ana sayfa
        </Link>
        <span aria-hidden="true">/</span>
        <span>Talep panosu</span>
      </nav>

      <header className="demand-intro">
        <div>
          <h1>Servis talep panosu</h1>
          <p>
            Okul ve servis alınacak mahalledeki gerçek ihtiyacı görün veya yeni
            bir talep oluşturun.
          </p>
        </div>
        {createPath ? (
          <Link
            className="button-link demand-create-shortcut"
            to={createPath}
            viewTransition
          >
            Yeni talep oluştur
          </Link>
        ) : (
          <a
            className="button-link demand-create-shortcut"
            href="#demand-filters"
          >
            Yeni talep oluştur
          </a>
        )}
      </header>

      <aside className="demand-board-notice" aria-label="Talep panosu bilgisi">
        <span className="demand-notice-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <circle cx="9" cy="8" r="3" />
            <path d="M3.5 19v-1.4c0-2.5 2.1-4.6 4.6-4.6h1.8c2.5 0 4.6 2.1 4.6 4.6V19M16 6.5a2.7 2.7 0 0 1 0 5.2M16.8 14c2.1.4 3.7 2.2 3.7 4.4V19" />
          </svg>
        </span>
        <div>
          <strong>Talep oluşturmak rezervasyon değildir.</strong>
          <p>
            Bu pano benzer servis ihtiyaçlarını görünür kılar. Hizmet kapsamını
            işletmeciyle ayrıca teyit edin.
          </p>
        </div>
        {demands && !loadingDemands && !demandError && (
          <p className="demand-board-total">
            <strong>{demands.totalElements}</strong>
            <span>{statusFilter.countLabel}</span>
          </p>
        )}
      </aside>

      <section
        className="demand-filter-panel"
        id="demand-filters"
        aria-labelledby="demand-filter-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="demand-filter-title">Okul ve mahalleye göre bulun</h2>
            <p>Okulun konumu ile servis alınacak konumu ayrı ayrı seçin.</p>
          </div>
          <button className="text-button" type="button" onClick={clearFilters}>
            Filtreleri temizle
          </button>
        </div>

        <DemandLocationPicker
          key={pickerKey}
          initialLocation={initialLocation}
          onLocationDraftChange={setHasLocationDraft}
          onSelectionChange={handleSelectionChange}
        />

        <div className="demand-board-controls">
          <label className="form-field">
            Eğitim yılı
            <input
              inputMode="numeric"
              placeholder="Güncel yıl veya 2026-2027"
              value={academicYear}
              aria-invalid={Boolean(filterError)}
              aria-describedby={filterError ? 'academic-year-error' : undefined}
              onChange={(event) => setAcademicYear(event.target.value)}
            />
          </label>
          <label className="form-field">
            Sıralama
            <select
              value={sort}
              onChange={(event) =>
                void changeSort(event.target.value as DemandSort)
              }
            >
              <option value="newest">En yeni talepler</option>
              <option value="most-supported">En çok desteklenenler</option>
            </select>
          </label>
          <button
            className="primary-button"
            disabled={loadingDemands}
            type="button"
            onClick={() => void applyFilters()}
          >
            {loadingDemands ? 'Talepler yükleniyor…' : 'Talepleri göster'}
          </button>
        </div>
        {filterError && (
          <small className="field-error" id="academic-year-error" role="alert">
            {filterError}
          </small>
        )}
      </section>

      {returnNotice && (
        <div className="status-banner pending" role="status">
          {returnNotice}
        </div>
      )}

      {!resultsMatchDraft && (
        <div className="status-banner pending" role="status">
          Filtre seçiminiz değişti. Aşağıdaki sonuçlar son uygulanan filtrelere
          aittir. Güncel sonuçlar için Talepleri göster&apos;i seçin.
        </div>
      )}

      <div className="demand-board-layout">
        <div className="demand-results-stack">
          <section className="demand-board-results" aria-live="polite">
            <div className="section-heading">
              <div>
                <h2>{statusFilter.title}</h2>
                <p>
                  Destek sayıları yalnızca etkin veli katılımlarını gösterir.
                </p>
              </div>
              {demands && !loadingDemands && !demandError && (
                <span className="count-badge">
                  {demands.totalElements} {statusFilter.countLabel}
                </span>
              )}
            </div>
            <div
              aria-label="Talep durumuna göre filtrele"
              className="demand-status-filter"
              role="group"
            >
              {statusFilters.map((item) => (
                <button
                  aria-pressed={status === item.value}
                  key={item.value}
                  onClick={() => void changeStatus(item.value)}
                  type="button"
                >
                  {item.label}
                </button>
              ))}
            </div>

            {loadingDemands && <DemandListSkeleton />}
            {demandError && (
              <div className="demand-load-error" role="alert">
                <div>
                  <strong>Talepler yüklenemedi</strong>
                  <p>{demandError}</p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={() =>
                    void loadDemands(
                      appliedSelection,
                      appliedAcademicYear,
                      sort,
                      demands?.page ?? 0,
                    )
                  }
                >
                  Tekrar dene
                </button>
              </div>
            )}
            {!loadingDemands && demands?.content.length === 0 && (
              <div className="empty-state demand-empty-state">
                <h3>{statusFilter.empty}</h3>
                <p>
                  Yeni talebe geçmeden önce mevcut servis işletmecilerini
                  kontrol edebilirsiniz.
                </p>
                {createPath && resultsMatchDraft ? (
                  <Link className="button-link" to={createPath} viewTransition>
                    Yeni talep oluştur
                  </Link>
                ) : !createPath ? (
                  <a className="button-link" href="#demand-filters">
                    Okul ve mahalle seç
                  </a>
                ) : null}
              </div>
            )}
            {!loadingDemands && demands && demands.content.length > 0 && (
              <div className="demand-summary-list">
                {demands.content.map((demand) => (
                  <DemandSummaryCard demand={demand} key={demand.id} />
                ))}
              </div>
            )}
            {demands && demands.totalPages > 1 && (
              <div className="pagination">
                <button
                  className="secondary-button"
                  disabled={demands.page === 0 || loadingDemands}
                  type="button"
                  onClick={() => void changeDemandPage(demands.page - 1)}
                >
                  Önceki sayfa
                </button>
                <span>
                  Sayfa {demands.page + 1} / {demands.totalPages}
                </span>
                <button
                  className="secondary-button"
                  disabled={
                    demands.page + 1 >= demands.totalPages || loadingDemands
                  }
                  type="button"
                  onClick={() => void changeDemandPage(demands.page + 1)}
                >
                  Sonraki sayfa
                </button>
              </div>
            )}
          </section>

          {appliedSelection && (
            <section className="demand-board-results" aria-live="polite">
              <div className="section-heading">
                <div>
                  <h2>Eşleşen servis işletmecileri</h2>
                  <p>
                    Seçtiğiniz okul ve mahalle için görünür işletmeciler ayrı
                    olarak yüklenir.
                  </p>
                </div>
                {createPath && resultsMatchDraft ? (
                  <Link className="button-link" to={createPath} viewTransition>
                    Yeni talep oluştur
                  </Link>
                ) : !createPath ? (
                  <a className="button-link" href="#demand-filters">
                    Okul ve mahalle seç
                  </a>
                ) : null}
              </div>
              {checkingOperators && (
                <p className="inline-loading" role="status">
                  <span className="loading-dot" aria-hidden="true" /> Servisler
                  yükleniyor…
                </p>
              )}
              {operatorError && (
                <div className="demand-load-error" role="alert">
                  <p>{operatorError}</p>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() =>
                      void checkOperators(appliedSelection, operatorPage)
                    }
                  >
                    Tekrar dene
                  </button>
                </div>
              )}
              {!checkingOperators && operators && (
                <OperatorCheckResult
                  operators={operators}
                  onPageChange={(page) =>
                    void checkOperators(appliedSelection, page)
                  }
                />
              )}
            </section>
          )}
        </div>

        <aside
          className="demand-board-guidance"
          aria-label="Talep panosu rehberi"
        >
          <section>
            <span className="demand-guidance-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M12 3 5.5 5.8v5.6c0 4.4 2.7 7.9 6.5 9.6 3.8-1.7 6.5-5.2 6.5-9.6V5.8L12 3Z" />
                <path d="m9.2 12 1.8 1.8 3.9-4" />
              </svg>
            </span>
            <h3>Güvenli ve açık iletişim</h3>
            <p>
              Öğrenci adı, ev adresi, telefon veya sağlık bilgisi paylaşmayın.
            </p>
          </section>
          <section className="demand-guidance-time">
            <span className="demand-guidance-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <rect x="4" y="5.5" width="16" height="14" rx="2" />
                <path d="M8 3v5M16 3v5M4 10h16M8 14h2M14 14h2" />
              </svg>
            </span>
            <h3>Hizmet saatini belirtin</h3>
            <p>
              Talep oluştururken sabah gidiş veya öğleden sonra dönüş
              ihtiyacınızı seçin.
            </p>
          </section>
        </aside>
      </div>
    </section>
  )
}

function createDemandPath(
  selection: DemandLocationSelection,
  academicYear: string,
) {
  const parameters = new URLSearchParams({
    schoolId: selection.school.id,
    pickupDistrictId: String(selection.pickupDistrict.id),
    neighborhoodId: String(selection.neighborhood.id),
  })
  if (academicYear) parameters.set('academicYear', academicYear)
  return `/demands/new?${parameters.toString()}`
}

function sameLocation(
  first?: DemandLocationSelection,
  second?: DemandLocationSelection,
) {
  if (!first || !second) return first === second
  return (
    first.school.id === second.school.id &&
    first.pickupDistrict.id === second.pickupDistrict.id &&
    first.neighborhood.id === second.neighborhood.id
  )
}

function OperatorCheckResult({
  operators,
  onPageChange,
}: {
  operators: OperatorPage
  onPageChange: (page: number) => void
}) {
  return (
    <div className="operator-check-result" aria-live="polite">
      <div className="operator-check-heading">
        <h3>
          {operators.totalElements > 0
            ? `${operators.totalElements} mevcut servis bulundu`
            : 'Görünür servis bulunamadı'}
        </h3>
        <p>
          Listelenmesi servis garantisi değildir. Ücret ve güzergâh için
          işletmeciyle görüşün.
        </p>
      </div>
      {operators.content.length > 0 && (
        <ul className="operator-check-list">
          {operators.content.map((operator) => (
            <OperatorCheckItem key={operator.operatorId} operator={operator} />
          ))}
        </ul>
      )}
      {operators.totalPages > 1 && (
        <div className="pagination">
          <button
            className="secondary-button"
            disabled={operators.page === 0}
            type="button"
            onClick={() => onPageChange(operators.page - 1)}
          >
            Önceki servisler
          </button>
          <span>
            Sayfa {operators.page + 1} / {operators.totalPages}
          </span>
          <button
            className="secondary-button"
            disabled={operators.page + 1 >= operators.totalPages}
            type="button"
            onClick={() => onPageChange(operators.page + 1)}
          >
            Sonraki servisler
          </button>
        </div>
      )}
    </div>
  )
}

function OperatorCheckItem({ operator }: { operator: PublicOperator }) {
  return (
    <li>
      <div>
        <strong>{operator.businessName || 'İsimsiz servis işletmecisi'}</strong>
        {operator.description && <span>{operator.description}</span>}
      </div>
      <a href={`tel:${operator.contactPhone}`}>{operator.contactPhone}</a>
    </li>
  )
}

function DemandListSkeleton() {
  return (
    <div className="demand-list-skeleton" role="status">
      <span>Talepler yükleniyor…</span>
      <div aria-hidden="true">
        <i />
        <i />
      </div>
    </div>
  )
}

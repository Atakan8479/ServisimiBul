import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { ApiError } from '../../api/client'
import { currentUser } from '../auth/auth-api'
import {
  findOperators,
  type OperatorPage,
  type PublicOperator,
} from '../discovery/discovery-api'
import {
  createDemand,
  listDemands,
  type DemandFilters,
  type DemandPage,
  type SupportValues,
} from './demand-api'
import {
  DemandLocationPicker,
  type DemandLocationSelection,
  type InitialDemandLocation,
} from './DemandLocationPicker'
import { DemandSummaryCard } from './DemandSummaryCard'
import { DemandSupportForm } from './DemandSupportForm'

type DemandSort = DemandFilters['sort']

export function DemandBoardPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pickerKey, setPickerKey] = useState(0)
  const [selection, setSelection] = useState<DemandLocationSelection>()
  const [appliedSelection, setAppliedSelection] =
    useState<DemandLocationSelection>()
  const [academicYear, setAcademicYear] = useState(
    searchParams.get('academicYear') ?? '',
  )
  const [sort, setSort] = useState<DemandSort>('newest')
  const [demands, setDemands] = useState<DemandPage>()
  const [loadingDemands, setLoadingDemands] = useState(true)
  const [demandError, setDemandError] = useState<string>()
  const [filterError, setFilterError] = useState<string>()
  const [operators, setOperators] = useState<OperatorPage>()
  const [operatorPage, setOperatorPage] = useState(0)
  const [checkingOperators, setCheckingOperators] = useState(false)
  const [operatorError, setOperatorError] = useState<string>()
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [accessError, setAccessError] = useState<string>()
  const [returnNotice, setReturnNotice] = useState<string>()
  const demandRequest = useRef(0)
  const operatorRequest = useRef(0)
  const hydratedInitialSelection = useRef(false)

  const initialLocation = useMemo<InitialDemandLocation | undefined>(() => {
    const schoolId = searchParams.get('schoolId')
    const pickupDistrictId = Number(searchParams.get('pickupDistrictId'))
    const neighborhoodId = Number(searchParams.get('neighborhoodId'))
    return schoolId && pickupDistrictId > 0 && neighborhoodId > 0
      ? { schoolId, pickupDistrictId, neighborhoodId }
      : undefined
  }, [searchParams])
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
          setDemandError(
            'Talepler yüklenemedi. Filtrelerinizi koruduk; tekrar deneyebilirsiniz.',
          )
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
          () => void loadDemands(undefined, academicYear, sort, 0),
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

  const resetCreationFlow = useCallback(() => {
    operatorRequest.current += 1
    setOperators(undefined)
    setOperatorPage(0)
    setCheckingOperators(false)
    setOperatorError(undefined)
    setShowCreateForm(false)
    setAccessError(undefined)
  }, [])

  const handleSelectionChange = useCallback(
    (nextSelection?: DemandLocationSelection) => {
      setSelection(nextSelection)
      resetCreationFlow()
      if (
        !nextSelection &&
        initialLocation &&
        !hydratedInitialSelection.current &&
        !initialHydrationFailed.current
      ) {
        // An invalid shared link must not leave the board stuck loading.
        initialHydrationFailed.current = true
        setAppliedSelection(undefined)
        setReturnNotice('Kaydedilen okul ve mahalle artık bulunamadı. Lütfen yeniden seçin.')
        setSearchParams({}, { replace: true })
        void loadDemands(undefined, academicYear, sort, 0)
      }
      if (
        nextSelection &&
        initialLocation &&
        !hydratedInitialSelection.current &&
        !initialHydrationFailed.current
      ) {
        hydratedInitialSelection.current = true
        setAppliedSelection(nextSelection)
        if (searchParams.get('intent') === 'create') {
          setReturnNotice(
            'Seçiminiz korundu. Devam etmeden önce mevcut servisleri yeniden kontrol edin.',
          )
        }
        void loadDemands(nextSelection, academicYear, sort, 0)
      }
    },
    [
      academicYear,
      initialLocation,
      loadDemands,
      resetCreationFlow,
      searchParams,
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
    setFilterError(undefined)
    setAppliedSelection(selection)
    resetCreationFlow()
    setReturnNotice(undefined)

    const parameters = new URLSearchParams()
    if (selection) {
      parameters.set('schoolId', selection.school.id)
      parameters.set('pickupDistrictId', String(selection.pickupDistrict.id))
      parameters.set('neighborhoodId', String(selection.neighborhood.id))
    }
    if (year) parameters.set('academicYear', year)
    setSearchParams(parameters, { replace: true })
    await loadDemands(selection, year, sort, 0)
  }

  async function changeSort(nextSort: DemandSort) {
    setSort(nextSort)
    await loadDemands(appliedSelection, academicYear.trim(), nextSort, 0)
  }

  async function changeDemandPage(page: number) {
    await loadDemands(appliedSelection, academicYear.trim(), sort, page)
  }

  function clearFilters() {
    setPickerKey((key) => key + 1)
    setSelection(undefined)
    setAppliedSelection(undefined)
    setAcademicYear('')
    setSort('newest')
    setFilterError(undefined)
    setReturnNotice(undefined)
    resetCreationFlow()
    setSearchParams({}, { replace: true })
    void loadDemands(undefined, '', 'newest', 0)
  }

  async function checkOperators(page: number) {
    if (!appliedSelection) return
    const request = ++operatorRequest.current
    setCheckingOperators(true)
    setOperatorError(undefined)
    setShowCreateForm(false)
    setAccessError(undefined)
    try {
      const result = await findOperators(
        appliedSelection.school.id,
        appliedSelection.neighborhood.id,
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
          'Mevcut servisler kontrol edilemedi. Yeni talebe geçmeden önce tekrar deneyin.',
        )
      }
    } finally {
      if (request === operatorRequest.current) setCheckingOperators(false)
    }
  }

  async function beginCreate() {
    if (!appliedSelection) return
    setAccessError(undefined)
    try {
      const user = await currentUser()
      if (user.role !== 'PARENT') {
        setAccessError(
          'Talep oluşturma ve destek işlemleri yalnızca veli hesabıyla yapılabilir.',
        )
        return
      }
      setShowCreateForm(true)
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 401) {
        const next = createReturnPath(
          location.pathname,
          appliedSelection,
          academicYear.trim(),
        )
        void navigate(`/operator/login?next=${encodeURIComponent(next)}`)
        return
      }
      setAccessError('Oturum bilgisi kontrol edilemedi. Tekrar deneyin.')
    }
  }

  async function submitCreate(values: SupportValues) {
    if (!appliedSelection) return
    try {
      const response = await createDemand(
        appliedSelection.school.id,
        appliedSelection.neighborhood.id,
        values,
        academicYear.trim() || undefined,
      )
      void navigate(`/demands/${response.demand.id}`, {
        state: {
          notice: response.created
            ? 'Talebiniz oluşturuldu ve desteğiniz eklendi.'
            : response.demand.status !== 'OPEN'
              ? 'Bu konum ve dönem için daha önce açılmış talep katılıma kapalı. Yeni kayıt oluşturulmadı; yeniden açılması için proje ekibiyle iletişime geçin.'
              : 'Bu konum için talep zaten vardı. Desteğiniz otomatik eklenmedi; katılmak için aşağıdaki ayrı işlemi kullanın.',
        },
        viewTransition: typeof document.startViewTransition === 'function',
      })
    } catch (error) {
      if (error instanceof ApiError && error.problem.status === 401) {
        const next = createReturnPath(
          location.pathname,
          appliedSelection,
          academicYear.trim(),
        )
        void navigate(
          `/operator/login?next=${encodeURIComponent(next)}&reason=session`,
        )
        return
      }
      setAccessError(
        error instanceof ApiError && error.problem.fieldErrors?.academicYear
          ? 'Seçilen eğitim yılı artık yeni taleplere açık değil. Sunucunun güncel eğitim yılına dönüp tekrar deneyin.'
          : error instanceof ApiError
            ? error.problem.detail
            : 'Talep oluşturulamadı. Bilgileri koruduk; tekrar deneyin.',
      )
    }
  }

  const exactDemand =
    appliedSelection && demands?.content.length === 1 &&
    demands.content[0].school.id === appliedSelection.school.id &&
    demands.content[0].neighborhood.id === appliedSelection.neighborhood.id &&
    demands.content[0].academicYear === (academicYear.trim() || demands.content[0].academicYear)
      ? demands.content[0]
      : undefined

  return (
    <section className="demand-page">
      <header className="demand-intro">
        <h1>Servis talep panosu</h1>
        <p>
          Okul ve servis alınacak mahalleyi seçin; açık talepleri anonim olarak
          inceleyin. Yeni talep oluşturmadan önce o konumdaki mevcut servisleri
          göstereceğiz.
        </p>
      </header>

      <section
        className="demand-filter-panel"
        aria-labelledby="demand-filter-title"
      >
        <div className="section-heading">
          <div>
            <h2 id="demand-filter-title">Okul ve mahalleye göre bulun</h2>
            <p>
              Okulun ilçesiyle servis alınacak ilçe farklı olabilir; ikisi aynı
              ilde olmalıdır.
            </p>
          </div>
          <button className="text-button" type="button" onClick={clearFilters}>
            Filtreleri temizle
          </button>
        </div>

        <DemandLocationPicker
          key={pickerKey}
          initialLocation={initialLocation}
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
            <small>Boş bırakırsanız sunucunun güncel yılı kullanılır.</small>
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

      <section className="demand-board-results" aria-live="polite">
        <div className="section-heading">
          <div>
            <h2>Açık talepler</h2>
            <p>
              Veli kimlikleri gösterilmez; yalnızca doğrulanmış hesapların toplu
              ihtiyaç sayıları yer alır.
            </p>
          </div>
          {demands && (
            <span className="count-badge">{demands.totalElements} talep</span>
          )}
        </div>

        {loadingDemands && <DemandListSkeleton />}
        {demandError && (
          <div className="demand-load-error" role="alert">
            <p>{demandError}</p>
            <button
              className="secondary-button"
              type="button"
              onClick={() =>
                void loadDemands(
                  appliedSelection,
                  academicYear.trim(),
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
            <h3>Bu seçim için açık talep yok</h3>
            <p>
              Yeni talebe geçmeden önce mevcut servis işletmecilerini kontrol
              edebilirsiniz.
            </p>
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

      {appliedSelection && !loadingDemands && !demandError && (
        <section
          className="demand-create-panel"
          aria-labelledby="create-demand-title"
        >
          {exactDemand ? (
            <div className="existing-demand-callout">
              <div>
                <h2 id="create-demand-title">
                  Bu konum için bir talep zaten var
                </h2>
                <p>
                  Yeni bir kayıt oluşturmak yerine mevcut talebi inceleyin.
                  Katılımınız yalnızca ayrı “Benim de ihtiyacım var” işlemiyle
                  eklenir.
                </p>
              </div>
              <Link
                className="button-link"
                to={`/demands/${exactDemand.id}`}
                viewTransition
              >
                Mevcut talebe git
              </Link>
            </div>
          ) : (
            <>
              <div className="section-heading">
                <div>
                  <h2 id="create-demand-title">
                    Yeni talep düşünüyor musunuz?
                  </h2>
                  <p>
                    Önce {appliedSelection.school.name} ve{' '}
                    {appliedSelection.neighborhood.name} için görünür servisleri
                    kontrol edin.
                  </p>
                </div>
                {!operators && (
                  <button
                    className="primary-button"
                    disabled={checkingOperators}
                    type="button"
                    onClick={() => void checkOperators(0)}
                  >
                    {checkingOperators
                      ? 'Servisler kontrol ediliyor…'
                      : 'Mevcut servisleri kontrol et'}
                  </button>
                )}
              </div>
              {operatorError && (
                <div className="demand-load-error" role="alert">
                  <p>{operatorError}</p>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void checkOperators(operatorPage)}
                  >
                    Tekrar dene
                  </button>
                </div>
              )}
              {operators && (
                <OperatorCheckResult
                  operators={operators}
                  onPageChange={(page) => void checkOperators(page)}
                />
              )}
              {operators && !showCreateForm && (
                <button
                  className="primary-button demand-continue-button"
                  type="button"
                  onClick={() => void beginCreate()}
                >
                  {operators.totalElements > 0
                    ? 'Yine de servise ihtiyacım var'
                    : 'Yeni talep oluştur'}
                </button>
              )}
              {accessError && (
                <div className="form-error" role="alert">
                  {accessError}
                </div>
              )}
              {showCreateForm && (
                <div className="demand-inline-form">
                  <h3>İhtiyacınızı ekleyin</h3>
                  <p>
                    Öğrenci adı veya açık adres girmeyin. Seçimleriniz yalnızca
                    toplu sayılarda görünür.
                  </p>
                  <DemandSupportForm
                    busyLabel="Talep oluşturuluyor…"
                    submitLabel="Talebi ve desteğimi oluştur"
                    onCancel={() => setShowCreateForm(false)}
                    onSubmit={submitCreate}
                  />
                </div>
              )}
            </>
          )}
        </section>
      )}
    </section>
  )
}

function createReturnPath(
  pathname: string,
  selection: DemandLocationSelection,
  academicYear: string,
) {
  const parameters = new URLSearchParams({
    schoolId: selection.school.id,
    pickupDistrictId: String(selection.pickupDistrict.id),
    neighborhoodId: String(selection.neighborhood.id),
    intent: 'create',
  })
  if (academicYear) parameters.set('academicYear', academicYear)
  return `${pathname}?${parameters.toString()}`
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
          Eşleşme koltuk, ücret, saat veya kesin güzergâh garantisi değildir.
          Ayrıntıları işletmeciyle görüşün.
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

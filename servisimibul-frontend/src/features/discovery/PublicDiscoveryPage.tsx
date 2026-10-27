import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import {
  findOperators,
  getDistricts,
  getNeighborhoods,
  getProvinces,
  getSchools,
  type OperatorPage,
  type PublicOperator,
  type School,
  type SchoolPage,
  type SchoolSort,
} from './discovery-api'
import { PublicTariffReference } from '../tariff/PublicTariffReference'

const searchSchema = z.object({
  schoolProvinceId: z.string().min(1, 'Okulun bulunduğu ili seçin.'),
  schoolId: z.string().uuid('Bir okul seçin.'),
  districtId: z.string().min(1, 'Bir ilçe seçin.'),
  neighborhoodId: z.string().min(1, 'Bir mahalle seçin.'),
})

type SearchValues = z.infer<typeof searchSchema>

interface SearchSelection {
  schoolId: string
  schoolName: string
  districtName: string
  neighborhoodId: number
  neighborhoodName: string
  provinceCode: string
}

interface SchoolFilters {
  districtId: string
  query: string
  sort: SchoolSort
}

const DEFAULT_SCHOOL_SORT: SchoolSort = 'name-asc'

export function PublicDiscoveryPage() {
  const [provinces, setProvinces] = useState<
    Awaited<ReturnType<typeof getProvinces>>
  >([])
  const [schoolDistricts, setSchoolDistricts] = useState<
    Awaited<ReturnType<typeof getDistricts>>
  >([])
  const [schoolPage, setSchoolPage] = useState<SchoolPage>()
  const [schoolPageNumber, setSchoolPageNumber] = useState(0)
  const [schoolDistrictId, setSchoolDistrictId] = useState('')
  const [schoolQueryInput, setSchoolQueryInput] = useState('')
  const [schoolQuery, setSchoolQuery] = useState('')
  const [schoolSort, setSchoolSort] = useState<SchoolSort>(DEFAULT_SCHOOL_SORT)
  const [selectedSchool, setSelectedSchool] = useState<School>()
  const [schoolNotice, setSchoolNotice] = useState<string>()
  const [schoolLoadError, setSchoolLoadError] = useState<string>()
  const [pickupDistricts, setPickupDistricts] = useState<
    Awaited<ReturnType<typeof getDistricts>>
  >([])
  const [neighborhoods, setNeighborhoods] = useState<
    Awaited<ReturnType<typeof getNeighborhoods>>
  >([])
  const [loadingProvinces, setLoadingProvinces] = useState(true)
  const [loadingSchoolDistricts, setLoadingSchoolDistricts] = useState(false)
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false)
  const [locationError, setLocationError] = useState<string>()
  const [searchError, setSearchError] = useState<string>()
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<OperatorPage>()
  const [lastSelection, setLastSelection] = useState<SearchSelection>()
  const schoolDistrictRequest = useRef(0)
  const schoolRequest = useRef(0)
  const pickupDistrictRequest = useRef(0)
  const neighborhoodRequest = useRef(0)
  const searchRequest = useRef(0)

  const {
    clearErrors,
    control,
    handleSubmit,
    register,
    setValue,
    formState: { errors },
  } = useForm<SearchValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      schoolProvinceId: '',
      schoolId: '',
      districtId: '',
      neighborhoodId: '',
    },
  })

  const selectedSchoolProvinceId = useWatch({
    control,
    name: 'schoolProvinceId',
  })
  const selectedDistrictId = useWatch({ control, name: 'districtId' })
  const selectedNeighborhoodId = useWatch({
    control,
    name: 'neighborhoodId',
  })

  const loadProvinces = useCallback(async () => {
    setLoadingProvinces(true)
    setLocationError(undefined)
    try {
      const pilotProvinces = (await getProvinces()).filter(
        (province) =>
          province.name.trim().toLocaleLowerCase('tr-TR') === 'istanbul',
      )
      setProvinces(pilotProvinces)
      if (pilotProvinces.length === 0) {
        setLocationError(
          'İstanbul için okul bilgisi bulunamadı. Daha sonra tekrar deneyin.',
        )
      }
    } catch {
      setProvinces([])
      setLocationError(
        'İller yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
      )
    } finally {
      setLoadingProvinces(false)
    }
  }, [])

  const loadSchools = useCallback(
    async (provinceId: number, filters: SchoolFilters, page: number) => {
      const request = ++schoolRequest.current
      setSchoolPageNumber(page)
      setLoadingSchools(true)
      setSchoolLoadError(undefined)
      setSchoolPage(undefined)
      try {
        const nextPage = await getSchools({
          provinceId,
          districtId: filters.districtId
            ? Number(filters.districtId)
            : undefined,
          query: filters.query,
          sort: filters.sort,
          page,
        })
        if (request === schoolRequest.current) setSchoolPage(nextPage)
      } catch {
        if (request === schoolRequest.current) {
          setSchoolLoadError('Okulları yükleyemedik. Tekrar deneyin.')
        }
      } finally {
        if (request === schoolRequest.current) setLoadingSchools(false)
      }
    },
    [],
  )

  useEffect(() => {
    void Promise.resolve().then(loadProvinces)
  }, [loadProvinces])

  function clearResults() {
    searchRequest.current += 1
    setSearching(false)
    setResults(undefined)
    setLastSelection(undefined)
    setSearchError(undefined)
  }

  function clearSelectedSchool(notice?: string) {
    setSelectedSchool(undefined)
    setValue('schoolId', '')
    setValue('districtId', '')
    setValue('neighborhoodId', '')
    clearErrors(['schoolId', 'districtId', 'neighborhoodId'])
    setPickupDistricts([])
    setNeighborhoods([])
    setSchoolNotice(notice)
    pickupDistrictRequest.current += 1
    neighborhoodRequest.current += 1
    setLoadingDistricts(false)
    setLoadingNeighborhoods(false)
    clearResults()
  }

  function keepSelectionIfCompatible(filters: SchoolFilters) {
    if (!selectedSchool) return

    const districtMatches =
      !filters.districtId ||
      selectedSchool.districtId === Number(filters.districtId)
    const queryMatches =
      !filters.query ||
      normalizeSchoolText(selectedSchool.name).includes(
        normalizeSchoolText(filters.query),
      )

    if (!districtMatches || !queryMatches) {
      clearSelectedSchool(
        'Filtreleri değiştirdiğiniz için okul seçimi temizlendi. Yeniden okul seçin.',
      )
    }
  }

  async function selectSchoolProvince(provinceId: string) {
    setValue('schoolProvinceId', provinceId, { shouldValidate: true })
    setSchoolDistrictId('')
    setSchoolQueryInput('')
    setSchoolQuery('')
    setSchoolSort(DEFAULT_SCHOOL_SORT)
    setSchoolDistricts([])
    setSchoolPage(undefined)
    setSchoolLoadError(undefined)
    clearSelectedSchool()
    clearErrors('schoolProvinceId')
    setLocationError(undefined)
    schoolDistrictRequest.current += 1
    schoolRequest.current += 1
    setLoadingSchoolDistricts(false)
    setLoadingSchools(false)

    if (!provinceId) return

    const numericProvinceId = Number(provinceId)
    const districtRequest = ++schoolDistrictRequest.current
    setLoadingSchoolDistricts(true)
    void getDistricts(numericProvinceId)
      .then((nextDistricts) => {
        if (districtRequest === schoolDistrictRequest.current) {
          setSchoolDistricts(nextDistricts)
        }
      })
      .catch(() => {
        if (districtRequest === schoolDistrictRequest.current) {
          setLocationError(
            'Okul ilçeleri yüklenemedi. İli yeniden seçip tekrar deneyin.',
          )
        }
      })
      .finally(() => {
        if (districtRequest === schoolDistrictRequest.current) {
          setLoadingSchoolDistricts(false)
        }
      })

    await loadSchools(
      numericProvinceId,
      { districtId: '', query: '', sort: DEFAULT_SCHOOL_SORT },
      0,
    )
  }

  async function selectSchoolDistrict(nextDistrictId: string) {
    const nextQuery = schoolQueryInput.trim()
    setSchoolDistrictId(nextDistrictId)
    setSchoolQuery(nextQuery)
    const filters = {
      districtId: nextDistrictId,
      query: nextQuery,
      sort: schoolSort,
    }
    keepSelectionIfCompatible(filters)
    if (!selectedSchoolProvinceId) return
    await loadSchools(Number(selectedSchoolProvinceId), filters, 0)
  }

  async function applySchoolSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selectedSchoolProvinceId) return

    const nextQuery = schoolQueryInput.trim()
    setSchoolQuery(nextQuery)
    const filters = {
      districtId: schoolDistrictId,
      query: nextQuery,
      sort: schoolSort,
    }
    keepSelectionIfCompatible(filters)
    await loadSchools(Number(selectedSchoolProvinceId), filters, 0)
  }

  async function changeSchoolSort(nextSort: SchoolSort) {
    const nextQuery = schoolQueryInput.trim()
    setSchoolSort(nextSort)
    setSchoolQuery(nextQuery)
    const filters = {
      districtId: schoolDistrictId,
      query: nextQuery,
      sort: nextSort,
    }
    keepSelectionIfCompatible(filters)
    if (!selectedSchoolProvinceId) return
    await loadSchools(Number(selectedSchoolProvinceId), filters, 0)
  }

  async function clearSchoolFilters() {
    setSchoolDistrictId('')
    setSchoolQueryInput('')
    setSchoolQuery('')
    setSchoolSort(DEFAULT_SCHOOL_SORT)
    setSchoolNotice(undefined)
    if (!selectedSchoolProvinceId) return
    await loadSchools(
      Number(selectedSchoolProvinceId),
      { districtId: '', query: '', sort: DEFAULT_SCHOOL_SORT },
      0,
    )
  }

  async function changeSchoolPage(page: number) {
    if (!selectedSchoolProvinceId) return
    const nextQuery = schoolQueryInput.trim()
    const filters = {
      districtId: schoolDistrictId,
      query: nextQuery,
      sort: schoolSort,
    }
    if (nextQuery !== schoolQuery) {
      setSchoolQuery(nextQuery)
      keepSelectionIfCompatible(filters)
    }
    await loadSchools(
      Number(selectedSchoolProvinceId),
      filters,
      nextQuery === schoolQuery ? page : 0,
    )
  }

  async function selectSchool(school: School) {
    setSelectedSchool(school)
    setSchoolNotice(undefined)
    setValue('schoolId', school.id, { shouldValidate: true })
    setValue('districtId', '')
    setValue('neighborhoodId', '')
    clearErrors(['schoolId', 'districtId', 'neighborhoodId'])
    setPickupDistricts([])
    setNeighborhoods([])
    clearResults()
    setLocationError(undefined)
    pickupDistrictRequest.current += 1
    neighborhoodRequest.current += 1

    const request = pickupDistrictRequest.current
    setLoadingDistricts(true)
    try {
      const nextDistricts = await getDistricts(school.provinceId)
      if (request === pickupDistrictRequest.current) {
        setPickupDistricts(nextDistricts)
      }
    } catch {
      if (request === pickupDistrictRequest.current) {
        setLocationError(
          'Servis alınacak ilçeler yüklenemedi. Okulu yeniden seçip tekrar deneyin.',
        )
      }
    } finally {
      if (request === pickupDistrictRequest.current) {
        setLoadingDistricts(false)
      }
    }
  }

  async function selectDistrict(districtId: string) {
    setValue('districtId', districtId, { shouldValidate: true })
    setValue('neighborhoodId', '')
    clearErrors(['districtId', 'neighborhoodId'])
    setNeighborhoods([])
    clearResults()
    setLocationError(undefined)
    neighborhoodRequest.current += 1

    if (!districtId) return

    const request = neighborhoodRequest.current
    setLoadingNeighborhoods(true)
    try {
      const nextNeighborhoods = await getNeighborhoods(Number(districtId))
      if (request === neighborhoodRequest.current) {
        setNeighborhoods(nextNeighborhoods)
      }
    } catch {
      if (request === neighborhoodRequest.current) {
        setLocationError(
          'Mahalleler yüklenemedi. İlçeyi yeniden seçip tekrar deneyin.',
        )
      }
    } finally {
      if (request === neighborhoodRequest.current) {
        setLoadingNeighborhoods(false)
      }
    }
  }

  function selectNeighborhood(neighborhoodId: string) {
    setValue('neighborhoodId', neighborhoodId, { shouldValidate: true })
    clearErrors('neighborhoodId')
    clearResults()
  }

  async function submit(values: SearchValues) {
    const district = pickupDistricts.find(
      (item) => item.id === Number(values.districtId),
    )
    const neighborhood = neighborhoods.find(
      (item) => item.id === Number(values.neighborhoodId),
    )
    if (!selectedSchool || !district || !neighborhood) return

    await runSearch(
      {
        schoolId: selectedSchool.id,
        schoolName: selectedSchool.name,
        districtName: district.name,
        neighborhoodId: neighborhood.id,
        neighborhoodName: neighborhood.name,
        provinceCode: selectedSchool.provinceCode,
      },
      0,
    )
  }

  async function runSearch(selection: SearchSelection, page: number) {
    const request = ++searchRequest.current
    setSearching(true)
    setSearchError(undefined)
    setResults(undefined)
    setLastSelection(selection)
    try {
      const nextResults = await findOperators(
        selection.schoolId,
        selection.neighborhoodId,
        page,
      )
      if (request === searchRequest.current) setResults(nextResults)
    } catch {
      if (request === searchRequest.current) {
        setSearchError(
          'Servis işletmecileri yüklenemedi. Lütfen tekrar deneyin.',
        )
      }
    } finally {
      if (request === searchRequest.current) setSearching(false)
    }
  }

  function retryLocationLoad() {
    if (!selectedSchoolProvinceId) {
      void loadProvinces()
    } else if (
      selectedDistrictId &&
      selectedSchool &&
      neighborhoods.length === 0
    ) {
      void selectDistrict(selectedDistrictId)
    } else if (selectedSchool && pickupDistricts.length === 0) {
      void selectSchool(selectedSchool)
    } else {
      void selectSchoolProvince(selectedSchoolProvinceId)
    }
  }

  return (
    <section className="discovery-page">
      <div className="hero-card discovery-intro">
        <h1>ServisimiBul</h1>

        <p>Okulunuzu ve mahallenizi seçerek servis işletmecilerine ulaşın.</p>
      </div>

      <div className="form-card discovery-search">
        <div className="section-heading">
          <div>
            <h2>Önce okulunuzu seçin</h2>
          </div>
        </div>

        {locationError && (
          <div className="discovery-load-error" role="alert">
            <span>{locationError}</span>
            <button
              className="text-button"
              onClick={retryLocationLoad}
              type="button"
            >
              Tekrar dene
            </button>
          </div>
        )}

        <div className="school-filter-grid">
          <label className="form-field">
            Okulun bulunduğu il
            <select
              {...register('schoolProvinceId')}
              aria-describedby={
                errors.schoolProvinceId ? 'school-province-error' : undefined
              }
              aria-invalid={Boolean(errors.schoolProvinceId)}
              disabled={loadingProvinces || provinces.length === 0}
              onChange={(event) =>
                void selectSchoolProvince(event.target.value)
              }
              value={selectedSchoolProvinceId}
            >
              <option value="">
                {loadingProvinces ? 'İller yükleniyor...' : 'İl seçin'}
              </option>
              {provinces.map((province) => (
                <option key={province.id} value={province.id}>
                  {province.name}
                </option>
              ))}
            </select>
            {errors.schoolProvinceId && (
              <small className="field-error" id="school-province-error">
                {errors.schoolProvinceId.message}
              </small>
            )}
          </label>

          <label className="form-field">
            Okulun ilçesi
            <select
              disabled={!selectedSchoolProvinceId || loadingSchoolDistricts}
              onChange={(event) =>
                void selectSchoolDistrict(event.target.value)
              }
              value={schoolDistrictId}
            >
              <option value="">
                {loadingSchoolDistricts
                  ? 'İlçeler yükleniyor...'
                  : 'Tüm ilçeler'}
              </option>
              {schoolDistricts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            Sıralama
            <select
              disabled={!selectedSchoolProvinceId || loadingSchools}
              onChange={(event) =>
                void changeSchoolSort(event.target.value as SchoolSort)
              }
              value={schoolSort}
            >
              <option value="name-asc">Okul adı A–Z</option>
              <option value="name-desc">Okul adı Z–A</option>
            </select>
          </label>
        </div>

        <form className="school-search-row" onSubmit={applySchoolSearch}>
          <label className="form-field grow">
            Okul adında ara
            <input
              disabled={!selectedSchoolProvinceId || loadingSchools}
              onChange={(event) => setSchoolQueryInput(event.target.value)}
              placeholder="Örneğin Atatürk İlkokulu"
              type="search"
              value={schoolQueryInput}
            />
          </label>
          <button
            className="secondary-button"
            disabled={!selectedSchoolProvinceId || loadingSchools}
            type="submit"
          >
            Okullarda ara
          </button>
          <button
            className="text-button"
            disabled={
              !selectedSchoolProvinceId ||
              loadingSchools ||
              (!schoolDistrictId &&
                !schoolQueryInput.trim() &&
                !schoolQuery &&
                schoolSort === DEFAULT_SCHOOL_SORT)
            }
            onClick={() => void clearSchoolFilters()}
            type="button"
          >
            Filtreleri temizle
          </button>
        </form>

        {schoolNotice && (
          <p className="school-selection-notice" role="status">
            {schoolNotice}
          </p>
        )}

        <SchoolResults
          error={schoolLoadError}
          loading={loadingSchools}
          onPageChange={(page) => void changeSchoolPage(page)}
          onRetry={() => void changeSchoolPage(schoolPageNumber)}
          onSelect={(school) => void selectSchool(school)}
          page={schoolPage}
          selectedSchoolId={selectedSchool?.id}
          visible={Boolean(selectedSchoolProvinceId)}
        />

        <input {...register('schoolId')} type="hidden" />
        {errors.schoolId && (
          <small
            className="field-error school-selection-error"
            id="school-error"
          >
            {errors.schoolId.message}
          </small>
        )}

        {selectedSchool && (
          <div className="selected-school-summary" role="status">
            <div>
              <strong>Seçilen okul</strong>
              <span>
                {selectedSchool.name} · {selectedSchool.districtName}
              </span>
            </div>
            <button
              className="text-button"
              onClick={() => clearSelectedSchool('Okul seçimi kaldırıldı.')}
              type="button"
            >
              Seçimi kaldır
            </button>
          </div>
        )}

        <form
          className="pickup-search"
          onSubmit={handleSubmit(submit)}
          aria-busy={searching}
          noValidate
        >
          <div className="section-heading pickup-heading">
            <div>
              <h2>Servise bineceğiniz yeri seçin</h2>
            </div>
          </div>

          <div className="discovery-field-grid">
            <label className="form-field">
              Servis alınacak ilçe
              <select
                {...register('districtId')}
                aria-describedby={
                  errors.districtId ? 'district-error' : undefined
                }
                aria-invalid={Boolean(errors.districtId)}
                disabled={!selectedSchool || loadingDistricts}
                onChange={(event) => void selectDistrict(event.target.value)}
                value={selectedDistrictId}
              >
                <option value="">
                  {!selectedSchool
                    ? 'Önce okul seçin'
                    : loadingDistricts
                      ? 'İlçeler yükleniyor...'
                      : 'İlçe seçin'}
                </option>
                {pickupDistricts.map((district) => (
                  <option key={district.id} value={district.id}>
                    {district.name}
                  </option>
                ))}
              </select>
              {errors.districtId && (
                <small className="field-error" id="district-error">
                  {errors.districtId.message}
                </small>
              )}
            </label>

            <label className="form-field">
              Servis alınacak mahalle
              <select
                {...register('neighborhoodId')}
                aria-describedby={
                  errors.neighborhoodId ? 'neighborhood-error' : undefined
                }
                aria-invalid={Boolean(errors.neighborhoodId)}
                disabled={!selectedDistrictId || loadingNeighborhoods}
                onChange={(event) => selectNeighborhood(event.target.value)}
                value={selectedNeighborhoodId}
              >
                <option value="">
                  {loadingNeighborhoods
                    ? 'Mahalleler yükleniyor...'
                    : 'Mahalle seçin'}
                </option>
                {neighborhoods.map((neighborhood) => (
                  <option key={neighborhood.id} value={neighborhood.id}>
                    {neighborhood.name}
                  </option>
                ))}
              </select>
              {errors.neighborhoodId && (
                <small className="field-error" id="neighborhood-error">
                  {errors.neighborhoodId.message}
                </small>
              )}
            </label>
          </div>

          <p className="discovery-note">
            Güzergâh, boş yer ve ücret için işletmeciyle görüşün.
          </p>

          <button className="primary-button" disabled={searching} type="submit">
            {searching
              ? 'İşletmeciler aranıyor...'
              : 'Servis işletmecilerini bul'}
          </button>
        </form>
      </div>

      <DiscoveryResults
        error={searchError}
        loading={searching}
        onPageChange={(page) => {
          if (lastSelection) void runSearch(lastSelection, page)
        }}
        page={results}
        selection={lastSelection}
      />
      <PublicTariffReference
        key={lastSelection?.provinceCode}
        provinceCode={lastSelection?.provinceCode}
      />
    </section>
  )
}

function SchoolResults({
  error,
  loading,
  onPageChange,
  onRetry,
  onSelect,
  page,
  selectedSchoolId,
  visible,
}: {
  error?: string
  loading: boolean
  onPageChange: (page: number) => void
  onRetry: () => void
  onSelect: (school: School) => void
  page?: SchoolPage
  selectedSchoolId?: string
  visible: boolean
}) {
  if (!visible) {
    return (
      <div className="school-browser-empty">
        <h3>İl seçerek okulları görüntüleyin</h3>
      </div>
    )
  }

  return (
    <section className="school-results" aria-busy={loading} aria-live="polite">
      {loading && (
        <div className="school-result-loading" role="status">
          <span>Okullar yükleniyor...</span>
          <div aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="school-result-error" role="alert">
          <span>{error}</span>
          <button className="text-button" onClick={onRetry} type="button">
            Tekrar dene
          </button>
        </div>
      )}

      {!loading && !error && page && (
        <>
          <div className="school-result-summary">
            <h3>
              {page.totalElements === 0
                ? 'Okul bulunamadı'
                : `${page.totalElements} okul bulundu`}
            </h3>
            {page.totalElements > 0 && (
              <p>
                Sayfa {page.page + 1} / {page.totalPages}
              </p>
            )}
          </div>

          {page.content.length === 0 ? (
            <div className="school-browser-empty">
              <p>Farklı bir okul adı veya ilçe deneyin.</p>
            </div>
          ) : (
            <ul className="school-result-list">
              {page.content.map((school) => {
                const selected = school.id === selectedSchoolId
                return (
                  <li key={school.id}>
                    <div>
                      <strong>{school.name}</strong>
                      <span>
                        {school.districtName} · {school.neighborhoodName}
                      </span>
                    </div>
                    <button
                      aria-label={
                        selected
                          ? `${school.name} seçildi`
                          : `${school.name} okulunu seç`
                      }
                      aria-pressed={selected}
                      className={selected ? 'secondary-button' : 'text-button'}
                      disabled={selected}
                      onClick={() => onSelect(school)}
                      type="button"
                    >
                      {selected ? 'Seçildi' : 'Bu okulu seç'}
                    </button>
                  </li>
                )
              })}
            </ul>
          )}

          {page.totalPages > 1 && (
            <nav className="pagination" aria-label="Okul sonuçları sayfaları">
              <button
                className="secondary-button"
                disabled={page.page === 0}
                onClick={() => onPageChange(page.page - 1)}
                type="button"
              >
                Önceki sayfa
              </button>
              <span>
                Sayfa {page.page + 1} / {page.totalPages}
              </span>
              <button
                className="secondary-button"
                disabled={page.page + 1 >= page.totalPages}
                onClick={() => onPageChange(page.page + 1)}
                type="button"
              >
                Sonraki sayfa
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}

function normalizeSchoolText(value: string) {
  return value
    .trim()
    .toLocaleLowerCase('tr-TR')
    .replaceAll('ı', 'i')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
}

function DiscoveryResults({
  error,
  loading,
  onPageChange,
  page,
  selection,
}: {
  error?: string
  loading: boolean
  onPageChange: (page: number) => void
  page?: OperatorPage
  selection?: SearchSelection
}) {
  if (!selection && !error) return null

  return (
    <section
      className="discovery-results"
      aria-busy={loading}
      aria-live="polite"
    >
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="inline-loading" role="status">
          <span className="loading-dot" aria-hidden="true" />
          İşletmeciler aranıyor...
        </div>
      )}

      {!loading && page && selection && (
        <>
          <div className="section-heading discovery-result-heading">
            <div>
              <h2>
                {page.totalElements === 0
                  ? 'Henüz bir eşleşme yok'
                  : `${page.totalElements} işletmeci bulundu`}
              </h2>
              <p>
                {selection.schoolName} · {selection.districtName} /{' '}
                {selection.neighborhoodName}
              </p>
            </div>
          </div>

          {page.content.length === 0 ? (
            <div className="empty-state">
              <h3>Bu bölgede henüz servis işletmecisi bulunamadı.</h3>
              <p>
                Başka bir mahalle deneyebilir veya daha sonra tekrar arama
                yapabilirsiniz.
              </p>
            </div>
          ) : (
            <div className="operator-result-list">
              {page.content.map((operator) => (
                <OperatorCard key={operator.operatorId} operator={operator} />
              ))}
            </div>
          )}

          {page.totalPages > 1 && (
            <nav className="pagination" aria-label="Arama sonuçları sayfaları">
              <button
                className="secondary-button"
                disabled={page.page === 0}
                onClick={() => onPageChange(page.page - 1)}
                type="button"
              >
                Önceki sayfa
              </button>
              <span>
                Sayfa {page.page + 1} / {page.totalPages}
              </span>
              <button
                className="secondary-button"
                disabled={page.page + 1 >= page.totalPages}
                onClick={() => onPageChange(page.page + 1)}
                type="button"
              >
                Sonraki sayfa
              </button>
            </nav>
          )}
        </>
      )}
    </section>
  )
}

function OperatorCard({ operator }: { operator: PublicOperator }) {
  const usefulOfferings = operator.publishedOfferings.filter(
    (offering) => offering.description || offering.availableSeats !== null,
  )

  return (
    <article className="school-card operator-result-card">
      <div>
        <h3>{operator.businessName || 'Bireysel servis işletmecisi'}</h3>
        <p className="operator-school">{operator.matchingSchool.name}</p>
      </div>

      {operator.description && <p>{operator.description}</p>}

      {usefulOfferings.length > 0 && (
        <div className="offering-summary">
          <h4>Servis detayları</h4>
          <ul>
            {usefulOfferings.map((offering) => (
              <li key={offering.offeringId}>
                {offering.description && <span>{offering.description}</span>}
                {offering.availableSeats !== null && (
                  <strong>
                    Uygun koltuk: {offering.availableSeats}/
                    {offering.vehicleCapacity}
                  </strong>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="operator-contact">
        <a className="button-link" href={`tel:${operator.contactPhone}`}>
          {operator.contactPhone}
        </a>
      </div>
    </article>
  )
}

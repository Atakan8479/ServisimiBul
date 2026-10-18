import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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

export function PublicDiscoveryPage() {
  const [provinces, setProvinces] = useState<
    Awaited<ReturnType<typeof getProvinces>>
  >([])
  const [schoolDistricts, setSchoolDistricts] = useState<
    Awaited<ReturnType<typeof getDistricts>>
  >([])
  const [schools, setSchools] = useState<School[]>([])
  const [schoolDistrictId, setSchoolDistrictId] = useState('')
  const [schoolFilter, setSchoolFilter] = useState('')
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
  const selectedSchoolId = useWatch({ control, name: 'schoolId' })
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
          'İstanbul bilgisi henüz okul kataloğunda bulunmuyor. Lütfen daha sonra tekrar deneyin.',
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
    async (provinceId: number, districtId?: number) => {
      const request = ++schoolRequest.current
      setLoadingSchools(true)
      setLocationError(undefined)
      try {
        const nextSchools = await getSchools(provinceId, districtId)
        if (request === schoolRequest.current) setSchools(nextSchools)
      } catch {
        if (request === schoolRequest.current) {
          setSchools([])
          setLocationError(
            'Okullar yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
          )
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

  const visibleSchools = useMemo(() => {
    const filter = schoolFilter.trim().toLocaleLowerCase('tr-TR')
    if (!filter) return schools
    return schools.filter(
      (school) =>
        school.id === selectedSchoolId ||
        `${school.name} ${school.districtName}`
          .toLocaleLowerCase('tr-TR')
          .includes(filter),
    )
  }, [schoolFilter, schools, selectedSchoolId])

  async function selectSchoolProvince(provinceId: string) {
    setValue('schoolProvinceId', provinceId, { shouldValidate: true })
    setSchoolDistrictId('')
    setSchoolFilter('')
    setValue('schoolId', '')
    setValue('districtId', '')
    setValue('neighborhoodId', '')
    clearErrors([
      'schoolProvinceId',
      'schoolId',
      'districtId',
      'neighborhoodId',
    ])
    setSchoolDistricts([])
    setSchools([])
    setPickupDistricts([])
    setNeighborhoods([])
    clearResults()
    setLocationError(undefined)
    schoolDistrictRequest.current += 1
    schoolRequest.current += 1
    pickupDistrictRequest.current += 1
    neighborhoodRequest.current += 1
    setLoadingSchoolDistricts(false)
    setLoadingSchools(false)
    setLoadingDistricts(false)
    setLoadingNeighborhoods(false)

    if (!provinceId) return

    const numericProvinceId = Number(provinceId)
    const request = schoolDistrictRequest.current
    setLoadingSchoolDistricts(true)
    void getDistricts(numericProvinceId)
      .then((nextDistricts) => {
        if (request === schoolDistrictRequest.current) {
          setSchoolDistricts(nextDistricts)
        }
      })
      .catch(() => {
        if (request === schoolDistrictRequest.current) {
          setLocationError(
            'Okul ilçeleri yüklenemedi. İli yeniden seçip tekrar deneyin.',
          )
        }
      })
      .finally(() => {
        if (request === schoolDistrictRequest.current) {
          setLoadingSchoolDistricts(false)
        }
      })

    await loadSchools(numericProvinceId)
  }

  async function selectSchoolDistrict(nextDistrictId: string) {
    setSchoolDistrictId(nextDistrictId)
    setSchoolFilter('')
    setValue('schoolId', '')
    setValue('districtId', '')
    setValue('neighborhoodId', '')
    clearErrors(['schoolId', 'districtId', 'neighborhoodId'])
    setSchools([])
    setPickupDistricts([])
    setNeighborhoods([])
    clearResults()
    pickupDistrictRequest.current += 1
    neighborhoodRequest.current += 1
    setLoadingDistricts(false)
    setLoadingNeighborhoods(false)

    if (!selectedSchoolProvinceId) return
    await loadSchools(
      Number(selectedSchoolProvinceId),
      nextDistrictId ? Number(nextDistrictId) : undefined,
    )
  }

  async function selectSchool(schoolId: string) {
    setValue('schoolId', schoolId, { shouldValidate: true })
    setValue('districtId', '')
    setValue('neighborhoodId', '')
    clearErrors(['schoolId', 'districtId', 'neighborhoodId'])
    setPickupDistricts([])
    setNeighborhoods([])
    clearResults()
    setLocationError(undefined)
    pickupDistrictRequest.current += 1
    neighborhoodRequest.current += 1

    const school = schools.find((item) => item.id === schoolId)
    if (!school) return

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
          'İlçeler yüklenemedi. Okulu yeniden seçip tekrar deneyin.',
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
    const school = schools.find((item) => item.id === values.schoolId)
    const district = pickupDistricts.find(
      (item) => item.id === Number(values.districtId),
    )
    const neighborhood = neighborhoods.find(
      (item) => item.id === Number(values.neighborhoodId),
    )
    if (!school || !district || !neighborhood) return

    await runSearch(
      {
        schoolId: school.id,
        schoolName: school.name,
        districtName: district.name,
        neighborhoodId: neighborhood.id,
        neighborhoodName: neighborhood.name,
        provinceCode: school.provinceCode,
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

  function clearResults() {
    searchRequest.current += 1
    setSearching(false)
    setResults(undefined)
    setLastSelection(undefined)
    setSearchError(undefined)
  }

  function retryLocationLoad() {
    if (!selectedSchoolProvinceId) {
      void loadProvinces()
    } else if (
      selectedDistrictId &&
      selectedSchoolId &&
      neighborhoods.length === 0
    ) {
      void selectDistrict(selectedDistrictId)
    } else if (selectedSchoolId && pickupDistricts.length === 0) {
      void selectSchool(selectedSchoolId)
    } else {
      void selectSchoolProvince(selectedSchoolProvinceId)
    }
  }

  return (
    <section className="discovery-page">
      <div className="hero-card discovery-intro">
        <h1>ServisimiBul</h1>
        <p className="hero-copy">Servis bulmanın yeni yolu.</p>
        <p>
          Okulunuzu ve mahallenizi seçin, o bölgede hizmet verdiğini belirten
          işletmecilere doğrudan ulaşın.
        </p>
      </div>

      <form
        className="form-card discovery-search"
        onSubmit={handleSubmit(submit)}
        aria-busy={searching}
        noValidate
      >
        <div className="section-heading">
          <div>
            <h2>Okul ve mahalleyi seçin</h2>
            <p>
              Önce okulun bulunduğu ili seçin; ardından servis istediğiniz
              mahalleyi belirtin.
            </p>
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

        <div className="discovery-field-grid">
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
            Okulun ilçesi (isteğe bağlı)
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
            Yüklenen okullarda ara
            <input
              disabled={!selectedSchoolProvinceId || loadingSchools}
              onChange={(event) => setSchoolFilter(event.target.value)}
              placeholder="Örneğin Atatürk İlkokulu"
              type="search"
              value={schoolFilter}
            />
          </label>

          <label className="form-field">
            Okul
            <select
              {...register('schoolId')}
              aria-describedby={errors.schoolId ? 'school-error' : undefined}
              aria-invalid={Boolean(errors.schoolId)}
              disabled={
                !selectedSchoolProvinceId ||
                loadingSchools ||
                schools.length === 0
              }
              onChange={(event) => void selectSchool(event.target.value)}
              value={selectedSchoolId}
            >
              <option value="">
                {!selectedSchoolProvinceId
                  ? 'Önce il seçin'
                  : loadingSchools
                    ? 'Okullar yükleniyor...'
                    : 'Okul seçin'}
              </option>
              {visibleSchools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} — {school.districtName}
                </option>
              ))}
            </select>
            {errors.schoolId && (
              <small className="field-error" id="school-error">
                {errors.schoolId.message}
              </small>
            )}
          </label>

          <label className="form-field">
            Servis alınacak ilçe
            <select
              {...register('districtId')}
              aria-describedby={
                errors.districtId ? 'district-error' : undefined
              }
              aria-invalid={Boolean(errors.districtId)}
              disabled={!selectedSchoolId || loadingDistricts}
              onChange={(event) => void selectDistrict(event.target.value)}
              value={selectedDistrictId}
            >
              <option value="">
                {loadingDistricts ? 'İlçeler yükleniyor...' : 'İlçe seçin'}
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

        {selectedSchoolProvinceId &&
          !loadingSchools &&
          !locationError &&
          schools.length === 0 && (
            <p className="discovery-note" role="status">
              Bu il ve ilçe seçimi için aktif okul bulunamadı.
            </p>
          )}

        <p className="discovery-note">
          Mahalle eşleşmesi, belirli bir adresten kesin servis imkânı anlamına
          gelmez. Ayrıntıları işletmeciyle görüşün. Koltuk bilgisi rezervasyon
          değildir; UKOME tarifeleri yalnızca resmi referanstır, kişisel fiyat
          teklifi değildir.
        </p>

        <button className="primary-button" disabled={searching} type="submit">
          {searching
            ? 'İşletmeciler aranıyor...'
            : 'Servis işletmecilerini bul'}
        </button>
      </form>

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
              <h3>Bu seçim için görünür bir işletmeci bulunamadı.</h3>
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
          <h4>Paylaşılan servis bilgileri</h4>
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
        <span>Güzergâhı ve uygunluğu işletmeciyle doğrulayın.</span>
        <a className="button-link" href={`tel:${operator.contactPhone}`}>
          {operator.contactPhone}
        </a>
      </div>
    </article>
  )
}

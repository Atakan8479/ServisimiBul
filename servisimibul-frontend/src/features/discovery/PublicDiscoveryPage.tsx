import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { z } from 'zod'
import {
  findOperators,
  getDistricts,
  getNeighborhoods,
  getSchools,
  type OperatorPage,
  type PublicOperator,
  type School,
} from './discovery-api'
import { PublicTariffReference } from '../tariff/PublicTariffReference'

const searchSchema = z.object({
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
  const [schools, setSchools] = useState<School[]>([])
  const [schoolFilter, setSchoolFilter] = useState('')
  const [districts, setDistricts] = useState<
    Awaited<ReturnType<typeof getDistricts>>
  >([])
  const [neighborhoods, setNeighborhoods] = useState<
    Awaited<ReturnType<typeof getNeighborhoods>>
  >([])
  const [loadingSchools, setLoadingSchools] = useState(true)
  const [loadingDistricts, setLoadingDistricts] = useState(false)
  const [loadingNeighborhoods, setLoadingNeighborhoods] = useState(false)
  const [locationError, setLocationError] = useState<string>()
  const [searchError, setSearchError] = useState<string>()
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<OperatorPage>()
  const [lastSelection, setLastSelection] = useState<SearchSelection>()
  const districtRequest = useRef(0)
  const neighborhoodRequest = useRef(0)

  const {
    clearErrors,
    control,
    handleSubmit,
    register,
    setValue,
    formState: { errors },
  } = useForm<SearchValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: { schoolId: '', districtId: '', neighborhoodId: '' },
  })

  const selectedSchoolId = useWatch({ control, name: 'schoolId' })
  const selectedDistrictId = useWatch({ control, name: 'districtId' })
  const selectedNeighborhoodId = useWatch({
    control,
    name: 'neighborhoodId',
  })

  const loadSchools = useCallback(async () => {
    setLoadingSchools(true)
    setLocationError(undefined)
    try {
      setSchools(await getSchools())
    } catch {
      setLocationError(
        'Okullar yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
      )
    } finally {
      setLoadingSchools(false)
    }
  }, [])

  useEffect(() => {
    void getSchools()
      .then(setSchools)
      .catch(() => {
        setLocationError(
          'Okullar yüklenemedi. Bağlantınızı kontrol edip tekrar deneyin.',
        )
      })
      .finally(() => setLoadingSchools(false))
  }, [])

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

  async function selectSchool(schoolId: string) {
    setValue('schoolId', schoolId, { shouldValidate: true })
    setValue('districtId', '')
    setValue('neighborhoodId', '')
    clearErrors(['schoolId', 'districtId', 'neighborhoodId'])
    setDistricts([])
    setNeighborhoods([])
    clearResults()
    setLocationError(undefined)
    districtRequest.current += 1
    neighborhoodRequest.current += 1

    const school = schools.find((item) => item.id === schoolId)
    if (!school) return

    const request = districtRequest.current
    setLoadingDistricts(true)
    try {
      const nextDistricts = await getDistricts(school.provinceId)
      if (request === districtRequest.current) setDistricts(nextDistricts)
    } catch {
      if (request === districtRequest.current) {
        setLocationError(
          'İlçeler yüklenemedi. Okulu yeniden seçip tekrar deneyin.',
        )
      }
    } finally {
      if (request === districtRequest.current) setLoadingDistricts(false)
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
    const district = districts.find(
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
    setSearching(true)
    setSearchError(undefined)
    setResults(undefined)
    setLastSelection(selection)
    try {
      setResults(
        await findOperators(selection.schoolId, selection.neighborhoodId, page),
      )
    } catch {
      setSearchError('Servis işletmecileri yüklenemedi. Lütfen tekrar deneyin.')
    } finally {
      setSearching(false)
    }
  }

  function clearResults() {
    setResults(undefined)
    setLastSelection(undefined)
    setSearchError(undefined)
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
            <p>Arama yapmak için üç seçimi de tamamlayın.</p>
          </div>
        </div>

        {locationError && (
          <div className="discovery-load-error" role="alert">
            <span>{locationError}</span>
            {schools.length === 0 && (
              <button
                className="text-button"
                onClick={() => void loadSchools()}
                type="button"
              >
                Tekrar dene
              </button>
            )}
          </div>
        )}

        <div className="discovery-field-grid">
          <label className="form-field">
            Okul adında ara
            <input
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
              disabled={loadingSchools || schools.length === 0}
              onChange={(event) => void selectSchool(event.target.value)}
              value={selectedSchoolId}
            >
              <option value="">
                {loadingSchools ? 'Okullar yükleniyor...' : 'Okul seçin'}
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
            İlçe
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
              {districts.map((district) => (
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
            Mahalle
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

import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  getDistricts,
  getNeighborhoods,
  getProvinces,
  getSchool,
  getSchools,
  type District,
  type Neighborhood,
  type School,
  type SchoolPage,
  type SchoolSort,
} from '../discovery/discovery-api'

export interface DemandLocationSelection {
  school: School
  pickupDistrict: District
  neighborhood: Neighborhood
}

export interface InitialDemandLocation {
  schoolId: string
  pickupDistrictId: number
  neighborhoodId: number
}

const DEFAULT_SORT: SchoolSort = 'name-asc'

export function DemandLocationPicker({
  initialLocation,
  onSelectionChange,
}: {
  initialLocation?: InitialDemandLocation
  onSelectionChange: (selection?: DemandLocationSelection) => void
}) {
  const [provinces, setProvinces] = useState<
    Awaited<ReturnType<typeof getProvinces>>
  >([])
  const [provinceId, setProvinceId] = useState('')
  const [schoolDistricts, setSchoolDistricts] = useState<District[]>([])
  const [schoolDistrictId, setSchoolDistrictId] = useState('')
  const [schoolQueryInput, setSchoolQueryInput] = useState('')
  const [schoolQuery, setSchoolQuery] = useState('')
  const [schoolSort, setSchoolSort] = useState<SchoolSort>(DEFAULT_SORT)
  const [schoolPage, setSchoolPage] = useState<SchoolPage>()
  const [selectedSchool, setSelectedSchool] = useState<School>()
  const [pickupDistricts, setPickupDistricts] = useState<District[]>([])
  const [pickupDistrictId, setPickupDistrictId] = useState('')
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])
  const [neighborhoodId, setNeighborhoodId] = useState('')
  const [loadingProvinces, setLoadingProvinces] = useState(true)
  const [loadingSchools, setLoadingSchools] = useState(false)
  const [loadingPickup, setLoadingPickup] = useState(false)
  const [error, setError] = useState<string>()
  const requestVersion = useRef(0)

  const loadSchoolPage = useCallback(
    async (
      nextProvinceId: number,
      page: number,
      districtId: string,
      query: string,
      sort: SchoolSort,
    ) => {
      const request = ++requestVersion.current
      setLoadingSchools(true)
      setError(undefined)
      try {
        const result = await getSchools({
          provinceId: nextProvinceId,
          districtId: districtId ? Number(districtId) : undefined,
          query,
          sort,
          page,
        })
        if (request === requestVersion.current) setSchoolPage(result)
      } catch {
        if (request === requestVersion.current) {
          setSchoolPage(undefined)
          setError(
            'Okullar yüklenemedi. Filtrelerinizi koruduk; tekrar deneyebilirsiniz.',
          )
        }
      } finally {
        if (request === requestVersion.current) setLoadingSchools(false)
      }
    },
    [],
  )

  useEffect(() => {
    let active = true
    void getProvinces()
      .then((items) => {
        if (!active) return
        const pilot = items.filter(
          (province) =>
            province.name.trim().toLocaleLowerCase('tr-TR') === 'istanbul',
        )
        setProvinces(pilot)
        if (pilot.length === 0) {
          setError('İstanbul okul kataloğunda bulunamadı.')
        }
      })
      .catch(() => {
        if (active) setError('Konum bilgileri yüklenemedi. Tekrar deneyin.')
      })
      .finally(() => {
        if (active) setLoadingProvinces(false)
      })
    return () => {
      active = false
      requestVersion.current += 1
    }
  }, [])

  useEffect(() => {
    if (!initialLocation) return
    const timer = window.setTimeout(() => {
      const request = ++requestVersion.current
      setLoadingPickup(true)
      setError(undefined)
      void getSchool(initialLocation.schoolId)
        .then(async (school) => {
          const districts = await getDistricts(school.provinceId)
          const pickupDistrict = districts.find(
            (district) => district.id === initialLocation.pickupDistrictId,
          )
          if (!pickupDistrict) throw new Error('pickup district missing')
          const nextNeighborhoods = await getNeighborhoods(pickupDistrict.id)
          const neighborhood = nextNeighborhoods.find(
            (item) => item.id === initialLocation.neighborhoodId,
          )
          if (!neighborhood) throw new Error('neighborhood missing')
          if (request !== requestVersion.current) return

          setProvinceId(String(school.provinceId))
          setSchoolDistricts(districts)
          setSelectedSchool(school)
          setPickupDistricts(districts)
          setPickupDistrictId(String(pickupDistrict.id))
          setNeighborhoods(nextNeighborhoods)
          setNeighborhoodId(String(neighborhood.id))
          onSelectionChange({ school, pickupDistrict, neighborhood })
        })
        .catch(() => {
          if (request === requestVersion.current) {
            setError(
              'Kaydedilen okul ve mahalle seçimi yüklenemedi. Lütfen yeniden seçin.',
            )
            onSelectionChange(undefined)
          }
        })
        .finally(() => {
          if (request === requestVersion.current) setLoadingPickup(false)
        })
    }, 0)
    return () => {
      window.clearTimeout(timer)
      requestVersion.current += 1
    }
  }, [initialLocation, onSelectionChange])

  function clearPickup() {
    setPickupDistricts([])
    setPickupDistrictId('')
    setNeighborhoods([])
    setNeighborhoodId('')
    onSelectionChange(undefined)
  }

  function clearSchool() {
    setSelectedSchool(undefined)
    clearPickup()
  }

  async function selectProvince(nextProvinceId: string) {
    requestVersion.current += 1
    setProvinceId(nextProvinceId)
    setSchoolDistricts([])
    setSchoolDistrictId('')
    setSchoolQueryInput('')
    setSchoolQuery('')
    setSchoolSort(DEFAULT_SORT)
    setSchoolPage(undefined)
    setError(undefined)
    clearSchool()
    if (!nextProvinceId) return

    const numericId = Number(nextProvinceId)
    try {
      const districts = await getDistricts(numericId)
      setSchoolDistricts(districts)
      await loadSchoolPage(numericId, 0, '', '', DEFAULT_SORT)
    } catch {
      setError('Okul ilçeleri yüklenemedi. İli yeniden seçip tekrar deneyin.')
    }
  }

  async function applySchoolFilters(event?: FormEvent) {
    event?.preventDefault()
    if (!provinceId) return
    const query = schoolQueryInput.trim()
    setSchoolQuery(query)
    clearSchool()
    await loadSchoolPage(
      Number(provinceId),
      0,
      schoolDistrictId,
      query,
      schoolSort,
    )
  }

  async function changeSchoolDistrict(value: string) {
    setSchoolDistrictId(value)
    const query = schoolQueryInput.trim()
    setSchoolQuery(query)
    clearSchool()
    if (provinceId) {
      await loadSchoolPage(Number(provinceId), 0, value, query, schoolSort)
    }
  }

  async function changeSchoolSort(value: SchoolSort) {
    setSchoolSort(value)
    const query = schoolQueryInput.trim()
    setSchoolQuery(query)
    clearSchool()
    if (provinceId) {
      await loadSchoolPage(
        Number(provinceId),
        0,
        schoolDistrictId,
        query,
        value,
      )
    }
  }

  async function changeSchoolPage(page: number) {
    if (!provinceId) return
    const query = schoolQueryInput.trim()
    setSchoolQuery(query)
    await loadSchoolPage(
      Number(provinceId),
      page,
      schoolDistrictId,
      query,
      schoolSort,
    )
  }

  async function chooseSchool(school: School) {
    setSelectedSchool(school)
    setPickupDistrictId('')
    setNeighborhoods([])
    setNeighborhoodId('')
    onSelectionChange(undefined)
    setLoadingPickup(true)
    setError(undefined)
    try {
      const districts = await getDistricts(school.provinceId)
      setPickupDistricts(districts)
    } catch {
      setPickupDistricts([])
      setError('Servis alınacak ilçeler yüklenemedi. Okulu yeniden seçin.')
    } finally {
      setLoadingPickup(false)
    }
  }

  async function choosePickupDistrict(value: string) {
    setPickupDistrictId(value)
    setNeighborhoods([])
    setNeighborhoodId('')
    onSelectionChange(undefined)
    if (!value || !selectedSchool) return
    setLoadingPickup(true)
    setError(undefined)
    try {
      setNeighborhoods(await getNeighborhoods(Number(value)))
    } catch {
      setError('Mahalleler yüklenemedi. İlçeyi yeniden seçip tekrar deneyin.')
    } finally {
      setLoadingPickup(false)
    }
  }

  function chooseNeighborhood(value: string) {
    setNeighborhoodId(value)
    const pickupDistrict = pickupDistricts.find(
      (district) => district.id === Number(pickupDistrictId),
    )
    const neighborhood = neighborhoods.find((item) => item.id === Number(value))
    if (selectedSchool && pickupDistrict && neighborhood) {
      onSelectionChange({
        school: selectedSchool,
        pickupDistrict,
        neighborhood,
      })
    } else {
      onSelectionChange(undefined)
    }
  }

  const pageNumber = schoolPage?.page ?? 0

  return (
    <div className="demand-location-picker">
      <div className="demand-filter-grid">
        <label className="form-field">
          Okulun bulunduğu il
          <select
            value={provinceId}
            disabled={loadingProvinces || provinces.length === 0}
            onChange={(event) => void selectProvince(event.target.value)}
          >
            <option value="">İl seçin</option>
            {provinces.map((province) => (
              <option key={province.id} value={province.id}>
                {province.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Okulun ilçesi
          <select
            value={schoolDistrictId}
            disabled={!provinceId || loadingSchools}
            onChange={(event) => void changeSchoolDistrict(event.target.value)}
          >
            <option value="">Tüm ilçeler</option>
            {schoolDistricts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Okul sıralaması
          <select
            value={schoolSort}
            disabled={!provinceId || loadingSchools}
            onChange={(event) =>
              void changeSchoolSort(event.target.value as SchoolSort)
            }
          >
            <option value="name-asc">A'dan Z'ye</option>
            <option value="name-desc">Z'den A'ya</option>
          </select>
        </label>
      </div>

      <form className="school-search-row" onSubmit={applySchoolFilters}>
        <label className="form-field grow">
          Okul adında ara
          <input
            value={schoolQueryInput}
            disabled={!provinceId}
            onChange={(event) => setSchoolQueryInput(event.target.value)}
          />
        </label>
        <button
          className="secondary-button"
          disabled={!provinceId || loadingSchools}
          type="submit"
        >
          Okullarda ara
        </button>
      </form>

      {loadingSchools && (
        <div className="school-result-loading" role="status">
          Okullar yükleniyor…
          <div aria-hidden="true">
            <i />
            <i />
          </div>
        </div>
      )}

      {!loadingSchools && schoolPage && (
        <div className="school-results">
          <div className="school-result-summary">
            <div>
              <h3>{schoolPage.totalElements} okul bulundu</h3>
              <p>
                {schoolQuery
                  ? `“${schoolQuery}” araması`
                  : 'Aktif okul kataloğu'}
              </p>
            </div>
          </div>
          {schoolPage.content.length > 0 ? (
            <ul className="school-result-list">
              {schoolPage.content.map((school) => (
                <li key={school.id}>
                  <div>
                    <strong>{school.name}</strong>
                    <span>
                      {school.districtName} · {school.neighborhoodName}
                    </span>
                  </div>
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => void chooseSchool(school)}
                  >
                    {school.name} okulunu seç
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="school-browser-empty">
              <h3>Bu filtrelerle eşleşen okul yok</h3>
              <p>Okul adını veya ilçeyi değiştirerek tekrar deneyin.</p>
            </div>
          )}
          {schoolPage.totalPages > 1 && (
            <div className="pagination">
              <button
                className="secondary-button"
                disabled={pageNumber === 0}
                type="button"
                onClick={() => void changeSchoolPage(pageNumber - 1)}
              >
                Önceki sayfa
              </button>
              <span>
                Sayfa {pageNumber + 1} / {schoolPage.totalPages}
              </span>
              <button
                className="secondary-button"
                disabled={pageNumber + 1 >= schoolPage.totalPages}
                type="button"
                onClick={() => void changeSchoolPage(pageNumber + 1)}
              >
                Sonraki sayfa
              </button>
            </div>
          )}
        </div>
      )}

      {selectedSchool && (
        <div className="selected-school-summary" role="status">
          <div>
            <span>Seçilen okul</span>
            <strong>{selectedSchool.name}</strong>
            <span>
              {selectedSchool.districtName} · {selectedSchool.neighborhoodName}
            </span>
          </div>
          <button className="text-button" type="button" onClick={clearSchool}>
            Okulu değiştir
          </button>
        </div>
      )}

      <div className="demand-filter-grid demand-pickup-grid">
        <label className="form-field">
          Servis alınacak ilçe
          <select
            value={pickupDistrictId}
            disabled={!selectedSchool || loadingPickup}
            onChange={(event) => void choosePickupDistrict(event.target.value)}
          >
            <option value="">İlçe seçin</option>
            {pickupDistricts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Servis alınacak mahalle
          <select
            value={neighborhoodId}
            disabled={!pickupDistrictId || loadingPickup}
            onChange={(event) => chooseNeighborhood(event.target.value)}
          >
            <option value="">Mahalle seçin</option>
            {neighborhoods.map((neighborhood) => (
              <option key={neighborhood.id} value={neighborhood.id}>
                {neighborhood.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {loadingPickup && (
        <p className="inline-loading" role="status">
          <span className="loading-dot" aria-hidden="true" /> Konum seçenekleri
          yükleniyor…
        </p>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
    </div>
  )
}

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type RefObject,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  addOperatorSchool,
  getDiscoveryReadiness,
  getDistricts,
  getNeighborhoods,
  getOperatorSchools,
  removeOperatorSchool,
  replaceCoverage,
  searchSchools,
  setOperatorSchoolActive,
  type District,
  type DiscoveryReadiness,
  type Neighborhood,
  type OperatorSchool,
  type School,
  type SchoolPage,
} from './operator-api'

export function OperatorSchoolsPage() {
  const navigate = useNavigate()
  const coverageHeadingRef = useRef<HTMLHeadingElement>(null)
  const schoolRequest = useRef<AbortController | undefined>(undefined)
  const [relationships, setRelationships] = useState<OperatorSchool[]>([])
  const [readiness, setReadiness] = useState<DiscoveryReadiness>()
  const [schoolPage, setSchoolPage] = useState<SchoolPage>()
  const [schoolRequestParameters, setSchoolRequestParameters] = useState({
    query: '',
    page: 0,
  })
  const [query, setQuery] = useState('')
  const [selectedSchool, setSelectedSchool] = useState<School>()
  const [editingCoverageId, setEditingCoverageId] = useState<string>()
  const [pendingFocusId, setPendingFocusId] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [schoolLoading, setSchoolLoading] = useState(true)
  const [schoolError, setSchoolError] = useState<string>()
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<{
    message: string
    tone: 'success' | 'warning'
  }>()

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    schoolRequest.current = controller
    void getOperatorSchools()
      .then((owned) => {
        if (active) setRelationships(owned)
      })
      .catch((reason: unknown) => {
        if (!active) return
        handleSession(reason, navigate, setError)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    void searchSchools({ query: '', page: 0, signal: controller.signal })
      .then((result) => {
        if (active && !controller.signal.aborted) setSchoolPage(result)
      })
      .catch((reason: unknown) => {
        if (active && !controller.signal.aborted) {
          setSchoolError(messageFor(reason))
        }
      })
      .finally(() => {
        if (active && !controller.signal.aborted) setSchoolLoading(false)
        if (schoolRequest.current === controller) {
          schoolRequest.current = undefined
        }
      })
    void getDiscoveryReadiness()
      .then((discoveryReadiness) => {
        if (active) setReadiness(discoveryReadiness)
      })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof ApiError && reason.sessionExpired) {
          void navigate('/operator/login?reason=session', { replace: true })
        }
      })
    return () => {
      active = false
      controller.abort()
      schoolRequest.current?.abort()
    }
  }, [navigate])

  useEffect(() => {
    if (!pendingFocusId || editingCoverageId !== pendingFocusId) return
    const heading = coverageHeadingRef.current
    if (!heading) return
    heading.focus()
    if (typeof heading.scrollIntoView === 'function') {
      const reducedMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)',
      ).matches
      heading.scrollIntoView({
        behavior: reducedMotion ? 'auto' : 'smooth',
        block: 'start',
      })
    }
    setPendingFocusId(undefined)
  }, [editingCoverageId, pendingFocusId, relationships])

  async function findSchools(event: FormEvent) {
    event.preventDefault()
    await loadSchoolPage(0, query)
  }

  async function loadSchoolPage(page: number, requestedQuery: string) {
    schoolRequest.current?.abort()
    const controller = new AbortController()
    schoolRequest.current = controller
    const parameters = { query: requestedQuery.trim(), page }
    setSchoolRequestParameters(parameters)
    setSchoolLoading(true)
    setSchoolError(undefined)
    setSchoolPage(undefined)
    try {
      const result = await searchSchools({
        ...parameters,
        signal: controller.signal,
      })
      if (schoolRequest.current === controller) setSchoolPage(result)
    } catch (reason) {
      if (!controller.signal.aborted) setSchoolError(messageFor(reason))
    } finally {
      if (schoolRequest.current === controller) {
        schoolRequest.current = undefined
        setSchoolLoading(false)
      }
    }
  }

  async function addSchool(event: FormEvent) {
    event.preventDefault()
    if (!selectedSchool) {
      setError('Eklemek için bir okul seçin.')
      return
    }
    setPending('add')
    setError(undefined)
    setNotice(undefined)
    try {
      const created = await addOperatorSchool(selectedSchool.id)
      setRelationships((current) => [...current, created])
      setSelectedSchool(undefined)
      setEditingCoverageId(created.id)
      setPendingFocusId(created.id)
      setNotice({
        message:
          'Okul eklendi. Şimdi bu okul için hizmet mahallelerini seçip kapsamı kaydedin.',
        tone: 'success',
      })
    } catch (reason) {
      handleSession(reason, navigate, setError)
    } finally {
      setPending(undefined)
    }
  }

  async function toggleActive(relationship: OperatorSchool) {
    setPending(relationship.id)
    setError(undefined)
    try {
      const updated = await setOperatorSchoolActive(
        relationship.id,
        !relationship.active,
      )
      updateRelationship(updated)
      setNotice({
        message: updated.active
          ? 'Okul bağlantısı etkinleştirildi.'
          : 'Okul bağlantısı pasife alındı; bu okul artık aramalara katkı sağlamaz.',
        tone: updated.active ? 'success' : 'warning',
      })
    } catch (reason) {
      handleSession(reason, navigate, setError)
    } finally {
      setPending(undefined)
    }
  }

  async function remove(relationship: OperatorSchool) {
    const confirmed = window.confirm(
      `${relationship.schoolName} bağlantısı ve kapsamı kaldırılsın mı?`,
    )
    if (!confirmed) return

    setPending(relationship.id)
    setError(undefined)
    try {
      await removeOperatorSchool(relationship.id)
      setRelationships((current) =>
        current.filter((item) => item.id !== relationship.id),
      )
      setEditingCoverageId(undefined)
      setNotice({
        message: 'Okul bağlantısı ve okula özel kapsam kaldırıldı.',
        tone: 'warning',
      })
    } catch (reason) {
      handleSession(reason, navigate, setError)
    } finally {
      setPending(undefined)
    }
  }

  function updateRelationship(updated: OperatorSchool) {
    setRelationships((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    )
  }

  const schoolResults = schoolPage?.content ?? []
  const availableSchools = schoolResults.filter(
    (school) =>
      !relationships.some(
        (relationship) => relationship.schoolId === school.id,
      ),
  )
  const selectedSchoolOutsidePage =
    selectedSchool &&
    !availableSchools.some((school) => school.id === selectedSchool.id)
      ? selectedSchool
      : undefined
  const schoolOptions = selectedSchoolOutsidePage
    ? [selectedSchoolOutsidePage, ...availableSchools]
    : availableSchools
  const editingRelationship = relationships.find(
    (relationship) => relationship.id === editingCoverageId,
  )

  if (loading) {
    return <InlineLoading label="Okullar yükleniyor" />
  }

  return (
    <section className="workspace-page">
      <p className="eyebrow">Okullar ve kapsam</p>
      <h1>Hizmet ağınız</h1>
      <p className="page-lead">
        Hizmet verdiğiniz okulları ekleyin; her okul için aynı ildeki
        mahalleleri seçin.
      </p>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className={`status-banner ${notice.tone}`} role="status">
          {notice.message}
        </div>
      )}

      {readiness && !readiness.publiclyVisible && (
        <div className="status-banner warning" role="status">
          <strong>Profil görünürlüğünüz kapalı.</strong>
          <span>
            Okul ve mahalle kapsamınız tam olsa da profilinizi herkese açık
            yapana kadar aramalarda görünmezsiniz.{' '}
            <button
              className="text-button"
              onClick={() => void navigate('/operator/profile')}
              type="button"
            >
              Profil ayarlarına git
            </button>
          </span>
        </div>
      )}

      <section
        className="form-card compact-card"
        aria-labelledby="add-school-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow">Yeni bağlantı</p>
            <h2 id="add-school-title">Okul ekle</h2>
          </div>
          <span className="count-badge">{relationships.length} okul</span>
        </div>
        <form className="search-row" onSubmit={findSchools}>
          <label className="form-field grow">
            <span>Okul ara</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Okul adı"
              id="school-search-input"
              value={query}
            />
          </label>
          <button
            className="secondary-button"
            disabled={schoolLoading}
            type="submit"
          >
            {schoolLoading ? 'Aranıyor…' : 'Ara'}
          </button>
        </form>
        <section
          className="school-results"
          aria-busy={schoolLoading}
          aria-live="polite"
        >
          {schoolLoading && <InlineLoading label="Okullar aranıyor" />}
          {!schoolLoading && schoolError && (
            <div className="school-result-error" role="alert">
              <span>{schoolError}</span>
              <button
                className="text-button"
                onClick={() =>
                  void loadSchoolPage(
                    schoolRequestParameters.page,
                    schoolRequestParameters.query,
                  )
                }
                type="button"
              >
                Tekrar dene
              </button>
            </div>
          )}
          {!schoolLoading && !schoolError && schoolPage && (
            <>
              <div className="school-result-summary">
                <strong>{schoolPage.totalElements} aktif okul</strong>
                {schoolPage.totalElements > 0 && (
                  <span>
                    Sayfa {schoolPage.page + 1} / {schoolPage.totalPages}
                  </span>
                )}
              </div>
              {schoolPage.totalPages > 1 && (
                <nav
                  className="pagination"
                  aria-label="Okul kataloğu sayfaları"
                >
                  <button
                    className="secondary-button"
                    disabled={schoolPage.page === 0}
                    onClick={() =>
                      void loadSchoolPage(
                        schoolPage.page - 1,
                        schoolRequestParameters.query,
                      )
                    }
                    type="button"
                  >
                    Önceki sayfa
                  </button>
                  <span>
                    Sayfa {schoolPage.page + 1} / {schoolPage.totalPages}
                  </span>
                  <button
                    className="secondary-button"
                    disabled={schoolPage.page + 1 >= schoolPage.totalPages}
                    onClick={() =>
                      void loadSchoolPage(
                        schoolPage.page + 1,
                        schoolRequestParameters.query,
                      )
                    }
                    type="button"
                  >
                    Sonraki sayfa
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
        <form className="search-row" onSubmit={addSchool}>
          <label className="form-field grow">
            <span>Aktif okul</span>
            <select
              disabled={schoolLoading && schoolOptions.length === 0}
              onChange={(event) =>
                setSelectedSchool(
                  schoolOptions.find(
                    (school) => school.id === event.target.value,
                  ),
                )
              }
              value={selectedSchool?.id ?? ''}
            >
              <option value="">Okul seçin</option>
              {schoolOptions.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} — {school.districtName}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-button"
            disabled={pending === 'add' || !selectedSchool}
            type="submit"
          >
            {pending === 'add' ? 'Ekleniyor…' : 'Okulu ekle'}
          </button>
        </form>
        {!schoolLoading && !schoolError && schoolPage && (
          <SchoolCatalogGuidance
            availableCount={availableSchools.length}
            page={schoolPage}
            query={schoolRequestParameters.query}
          />
        )}
      </section>

      <div className="school-list">
        {relationships.length === 0 ? (
          <div className="empty-state">
            <h2>Henüz okul eklenmedi</h2>
            <p>
              Yukarıdaki okul aramasından ilk okulunuzu ekleyin. Okul eklenince
              hizmet mahallesi seçimi otomatik olarak açılır.
            </p>
            <a className="text-button" href="#school-search-input">
              Okul aramasına git
            </a>
          </div>
        ) : (
          relationships.map((relationship) => (
            <article className="school-card" key={relationship.id}>
              <div className="school-card-copy">
                <div className="school-title-row">
                  <h2>{relationship.schoolName}</h2>
                  <span
                    className={`status-pill ${relationship.active && relationship.schoolActive ? 'success' : 'neutral'}`}
                  >
                    {!relationship.schoolActive
                      ? 'Okul pasif'
                      : relationship.active
                        ? 'Aktif'
                        : 'Bağlantı pasif'}
                  </span>
                </div>
                <p>
                  {relationship.schoolProvinceName} ·{' '}
                  {relationship.coverage.length} hizmet mahallesi
                </p>
                {!relationship.schoolActive && (
                  <p className="school-warning">
                    Bu okul yönetici tarafından pasife alındı ve aramalara katkı
                    sağlamaz.
                  </p>
                )}
                {relationship.schoolActive && !relationship.active && (
                  <p className="school-warning">
                    Bu bağlantıyı etkinleştirene kadar okul aramalara katkı
                    sağlamaz.
                  </p>
                )}
                {relationship.schoolActive &&
                  relationship.active &&
                  relationship.coverage.length === 0 && (
                    <p className="school-warning">
                      Bu okul için hizmet mahallesi seçin; kapsam kaydedilmeden
                      okul aramalara katkı sağlamaz.
                    </p>
                  )}
              </div>
              <div className="button-row">
                <button
                  className="primary-button"
                  onClick={() =>
                    setEditingCoverageId((current) =>
                      current === relationship.id ? undefined : relationship.id,
                    )
                  }
                  type="button"
                >
                  {editingCoverageId === relationship.id
                    ? 'Kapsamı kapat'
                    : 'Kapsamı düzenle'}
                </button>
                <button
                  className="secondary-button"
                  disabled={
                    pending === relationship.id || !relationship.schoolActive
                  }
                  onClick={() => toggleActive(relationship)}
                  type="button"
                >
                  {relationship.active ? 'Pasife al' : 'Etkinleştir'}
                </button>
                <button
                  className="danger-button"
                  disabled={pending === relationship.id}
                  onClick={() => remove(relationship)}
                  type="button"
                >
                  Kaldır
                </button>
              </div>
              {editingRelationship?.id === relationship.id && (
                <CoverageEditor
                  onSaved={(updated) => {
                    updateRelationship(updated)
                    setNotice(
                      updated.coverage.length > 0
                        ? {
                            message:
                              'Hizmet kapsamı kaydedildi. Bu okul uygun aramalara katkı sağlayabilir.',
                            tone: 'success',
                          }
                        : {
                            message:
                              'Tüm hizmet mahalleleri kaldırıldı. Bu okul artık aramalara katkı sağlamaz.',
                            tone: 'warning',
                          },
                    )
                  }}
                  headingRef={coverageHeadingRef}
                  relationship={editingRelationship}
                />
              )}
            </article>
          ))
        )}
      </div>
    </section>
  )
}

function CoverageEditor({
  headingRef,
  relationship,
  onSaved,
}: {
  headingRef: RefObject<HTMLHeadingElement | null>
  relationship: OperatorSchool
  onSaved: (updated: OperatorSchool) => void
}) {
  const [districts, setDistricts] = useState<District[]>([])
  const [districtLoadState, setDistrictLoadState] = useState<
    'loading' | 'loaded' | 'error'
  >('loading')
  const [districtError, setDistrictError] = useState<string>()
  const [districtRetry, setDistrictRetry] = useState(0)
  const [expandedDistrictIds, setExpandedDistrictIds] = useState<Set<number>>(
    () => new Set(),
  )
  const [neighborhoodsByDistrict, setNeighborhoodsByDistrict] = useState<
    Record<
      number,
      {
        status: 'loading' | 'loaded' | 'error'
        neighborhoods: Neighborhood[]
        error?: string
      }
    >
  >({})
  const [selected, setSelected] = useState(
    () => new Set(relationship.coverage.map((item) => item.neighborhoodId)),
  )
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()
  const neighborhoodRequests = useRef(new Map<number, AbortController>())

  useEffect(() => {
    const controller = new AbortController()
    const requestMap = neighborhoodRequests.current
    void getDistricts(relationship.schoolProvinceId, controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return
        setDistricts(result)
        setDistrictLoadState('loaded')
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setDistrictError(messageFor(reason))
        setDistrictLoadState('error')
      })
    return () => {
      controller.abort()
      requestMap.forEach((request) => request.abort())
      requestMap.clear()
    }
  }, [districtRetry, relationship.schoolProvinceId])

  const selectedCount = selected.size
  const neighborhoodDetails = useMemo(() => {
    const details = new Map<number, { districtId: number; name: string }>()
    relationship.coverage.forEach((item) =>
      details.set(item.neighborhoodId, {
        districtId: item.districtId,
        name: item.neighborhoodName,
      }),
    )
    Object.values(neighborhoodsByDistrict).forEach((result) =>
      result.neighborhoods.forEach((item) =>
        details.set(item.id, {
          districtId: item.districtId,
          name: item.name,
        }),
      ),
    )
    return details
  }, [neighborhoodsByDistrict, relationship.coverage])

  const selectedByDistrict = useMemo(() => {
    const result = new Map<number, { id: number; name: string }[]>()
    selected.forEach((id) => {
      const details = neighborhoodDetails.get(id)
      if (!details) return
      const items = result.get(details.districtId) ?? []
      items.push({ id, name: details.name })
      result.set(details.districtId, items)
    })
    result.forEach((items) =>
      items.sort((left, right) => left.name.localeCompare(right.name, 'tr-TR')),
    )
    return result
  }, [neighborhoodDetails, selected])

  function loadNeighborhoods(districtId: number) {
    if (
      neighborhoodsByDistrict[districtId]?.status === 'loaded' ||
      neighborhoodRequests.current.has(districtId)
    ) {
      return
    }

    const controller = new AbortController()
    neighborhoodRequests.current.set(districtId, controller)
    setNeighborhoodsByDistrict((current) => ({
      ...current,
      [districtId]: {
        status: 'loading',
        neighborhoods: current[districtId]?.neighborhoods ?? [],
      },
    }))
    void getNeighborhoods(districtId, controller.signal)
      .then((neighborhoods) => {
        if (controller.signal.aborted) return
        setNeighborhoodsByDistrict((current) => ({
          ...current,
          [districtId]: { status: 'loaded', neighborhoods },
        }))
      })
      .catch((reason: unknown) => {
        if (controller.signal.aborted) return
        setNeighborhoodsByDistrict((current) => ({
          ...current,
          [districtId]: {
            status: 'error',
            neighborhoods: [],
            error: messageFor(reason),
          },
        }))
      })
      .finally(() => {
        if (neighborhoodRequests.current.get(districtId) === controller) {
          neighborhoodRequests.current.delete(districtId)
        }
      })
  }

  function toggleDistrict(districtId: number) {
    const willExpand = !expandedDistrictIds.has(districtId)
    setExpandedDistrictIds((current) => {
      const next = new Set(current)
      if (next.has(districtId)) next.delete(districtId)
      else next.add(districtId)
      return next
    })
    if (willExpand) loadNeighborhoods(districtId)
  }

  function toggle(id: number) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function save() {
    setSaving(true)
    setError(undefined)
    try {
      const updated = await replaceCoverage(
        relationship.id,
        [...selected].sort((left, right) => left - right),
      )
      onSaved(updated)
      setSelected(new Set(updated.coverage.map((item) => item.neighborhoodId)))
    } catch (reason) {
      setError(messageFor(reason))
    } finally {
      setSaving(false)
    }
  }

  return (
    <section
      className="coverage-editor"
      aria-label={`${relationship.schoolName} kapsamı`}
    >
      <div className="section-heading">
        <div>
          <h3 ref={headingRef} tabIndex={-1}>
            {relationship.schoolName} için hizmet mahalleleri
          </h3>
          <p>
            {relationship.schoolProvinceName} içinde farklı ilçelerden mahalle
            seçebilirsiniz; il dışı seçim yapılamaz.
          </p>
        </div>
        <span className="count-badge">{selectedCount} seçili</span>
      </div>
      {districtLoadState === 'loading' && (
        <InlineLoading label="İlçeler yükleniyor" />
      )}
      {districtLoadState === 'error' && (
        <div className="district-load-error" role="alert">
          <p>{districtError}</p>
          <button
            className="secondary-button"
            onClick={() => {
              setDistrictLoadState('loading')
              setDistrictError(undefined)
              setDistrictRetry((current) => current + 1)
            }}
            type="button"
          >
            İlçeleri yeniden dene
          </button>
        </div>
      )}
      {districtLoadState === 'loaded' && (
        <div className="district-groups">
          {districts.length === 0 && (
            <div className="empty-state compact-empty">
              <h4>Mahalle kataloğu henüz boş</h4>
              <p>
                Bu il için mahalle verisi eklenmeden hizmet kapsamı seçilemez.
              </p>
            </div>
          )}
          {districts.map((district) => {
            const expanded = expandedDistrictIds.has(district.id)
            const loadResult = neighborhoodsByDistrict[district.id]
            const districtSelection = selectedByDistrict.get(district.id) ?? []
            const panelId = `district-${relationship.id}-${district.id}`
            const countId = `${panelId}-count`
            return (
              <fieldset aria-label={district.name} key={district.id}>
                <legend>
                  <button
                    aria-controls={panelId}
                    aria-describedby={countId}
                    aria-expanded={expanded}
                    aria-label={district.name}
                    className="district-toggle"
                    onClick={() => toggleDistrict(district.id)}
                    type="button"
                  >
                    <span>{district.name}</span>
                    <span id={countId}>{districtSelection.length} seçili</span>
                  </button>
                </legend>
                {districtSelection.length > 0 && (
                  <p className="district-selection-summary">
                    Seçili:{' '}
                    {districtSelection.map((item) => item.name).join(', ')}
                  </p>
                )}
                {expanded && (
                  <div className="district-panel" id={panelId}>
                    {(!loadResult || loadResult.status === 'loading') && (
                      <InlineLoading
                        label={`${district.name} mahalleleri yükleniyor`}
                      />
                    )}
                    {loadResult?.status === 'error' && (
                      <div className="district-load-error" role="alert">
                        <p>{loadResult.error}</p>
                        <button
                          className="secondary-button"
                          onClick={() => loadNeighborhoods(district.id)}
                          type="button"
                        >
                          Yeniden dene
                        </button>
                      </div>
                    )}
                    {loadResult?.status === 'loaded' && (
                      <>
                        {loadResult.neighborhoods.length === 0 ? (
                          <p className="empty-note">
                            Bu ilçede seçilebilecek mahalle bulunamadı.
                          </p>
                        ) : (
                          <>
                            <div className="coverage-toolbar">
                              <button
                                className="text-button"
                                onClick={() =>
                                  setSelected((current) => {
                                    const next = new Set(current)
                                    loadResult.neighborhoods.forEach((item) =>
                                      next.add(item.id),
                                    )
                                    return next
                                  })
                                }
                                type="button"
                              >
                                Bu ilçenin tümünü seç
                              </button>
                              <button
                                className="text-button"
                                onClick={() =>
                                  setSelected((current) => {
                                    const next = new Set(current)
                                    districtSelection.forEach((item) =>
                                      next.delete(item.id),
                                    )
                                    return next
                                  })
                                }
                                type="button"
                              >
                                Bu ilçenin seçimini temizle
                              </button>
                            </div>
                            <div className="neighborhood-grid">
                              {loadResult.neighborhoods.map((neighborhood) => (
                                <label
                                  className="checkbox-row compact"
                                  key={neighborhood.id}
                                >
                                  <input
                                    checked={selected.has(neighborhood.id)}
                                    onChange={() => toggle(neighborhood.id)}
                                    type="checkbox"
                                  />
                                  <span>{neighborhood.name}</span>
                                </label>
                              ))}
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </fieldset>
            )
          })}
        </div>
      )}
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <button
        className="primary-button"
        disabled={saving || districtLoadState === 'loading'}
        onClick={save}
        type="button"
      >
        {saving ? 'Kaydediliyor…' : 'Kapsamı kaydet'}
      </button>
    </section>
  )
}

function SchoolCatalogGuidance({
  availableCount,
  page,
  query,
}: {
  availableCount: number
  page: SchoolPage
  query: string
}) {
  if (availableCount > 0) return null
  if (page.totalElements === 0 && query) {
    return (
      <p className="empty-note">
        Bu aramayla eşleşen aktif okul bulunamadı. Okul adını kısaltarak yeniden
        deneyin.
      </p>
    )
  }
  if (page.totalElements === 0) {
    return (
      <p className="empty-note">
        Okul kataloğu henüz boş. Bir yönetici okul ekledikten sonra burada seçim
        yapabilirsiniz.
      </p>
    )
  }
  if (page.content.length === 0) {
    return (
      <p className="empty-note">
        Bu sayfada okul bulunamadı. Önceki sayfaya dönün veya aramayı yeniden
        çalıştırın.
      </p>
    )
  }
  return (
    <p className="empty-note">
      Bu sayfadaki tüm okullar zaten hizmet ağınıza eklenmiş. Diğer sayfalara
      geçebilir veya okul adıyla arayabilirsiniz.
    </p>
  )
}

function handleSession(
  error: unknown,
  navigate: ReturnType<typeof useNavigate>,
  setError: (message: string) => void,
) {
  if (error instanceof ApiError && error.sessionExpired) {
    void navigate('/operator/login?reason=session', { replace: true })
    return
  }
  setError(messageFor(error))
}

function messageFor(error: unknown): string {
  return error instanceof ApiError
    ? error.problem.detail
    : 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.'
}

function InlineLoading({ label }: { label: string }) {
  return (
    <div className="inline-loading" aria-busy="true" aria-live="polite">
      <span className="loading-dot" aria-hidden="true" />
      {label}
    </div>
  )
}

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
} from './operator-api'

export function OperatorSchoolsPage() {
  const navigate = useNavigate()
  const coverageHeadingRef = useRef<HTMLHeadingElement>(null)
  const [relationships, setRelationships] = useState<OperatorSchool[]>([])
  const [readiness, setReadiness] = useState<DiscoveryReadiness>()
  const [schoolResults, setSchoolResults] = useState<School[]>([])
  const [query, setQuery] = useState('')
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [editingCoverageId, setEditingCoverageId] = useState<string>()
  const [pendingFocusId, setPendingFocusId] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<{
    message: string
    tone: 'success' | 'warning'
  }>()

  useEffect(() => {
    let active = true
    void Promise.all([getOperatorSchools(), searchSchools('')])
      .then(([owned, schools]) => {
        if (!active) return
        setRelationships(owned)
        setSchoolResults(schools)
      })
      .catch((reason: unknown) => {
        if (!active) return
        handleSession(reason, navigate, setError)
      })
      .finally(() => {
        if (active) setLoading(false)
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
    setPending('search')
    setError(undefined)
    try {
      setSchoolResults(await searchSchools(query))
      setSelectedSchoolId('')
    } catch (reason) {
      setError(messageFor(reason))
    } finally {
      setPending(undefined)
    }
  }

  async function addSchool(event: FormEvent) {
    event.preventDefault()
    if (!selectedSchoolId) {
      setError('Eklemek için bir okul seçin.')
      return
    }
    setPending('add')
    setError(undefined)
    setNotice(undefined)
    try {
      const created = await addOperatorSchool(selectedSchoolId)
      setRelationships((current) => [...current, created])
      setSelectedSchoolId('')
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

  const availableSchools = schoolResults.filter(
    (school) =>
      !relationships.some(
        (relationship) => relationship.schoolId === school.id,
      ),
  )
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
            disabled={pending === 'search'}
            type="submit"
          >
            {pending === 'search' ? 'Aranıyor…' : 'Ara'}
          </button>
        </form>
        <form className="search-row" onSubmit={addSchool}>
          <label className="form-field grow">
            <span>Aktif okul</span>
            <select
              onChange={(event) => setSelectedSchoolId(event.target.value)}
              value={selectedSchoolId}
            >
              <option value="">Okul seçin</option>
              {availableSchools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name} — {school.districtName}
                </option>
              ))}
            </select>
          </label>
          <button
            className="primary-button"
            disabled={pending === 'add' || availableSchools.length === 0}
            type="submit"
          >
            {pending === 'add' ? 'Ekleniyor…' : 'Okulu ekle'}
          </button>
        </form>
        <SchoolCatalogGuidance
          availableCount={availableSchools.length}
          query={query}
          resultCount={schoolResults.length}
        />
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
  const [groups, setGroups] = useState<
    { district: District; neighborhoods: Neighborhood[] }[]
  >([])
  const [selected, setSelected] = useState(
    () => new Set(relationship.coverage.map((item) => item.neighborhoodId)),
  )
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string>()

  useEffect(() => {
    let active = true
    // shortcut: this loads one request per district; use a province endpoint if catalog scale makes this costly.
    void getDistricts(relationship.schoolProvinceId)
      .then((districts) =>
        Promise.all(
          districts.map(async (district) => ({
            district,
            neighborhoods: await getNeighborhoods(district.id),
          })),
        ),
      )
      .then((result) => {
        if (active) setGroups(result)
      })
      .catch((reason: unknown) => {
        if (active) setError(messageFor(reason))
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [relationship.schoolProvinceId])

  const selectedCount = selected.size
  const allNeighborhoodIds = useMemo(
    () => groups.flatMap((group) => group.neighborhoods.map((item) => item.id)),
    [groups],
  )

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
      {loading ? (
        <InlineLoading label="Mahalleler yükleniyor" />
      ) : (
        <>
          <div className="coverage-toolbar">
            <button
              className="text-button"
              onClick={() => setSelected(new Set(allNeighborhoodIds))}
              type="button"
            >
              Tümünü seç
            </button>
            <button
              className="text-button"
              onClick={() => setSelected(new Set())}
              type="button"
            >
              Seçimi temizle
            </button>
          </div>
          <div className="district-groups">
            {groups.length === 0 && (
              <div className="empty-state compact-empty">
                <h4>Mahalle kataloğu henüz boş</h4>
                <p>
                  Bu il için mahalle verisi eklenmeden hizmet kapsamı seçilemez.
                </p>
              </div>
            )}
            {groups.map(({ district, neighborhoods }) => (
              <fieldset key={district.id}>
                <legend>{district.name}</legend>
                <div className="neighborhood-grid">
                  {neighborhoods.map((neighborhood) => (
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
              </fieldset>
            ))}
          </div>
          {error && (
            <div className="form-error" role="alert">
              {error}
            </div>
          )}
          <button
            className="primary-button"
            disabled={saving}
            onClick={save}
            type="button"
          >
            {saving ? 'Kaydediliyor…' : 'Kapsamı kaydet'}
          </button>
        </>
      )}
    </section>
  )
}

function SchoolCatalogGuidance({
  availableCount,
  query,
  resultCount,
}: {
  availableCount: number
  query: string
  resultCount: number
}) {
  if (availableCount > 0) return null
  if (resultCount === 0 && query.trim()) {
    return (
      <p className="empty-note">
        Bu aramayla eşleşen aktif okul bulunamadı. Okul adını kısaltarak yeniden
        deneyin.
      </p>
    )
  }
  if (resultCount === 0) {
    return (
      <p className="empty-note">
        Pilot okul kataloğu henüz boş. Bir yönetici okul ekledikten sonra burada
        seçim yapabilirsiniz.
      </p>
    )
  }
  return (
    <p className="empty-note">
      Görüntülenen tüm okullar zaten hizmet ağınıza eklenmiş.
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

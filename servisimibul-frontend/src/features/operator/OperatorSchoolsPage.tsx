import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  addOperatorSchool,
  getDistricts,
  getNeighborhoods,
  getOperatorSchools,
  removeOperatorSchool,
  replaceCoverage,
  searchSchools,
  setOperatorSchoolActive,
  type District,
  type Neighborhood,
  type OperatorSchool,
  type School,
} from './operator-api'

export function OperatorSchoolsPage() {
  const navigate = useNavigate()
  const [relationships, setRelationships] = useState<OperatorSchool[]>([])
  const [schoolResults, setSchoolResults] = useState<School[]>([])
  const [query, setQuery] = useState('')
  const [selectedSchoolId, setSelectedSchoolId] = useState('')
  const [editingCoverageId, setEditingCoverageId] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()

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
    return () => {
      active = false
    }
  }, [navigate])

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
      setNotice('Okul çalışma alanınıza eklendi.')
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
      updateRelationship(
        await setOperatorSchoolActive(relationship.id, !relationship.active),
      )
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
      setNotice('Okul bağlantısı kaldırıldı.')
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
        Pilot okulları ekleyin; her okul için aynı ildeki hizmet mahallelerini
        seçin.
      </p>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="status-banner success" role="status">
          {notice}
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
            <span>Aktif pilot okul</span>
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
        {availableSchools.length === 0 && (
          <p className="empty-note">
            Aramanızda eklenebilecek başka aktif okul yok.
          </p>
        )}
      </section>

      <div className="school-list">
        {relationships.length === 0 ? (
          <div className="empty-state">
            <h2>Henüz okul eklenmedi</h2>
            <p>Yukarıdaki listeden ilk pilot okulunuzu seçebilirsiniz.</p>
          </div>
        ) : (
          relationships.map((relationship) => (
            <article className="school-card" key={relationship.id}>
              <div className="school-card-copy">
                <div className="school-title-row">
                  <h2>{relationship.schoolName}</h2>
                  <span
                    className={`status-pill ${relationship.active ? 'success' : 'neutral'}`}
                  >
                    {relationship.active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <p>
                  {relationship.schoolProvinceName} ·{' '}
                  {relationship.coverage.length} hizmet mahallesi
                </p>
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
                  disabled={pending === relationship.id}
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
                    setNotice('Hizmet kapsamı kaydedildi.')
                  }}
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
  relationship,
  onSaved,
}: {
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
    // shortcut: the pilot loads one request per district; use a province endpoint if catalog scale makes this costly.
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
          <h3>{relationship.schoolProvinceName} hizmet kapsamı</h3>
          <p>
            Farklı ilçelerden mahalle seçebilirsiniz; il dışı seçim yapılamaz.
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

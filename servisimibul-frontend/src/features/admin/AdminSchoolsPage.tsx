import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import {
  createSchool,
  getAdminSchools,
  getDistricts,
  getNeighborhoods,
  getProvinces,
  setSchoolActive,
  updateSchool,
  type District,
  type Neighborhood,
  type Province,
  type School,
  type SchoolPage,
  type SchoolWriteRequest,
} from './admin-api'

const emptyForm = {
  name: '',
  provinceId: '',
  districtId: '',
  neighborhoodId: '',
  address: '',
  sourceName: '',
  sourceCode: '',
  active: true,
}

export function AdminSchoolsPage() {
  const navigate = useNavigate()
  const [result, setResult] = useState<SchoolPage>()
  const [provinces, setProvinces] = useState<Province[]>([])
  const [districts, setDistricts] = useState<District[]>([])
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editing, setEditing] = useState<School>()
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pending, setPending] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState<string>()

  useEffect(() => {
    let active = true
    void getProvinces()
      .then((items) => {
        if (active) setProvinces(items)
      })
      .catch((failure: unknown) => {
        if (active) handleSession(failure, navigate, setError)
      })
    return () => {
      active = false
    }
  }, [navigate])

  useEffect(() => {
    let active = true
    void getAdminSchools(submittedQuery, page)
      .then((response) => {
        if (active) setResult(response)
      })
      .catch((failure: unknown) => {
        if (active) handleSession(failure, navigate, setError)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [navigate, page, submittedQuery])

  function chooseProvince(provinceId: string) {
    setForm((current) => ({
      ...current,
      provinceId,
      districtId: '',
      neighborhoodId: '',
    }))
    setNeighborhoods([])
    if (!provinceId) {
      setDistricts([])
      return
    }
    void getDistricts(Number(provinceId))
      .then(setDistricts)
      .catch((failure: unknown) => handleSession(failure, navigate, setError))
  }

  function chooseDistrict(districtId: string) {
    setForm((current) => ({
      ...current,
      districtId,
      neighborhoodId: '',
    }))
    if (!districtId) {
      setNeighborhoods([])
      return
    }
    void getNeighborhoods(Number(districtId))
      .then(setNeighborhoods)
      .catch((failure: unknown) => handleSession(failure, navigate, setError))
  }

  async function editSchool(school: School) {
    setEditing(school)
    setError(undefined)
    setFieldErrors({})
    try {
      const [nextDistricts, nextNeighborhoods] = await Promise.all([
        getDistricts(school.provinceId),
        getNeighborhoods(school.districtId),
      ])
      setDistricts(nextDistricts)
      setNeighborhoods(nextNeighborhoods)
      setForm({
        name: school.name,
        provinceId: String(school.provinceId),
        districtId: String(school.districtId),
        neighborhoodId: String(school.neighborhoodId),
        address: school.address ?? '',
        sourceName: school.sourceName ?? '',
        sourceCode: school.sourceCode ?? '',
        active: school.active,
      })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (failure) {
      setEditing(undefined)
      handleSession(failure, navigate, setError)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(undefined)
    setNotice(undefined)
    setFieldErrors({})
    const requiredErrors: Record<string, string> = {}
    if (!form.name.trim()) requiredErrors.name = 'Okul adı zorunludur.'
    if (!form.neighborhoodId) {
      requiredErrors.neighborhoodId = 'Mahalle zorunludur.'
    }
    if (Object.keys(requiredErrors).length > 0) {
      setFieldErrors(requiredErrors)
      setError('Okul adı ve mahalle zorunludur.')
      return
    }

    const request: SchoolWriteRequest = {
      neighborhoodId: Number(form.neighborhoodId),
      name: form.name.trim(),
      address: form.address.trim() || null,
      sourceName: form.sourceName.trim() || null,
      sourceCode: form.sourceCode.trim() || null,
      active: form.active,
    }
    setPending('save')
    try {
      const saved = editing
        ? await updateSchool(editing.id, {
            neighborhoodId: request.neighborhoodId,
            name: request.name,
            address: request.address,
            sourceName: request.sourceName,
            sourceCode: request.sourceCode,
          })
        : await createSchool(request)
      setResult((current) =>
        current
          ? {
              ...current,
              content: editing
                ? current.content.map((item) =>
                    item.id === saved.id ? saved : item,
                  )
                : [saved, ...current.content],
              totalElements: editing
                ? current.totalElements
                : current.totalElements + 1,
            }
          : current,
      )
      resetForm()
      setNotice(editing ? 'Okul güncellendi.' : 'Okul eklendi.')
    } catch (failure) {
      if (failure instanceof ApiError) {
        setFieldErrors(failure.problem.fieldErrors ?? {})
      }
      handleSession(failure, navigate, setError)
    } finally {
      setPending(undefined)
    }
  }

  async function toggleActive(school: School) {
    if (
      !window.confirm(
        `${school.name} ${school.active ? 'pasife alınsın' : 'etkinleştirilsin'} mi?`,
      )
    ) {
      return
    }
    setPending(school.id)
    setError(undefined)
    try {
      const updated = await setSchoolActive(school.id, !school.active)
      setResult((current) =>
        current
          ? {
              ...current,
              content: current.content.map((item) =>
                item.id === updated.id ? updated : item,
              ),
            }
          : current,
      )
      setNotice(
        updated.active ? 'Okul etkinleştirildi.' : 'Okul pasife alındı.',
      )
    } catch (failure) {
      handleSession(failure, navigate, setError)
    } finally {
      setPending(undefined)
    }
  }

  function resetForm() {
    setEditing(undefined)
    setForm(emptyForm)
    setDistricts([])
    setNeighborhoods([])
    setFieldErrors({})
  }

  return (
    <section className="workspace-page">
      <p className="eyebrow">Okul kataloğu</p>
      <h1>Okulları yönetin</h1>

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

      <form className="form-card compact-card form-stack" onSubmit={save}>
        <div className="section-heading">
          <h2>{editing ? 'Okulu düzenle' : 'Yeni okul ekle'}</h2>
          {editing && (
            <button className="text-button" onClick={resetForm} type="button">
              İptal
            </button>
          )}
        </div>
        <label className="form-field">
          <span>Okul adı</span>
          <input
            aria-describedby={
              fieldErrors.name ? 'admin-school-name-error' : undefined
            }
            aria-invalid={Boolean(fieldErrors.name)}
            onChange={(event) =>
              setForm((current) => ({ ...current, name: event.target.value }))
            }
            value={form.name}
          />
          {fieldErrors.name && (
            <small className="field-error" id="admin-school-name-error">
              {fieldErrors.name}
            </small>
          )}
        </label>
        <div className="location-grid">
          <label className="form-field">
            <span>İl</span>
            <select
              onChange={(event) => chooseProvince(event.target.value)}
              value={form.provinceId}
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
            <span>İlçe</span>
            <select
              disabled={!form.provinceId}
              onChange={(event) => chooseDistrict(event.target.value)}
              value={form.districtId}
            >
              <option value="">İlçe seçin</option>
              {districts.map((district) => (
                <option key={district.id} value={district.id}>
                  {district.name}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            <span>Mahalle</span>
            <select
              aria-describedby={
                fieldErrors.neighborhoodId
                  ? 'admin-school-neighborhood-error'
                  : undefined
              }
              aria-invalid={Boolean(fieldErrors.neighborhoodId)}
              disabled={!form.districtId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  neighborhoodId: event.target.value,
                }))
              }
              value={form.neighborhoodId}
            >
              <option value="">Mahalle seçin</option>
              {neighborhoods.map((neighborhood) => (
                <option key={neighborhood.id} value={neighborhood.id}>
                  {neighborhood.name}
                </option>
              ))}
            </select>
            {fieldErrors.neighborhoodId && (
              <small
                className="field-error"
                id="admin-school-neighborhood-error"
              >
                {fieldErrors.neighborhoodId}
              </small>
            )}
          </label>
        </div>
        <label className="form-field">
          <span>Adres (isteğe bağlı)</span>
          <textarea
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                address: event.target.value,
              }))
            }
            rows={3}
            value={form.address}
          />
        </label>
        <div className="location-grid">
          <label className="form-field">
            <span>Kaynak adı (isteğe bağlı)</span>
            <input
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sourceName: event.target.value,
                }))
              }
              value={form.sourceName}
            />
          </label>
          <label className="form-field">
            <span>Kaynak kodu (isteğe bağlı)</span>
            <input
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  sourceCode: event.target.value,
                }))
              }
              value={form.sourceCode}
            />
          </label>
        </div>
        {!editing && (
          <label className="checkbox-row">
            <input
              checked={form.active}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  active: event.target.checked,
                }))
              }
              type="checkbox"
            />
            <span>Okulu aktif olarak ekle</span>
          </label>
        )}
        <button className="primary-button" disabled={pending === 'save'}>
          {pending === 'save'
            ? 'Kaydediliyor…'
            : editing
              ? 'Değişiklikleri kaydet'
              : 'Okulu ekle'}
        </button>
      </form>

      <section className="catalog-section" aria-labelledby="school-list-title">
        <div className="section-heading">
          <h2 id="school-list-title">Okullar</h2>
          <span className="count-badge">{result?.totalElements ?? 0} okul</span>
        </div>
        <form
          className="search-row"
          onSubmit={(event) => {
            event.preventDefault()
            const nextQuery = query.trim()
            if (page !== 0 || nextQuery !== submittedQuery) {
              setLoading(true)
              setPage(0)
              setSubmittedQuery(nextQuery)
            }
          }}
        >
          <label className="form-field grow">
            <span>Okul ara</span>
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Okul adı"
              value={query}
            />
          </label>
          <button className="secondary-button">Ara</button>
        </form>

        {loading ? (
          <InlineLoading label="Okullar yükleniyor" />
        ) : result?.content.length ? (
          <div className="school-list">
            {result.content.map((school) => (
              <article className="school-card" key={school.id}>
                <div className="school-title-row">
                  <div>
                    <h3>{school.name}</h3>
                    <p>
                      {school.neighborhoodName} · {school.districtName} ·{' '}
                      {school.provinceName}
                    </p>
                  </div>
                  <span
                    className={`status-pill ${school.active ? 'success' : 'neutral'}`}
                  >
                    {school.active ? 'Aktif' : 'Pasif'}
                  </span>
                </div>
                <div className="button-row">
                  <button
                    className="secondary-button"
                    onClick={() => void editSchool(school)}
                    type="button"
                  >
                    Düzenle
                  </button>
                  <button
                    className={
                      school.active ? 'danger-button' : 'primary-button'
                    }
                    disabled={pending === school.id}
                    onClick={() => void toggleActive(school)}
                    type="button"
                  >
                    {school.active ? 'Pasife al' : 'Etkinleştir'}
                  </button>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <h3>Okul bulunamadı</h3>
            <p>Aramanızı değiştirin veya ilk okulu ekleyin.</p>
          </div>
        )}

        {result && result.totalPages > 1 && (
          <div className="button-row pagination" aria-label="Sayfalama">
            <button
              className="secondary-button"
              disabled={page === 0}
              onClick={() => {
                setLoading(true)
                setPage((current) => current - 1)
              }}
              type="button"
            >
              Önceki
            </button>
            <span>
              Sayfa {page + 1} / {result.totalPages}
            </span>
            <button
              className="secondary-button"
              disabled={page + 1 >= result.totalPages}
              onClick={() => {
                setLoading(true)
                setPage((current) => current + 1)
              }}
              type="button"
            >
              Sonraki
            </button>
          </div>
        )}
      </section>
    </section>
  )
}

function handleSession(
  failure: unknown,
  navigate: ReturnType<typeof useNavigate>,
  setError: (message: string) => void,
) {
  if (failure instanceof ApiError && failure.sessionExpired) {
    void navigate('/operator/login?reason=session', { replace: true })
    return
  }
  setError(
    failure instanceof ApiError
      ? failure.problem.detail
      : 'Beklenmeyen bir hata oluştu. Lütfen tekrar deneyin.',
  )
}

function InlineLoading({ label }: { label: string }) {
  return (
    <div className="inline-loading" aria-busy="true" aria-live="polite">
      <span className="loading-dot" aria-hidden="true" />
      {label}
    </div>
  )
}

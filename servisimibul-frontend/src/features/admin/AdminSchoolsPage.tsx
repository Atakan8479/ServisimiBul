import {
  useEffect,
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { StatePanel, StatusBadge } from '../../components/design-system'
import { OperatorInitials } from './AdminApplicationsPage'
import { AdminConfirmDialog } from './AdminConfirmDialog'
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
  const feedbackRef = useRef<HTMLDivElement>(null)
  const [result, setResult] = useState<SchoolPage>()
  const [provinces, setProvinces] = useState<Province[]>([])
  const [districts, setDistricts] = useState<District[]>([])
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([])
  const [form, setForm] = useState(emptyForm)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<School>()
  const [statusTarget, setStatusTarget] = useState<School>()
  const [attempt, setAttempt] = useState(0)
  const [query, setQuery] = useState('')
  const [submittedQuery, setSubmittedQuery] = useState('')
  const [page, setPage] = useState(0)
  const [pending, setPending] = useState<string>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()
  const [loadError, setLoadError] = useState<string>()
  const [formError, setFormError] = useState<string>()
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
        if (active) handleSession(failure, navigate, setLoadError)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [attempt, navigate, page, submittedQuery])

  useEffect(() => {
    if (notice || error) feedbackRef.current?.focus()
  }, [error, notice])

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
      .catch((failure: unknown) =>
        handleSession(failure, navigate, setFormError),
      )
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
      .catch((failure: unknown) =>
        handleSession(failure, navigate, setFormError),
      )
  }

  function addSchool() {
    resetForm()
    setError(undefined)
    setNotice(undefined)
    setEditorOpen(true)
  }

  async function editSchool(school: School) {
    if (pending) return
    resetForm()
    setPending(`edit-${school.id}`)
    setError(undefined)
    setNotice(undefined)
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
      setEditing(school)
      setEditorOpen(true)
    } catch (failure) {
      handleSession(failure, navigate, setError)
    } finally {
      setPending(undefined)
    }
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setFormError(undefined)
    setFieldErrors({})
    const requiredErrors: Record<string, string> = {}
    if (!form.name.trim()) requiredErrors.name = 'Okul adı zorunludur.'
    if (!form.neighborhoodId) {
      requiredErrors.neighborhoodId = 'Mahalle zorunludur.'
    }
    if (Object.keys(requiredErrors).length > 0) {
      setFieldErrors(requiredErrors)
      setFormError('Okul adı ve mahalle zorunludur.')
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
      closeEditor()
      setNotice(editing ? 'Okul güncellendi.' : 'Okul eklendi.')
    } catch (failure) {
      if (failure instanceof ApiError) {
        setFieldErrors(failure.problem.fieldErrors ?? {})
      }
      handleSession(failure, navigate, setFormError)
    } finally {
      setPending(undefined)
    }
  }

  async function toggleActive() {
    const school = statusTarget
    if (!school) return
    setPending(school.id)
    setError(undefined)
    setNotice(undefined)
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
        updated.active ? 'Okul etkinleştirildi.' : 'Okul devre dışı bırakıldı.',
      )
    } catch (failure) {
      handleSession(failure, navigate, setError)
    } finally {
      setPending(undefined)
      setStatusTarget(undefined)
    }
  }

  function resetForm() {
    setEditing(undefined)
    setForm(emptyForm)
    setDistricts([])
    setNeighborhoods([])
    setFieldErrors({})
    setFormError(undefined)
  }

  function closeEditor() {
    setEditorOpen(false)
    resetForm()
  }

  return (
    <section className="workspace-page admin-page admin-schools-page">
      <header className="admin-page-header admin-operator-header admin-detail-header">
        <div>
          <p className="admin-eyebrow">Yönetim paneli</p>
          <h1>Okul kataloğu</h1>
          <p>Okul kayıtlarını ve katalogdaki durumlarını yönetin.</p>
        </div>
        <button
          className="primary-button admin-school-add"
          onClick={addSchool}
          type="button"
        >
          <span aria-hidden="true">+</span> Okul ekle
        </button>
      </header>

      {(error || notice) && (
        <div className="admin-feedback" ref={feedbackRef} tabIndex={-1}>
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
        </div>
      )}

      <div className="admin-school-toolbar">
        <form
          className="admin-school-search"
          onSubmit={(event) => {
            event.preventDefault()
            const nextQuery = query.trim()
            if (page !== 0 || nextQuery !== submittedQuery) {
              setLoading(true)
              setLoadError(undefined)
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
        {result && !loading && !loadError && (
          <p className="admin-operator-count">{result.totalElements} toplam</p>
        )}
      </div>

      {loadError ? (
        <StatePanel
          action={
            <button
              className="secondary-button"
              onClick={() => {
                setLoading(true)
                setLoadError(undefined)
                setAttempt((current) => current + 1)
              }}
              type="button"
            >
              Tekrar dene
            </button>
          }
          detail={loadError}
          title="Okullar yüklenemedi"
          tone="error"
        />
      ) : loading ? (
        <StatePanel
          detail="Güncel okul kayıtları getiriliyor."
          title="Okullar yükleniyor"
          tone="loading"
        />
      ) : result?.content.length ? (
        <div className="admin-operator-table admin-school-table">
          <div aria-hidden="true" className="admin-operator-columns">
            <span>Okul</span>
            <span>İlçe / Mahalle</span>
            <span>Durum</span>
            <span>İşlem</span>
          </div>
          <ul>
            {result.content.map((school) => (
              <li className="admin-operator-row" key={school.id}>
                <div className="admin-operator-identity">
                  <OperatorInitials name={school.name} />
                  <div>
                    <h2 id={`school-${school.id}`}>{school.name}</h2>
                    {school.address && <p>{school.address}</p>}
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>İlçe / Mahalle</dt>
                    <dd>
                      {school.districtName} · {school.provinceName}
                      <small>{school.neighborhoodName}</small>
                    </dd>
                  </div>
                  <div>
                    <dt>Durum</dt>
                    <dd>
                      <StatusBadge tone={school.active ? 'success' : 'neutral'}>
                        {school.active ? 'Aktif' : 'Devre dışı'}
                      </StatusBadge>
                    </dd>
                  </div>
                </dl>
                <div className="admin-school-actions">
                  <button
                    aria-describedby={`school-${school.id}`}
                    className="text-button"
                    onClick={() => void editSchool(school)}
                    type="button"
                  >
                    Düzenle
                  </button>
                  <button
                    aria-describedby={`school-${school.id}`}
                    className="text-button"
                    disabled={pending === school.id}
                    onClick={() => setStatusTarget(school)}
                    type="button"
                  >
                    {school.active ? 'Devre dışı bırak' : 'Etkinleştir'}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="empty-state">
          <h2>Okul bulunamadı</h2>
          <p>Aramanızı değiştirin veya ilk okulu ekleyin.</p>
        </div>
      )}

      {result && result.totalPages > 1 && (
        <nav className="button-row pagination" aria-label="Sayfalama">
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
        </nav>
      )}

      {editorOpen && (
        <SchoolEditorDialog
          onCancel={closeEditor}
          pending={pending === 'save'}
          title={editing ? 'Okul kaydını düzenle' : 'Okul ekle'}
        >
          <form className="form-stack" noValidate onSubmit={save}>
            {formError && (
              <div className="form-error" role="alert">
                {formError}
              </div>
            )}
            <label className="form-field">
              <span>Okul adı</span>
              <input
                aria-describedby={
                  fieldErrors.name ? 'admin-school-name-error' : undefined
                }
                aria-invalid={Boolean(fieldErrors.name)}
                data-autofocus
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
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
            <div className="admin-confirm-actions">
              <button
                className="secondary-button"
                disabled={pending === 'save'}
                onClick={closeEditor}
                type="button"
              >
                Vazgeç
              </button>
              <button className="primary-button" disabled={pending === 'save'}>
                {pending === 'save'
                  ? 'Kaydediliyor…'
                  : editing
                    ? 'Değişiklikleri kaydet'
                    : 'Okulu ekle'}
              </button>
            </div>
          </form>
        </SchoolEditorDialog>
      )}

      {statusTarget && (
        <AdminConfirmDialog
          confirmLabel={
            statusTarget.active ? 'Devre dışı bırak' : 'Etkinleştir'
          }
          danger={statusTarget.active}
          onCancel={() => setStatusTarget(undefined)}
          onConfirm={() => void toggleActive()}
          pending={pending === statusTarget.id}
          title={`${statusTarget.name} ${
            statusTarget.active
              ? 'devre dışı bırakılsın mı?'
              : 'etkinleştirilsin mi?'
          }`}
        >
          <p>
            {statusTarget.active
              ? 'Okul bu katalogda kalır, ancak veli aramalarında ve işletmeci yayınlarında kullanılamaz.'
              : 'Okul yeniden veli aramalarında ve işletmeci kapsamlarında kullanılabilir.'}
          </p>
        </AdminConfirmDialog>
      )}
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

function SchoolEditorDialog({
  children,
  onCancel,
  pending,
  title,
}: {
  children: ReactNode
  onCancel: () => void
  pending: boolean
  title: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    dialog?.showModal()
    dialog?.querySelector<HTMLElement>('[data-autofocus]')?.focus()
    return () => {
      dialog?.close()
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  return (
    <dialog
      aria-labelledby={titleId}
      className="admin-confirm-dialog admin-school-dialog"
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onCancel()
      }}
      ref={dialogRef}
    >
      <h2 id={titleId}>{title}</h2>
      {children}
    </dialog>
  )
}

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { StatePanel, StatusBadge } from '../../components/design-system'
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
import { schoolInitials } from './school-initials'

const visibleCoverageChips = 6

export function OperatorSchoolsPage() {
  const navigate = useNavigate()
  const addButtonRef = useRef<HTMLButtonElement>(null)
  const filterRef = useRef<HTMLInputElement>(null)
  const schoolRequest = useRef<AbortController | undefined>(undefined)
  // State updates only after the event, so two clicks in one tick need a sync lock.
  const rowLock = useRef(false)
  const focusAddAfterRemoval = useRef(false)
  const [relationships, setRelationships] = useState<OperatorSchool[]>([])
  const [readiness, setReadiness] = useState<DiscoveryReadiness>()
  const [districtNames, setDistrictNames] = useState<Record<number, string>>({})
  const [schoolPage, setSchoolPage] = useState<SchoolPage>()
  const [schoolRequestParameters, setSchoolRequestParameters] = useState({
    query: '',
    page: 0,
  })
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('')
  const [selectedSchool, setSelectedSchool] = useState<School>()
  const [addOpen, setAddOpen] = useState(false)
  const [addError, setAddError] = useState<string>()
  const [editingCoverageId, setEditingCoverageId] = useState<string>()
  const [removeTarget, setRemoveTarget] = useState<OperatorSchool>()
  const [removeError, setRemoveError] = useState<string>()
  const [attempt, setAttempt] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string>()
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
    void getOperatorSchools()
      .then((owned) => {
        if (active) setRelationships(owned)
      })
      .catch((reason: unknown) => {
        if (active) handleSession(reason, navigate, setLoadError)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [attempt, navigate])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    schoolRequest.current = controller
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

  // The school response carries only a district id, so names come from the catalog.
  const provinceKey = [
    ...new Set(relationships.map((item) => item.schoolProvinceId)),
  ]
    .sort((left, right) => left - right)
    .join(',')

  useEffect(() => {
    if (!provinceKey) return
    const controller = new AbortController()
    provinceKey.split(',').forEach((provinceId) => {
      void getDistricts(Number(provinceId), controller.signal)
        .then((districts) => {
          if (controller.signal.aborted) return
          setDistrictNames((current) => ({
            ...current,
            ...Object.fromEntries(
              districts.map((item) => [item.id, item.name]),
            ),
          }))
        })
        .catch(() => undefined)
    })
    return () => controller.abort()
  }, [provinceKey])

  useEffect(() => {
    if (removeTarget || !focusAddAfterRemoval.current) return
    focusAddAfterRemoval.current = false
    addButtonRef.current?.focus()
  }, [removeTarget])

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

  function closeAddDialog() {
    setAddOpen(false)
    setAddError(undefined)
    setSelectedSchool(undefined)
  }

  async function addSchool(event: FormEvent) {
    event.preventDefault()
    if (!selectedSchool) {
      setAddError('Eklemek için bir okul seçin.')
      return
    }
    setPending('add')
    setAddError(undefined)
    setNotice(undefined)
    try {
      const created = await addOperatorSchool(selectedSchool.id)
      setRelationships((current) => [...current, created])
      closeAddDialog()
      setEditingCoverageId(created.id)
      setNotice({
        message:
          'Okul eklendi. Şimdi bu okul için hizmet mahallelerini seçip kapsamı kaydedin.',
        tone: 'success',
      })
    } catch (reason) {
      handleSession(reason, navigate, setAddError)
    } finally {
      setPending(undefined)
    }
  }

  async function toggleActive(relationship: OperatorSchool) {
    if (rowLock.current) return
    rowLock.current = true
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
      rowLock.current = false
      setPending(undefined)
    }
  }

  async function remove(relationship: OperatorSchool) {
    if (rowLock.current) return
    rowLock.current = true
    setPending(relationship.id)
    setRemoveError(undefined)
    try {
      await removeOperatorSchool(relationship.id)
      setRelationships((current) =>
        current.filter((item) => item.id !== relationship.id),
      )
      focusAddAfterRemoval.current = true
      setRemoveTarget(undefined)
      setNotice({
        message: 'Okul bağlantısı ve okula özel kapsam kaldırıldı.',
        tone: 'warning',
      })
    } catch (reason) {
      handleSession(reason, navigate, setRemoveError)
    } finally {
      rowLock.current = false
      setPending(undefined)
    }
  }

  function updateRelationship(updated: OperatorSchool) {
    setRelationships((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    )
  }

  function districtNameFor(relationship: OperatorSchool) {
    return (
      districtNames[relationship.schoolDistrictId] ??
      relationship.coverage.find(
        (item) => item.districtId === relationship.schoolDistrictId,
      )?.districtName
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
  const activeCount = relationships.filter(
    (relationship) => relationship.active && relationship.schoolActive,
  ).length
  const normalizedFilter = filter.trim().toLocaleLowerCase('tr-TR')
  const visibleRelationships = relationships.filter((relationship) =>
    [
      relationship.schoolName,
      districtNameFor(relationship) ?? '',
      ...relationship.coverage.flatMap((item) => [
        item.neighborhoodName,
        item.districtName,
      ]),
    ]
      .join(' ')
      .toLocaleLowerCase('tr-TR')
      .includes(normalizedFilter),
  )

  if (loading) {
    return <InlineLoading label="Okullar yükleniyor" />
  }

  return (
    <section className="workspace-page operator-workspace-page operator-schools-page">
      <header className="operator-page-header operator-overview-header">
        <div>
          <p className="operator-eyebrow">İşletmeci paneli</p>
          <h1>Okullar ve hizmet kapsamı</h1>
          <p>Hangi okullara ve mahallelere hizmet verdiğinizi yönetin.</p>
        </div>
        <button
          className="primary-button operator-school-add"
          disabled={Boolean(loadError)}
          onClick={() => setAddOpen(true)}
          ref={addButtonRef}
          type="button"
        >
          <span aria-hidden="true">+</span> Okul ekle
        </button>
      </header>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div
          className={`status-banner operator-action-notice ${notice.tone}`}
          role="status"
        >
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

      <aside className="operator-coverage-note">
        <span className="operator-coverage-note-icon" aria-hidden="true" />
        <div>
          <strong>Kapsamı okul bazında belirtin</strong>
          <p>
            Mahalle eşleşmesi, belirli bir ev adresinden alım sözü anlamına
            gelmez. Aileler güzergâhı doğrudan teyit eder.
          </p>
        </div>
      </aside>

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
      ) : relationships.length === 0 ? (
        <div className="empty-state">
          <h2>Henüz okul eklenmedi</h2>
          <button
            className="text-button"
            onClick={() => setAddOpen(true)}
            type="button"
          >
            Okul aramasına git
          </button>
        </div>
      ) : (
        <>
          <div className="operator-school-toolbar">
            <input
              aria-label="Okul veya mahalle ara"
              className="operator-school-filter"
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Okul veya mahalle ara"
              ref={filterRef}
              type="search"
              value={filter}
            />
            <div>
              <span className="count-badge">{activeCount} aktif okul</span>
              <button
                className="secondary-button"
                onClick={() => {
                  setFilter('')
                  filterRef.current?.focus()
                }}
                type="button"
              >
                Filtreleri temizle
              </button>
            </div>
          </div>
          <div className="operator-school-table">
            <div aria-hidden="true" className="operator-school-columns">
              <span>Okul</span>
              <span>İlçe</span>
              <span>Hizmet mahalleleri</span>
              <span>Durum</span>
              <span>İşlem</span>
            </div>
            {visibleRelationships.length === 0 ? (
              <p className="operator-school-no-match" role="status">
                Eşleşen okul yok. Arama terimini değiştirin veya yeni okul
                ekleyin.
              </p>
            ) : (
              <ul>
                {visibleRelationships.map((relationship) => (
                  <SchoolRow
                    districtName={districtNameFor(relationship)}
                    key={relationship.id}
                    onEdit={() => setEditingCoverageId(relationship.id)}
                    onRemove={() => {
                      setRemoveError(undefined)
                      setRemoveTarget(relationship)
                    }}
                    onToggle={() => void toggleActive(relationship)}
                    pending={pending === relationship.id}
                    relationship={relationship}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}

      {addOpen && (
        <SchoolDialog
          description="Okulu arayın, seçin ve ardından hizmet mahallelerini ekleyin."
          onCancel={closeAddDialog}
          pending={pending === 'add'}
          title="Hizmet kapsamına okul ekle"
        >
          <form className="search-row" onSubmit={findSchools}>
            <label className="form-field grow">
              <span>Okul ara</span>
              <input
                data-autofocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Okul adı"
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
          <form className="operator-add-school-form" onSubmit={addSchool}>
            <label className="form-field">
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
            {!schoolLoading && !schoolError && schoolPage && (
              <SchoolCatalogGuidance
                availableCount={availableSchools.length}
                page={schoolPage}
                query={schoolRequestParameters.query}
              />
            )}
            {addError && (
              <div className="form-error" role="alert">
                {addError}
              </div>
            )}
            <div className="operator-dialog-actions">
              <button
                className="secondary-button"
                disabled={pending === 'add'}
                onClick={closeAddDialog}
                type="button"
              >
                Vazgeç
              </button>
              <button
                className="primary-button"
                disabled={pending === 'add' || !selectedSchool}
                type="submit"
              >
                {pending === 'add' ? 'Ekleniyor…' : 'Okulu ekle'}
              </button>
            </div>
          </form>
        </SchoolDialog>
      )}

      {editingRelationship && (
        <CoverageEditor
          key={editingRelationship.id}
          onClose={() => setEditingCoverageId(undefined)}
          onSaved={(updated) => {
            updateRelationship(updated)
            setEditingCoverageId(undefined)
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
          relationship={editingRelationship}
        />
      )}

      {removeTarget && (
        <SchoolDialog
          description={`${removeTarget.schoolName} bağlantısı ve okula özel kapsamı kaldırılacak.`}
          onCancel={() => setRemoveTarget(undefined)}
          pending={pending === removeTarget.id}
          title="Okul kapsamı kaldırılsın mı?"
        >
          {removeError && (
            <div className="form-error" role="alert">
              {removeError}
            </div>
          )}
          <div className="operator-dialog-actions">
            <button
              className="secondary-button"
              data-autofocus
              disabled={pending === removeTarget.id}
              onClick={() => setRemoveTarget(undefined)}
              type="button"
            >
              Vazgeç
            </button>
            <button
              className="danger-button"
              disabled={pending === removeTarget.id}
              onClick={() => void remove(removeTarget)}
              type="button"
            >
              {pending === removeTarget.id ? 'Kaldırılıyor…' : 'Kaldır'}
            </button>
          </div>
        </SchoolDialog>
      )}
    </section>
  )
}

function SchoolRow({
  districtName,
  onEdit,
  onRemove,
  onToggle,
  pending,
  relationship,
}: {
  districtName: string | undefined
  onEdit: () => void
  onRemove: () => void
  onToggle: () => void
  pending: boolean
  relationship: OperatorSchool
}) {
  const nameId = `operator-school-${relationship.id}`
  const hiddenChips = relationship.coverage.length - visibleCoverageChips
  return (
    <li>
      <article className="operator-school-row">
        <div className="operator-school-identity">
          <span className="operator-school-mark" aria-hidden="true">
            {schoolInitials(relationship.schoolName)}
          </span>
          <div>
            <h2 id={nameId}>{relationship.schoolName}</h2>
            <p>
              {relationship.schoolProvinceName} · {relationship.coverage.length}{' '}
              hizmet mahallesi
            </p>
          </div>
        </div>
        <dl>
          <div>
            <dt>İlçe</dt>
            <dd>{districtName ?? relationship.schoolProvinceName}</dd>
          </div>
          <div className="operator-school-coverage">
            <dt>Hizmet mahalleleri</dt>
            <dd>
              {relationship.coverage.length > 0 && (
                <ul className="operator-coverage-chips">
                  {relationship.coverage
                    .slice(0, visibleCoverageChips)
                    .map((item) => (
                      <li key={item.neighborhoodId}>
                        {item.neighborhoodName}
                        {item.districtId !== relationship.schoolDistrictId &&
                          ` · ${item.districtName}`}
                      </li>
                    ))}
                  {hiddenChips > 0 && <li>+{hiddenChips} mahalle</li>}
                </ul>
              )}
              <button
                aria-describedby={nameId}
                className="text-button"
                onClick={onEdit}
                type="button"
              >
                + Mahalle düzenle
              </button>
            </dd>
          </div>
          <div>
            <dt>Durum</dt>
            <dd>
              <StatusBadge
                tone={
                  relationship.active && relationship.schoolActive
                    ? 'success'
                    : 'neutral'
                }
              >
                {!relationship.schoolActive
                  ? 'Okul pasif'
                  : relationship.active
                    ? 'Aktif'
                    : 'Bağlantı pasif'}
              </StatusBadge>
            </dd>
          </div>
        </dl>
        <div className="operator-school-actions">
          <button
            aria-describedby={nameId}
            className="text-button"
            onClick={onEdit}
            type="button"
          >
            Düzenle
          </button>
          {/* aria-disabled keeps keyboard focus on the button during the request. */}
          <button
            aria-describedby={nameId}
            aria-disabled={pending}
            className="text-button"
            disabled={!relationship.schoolActive}
            onClick={() => {
              if (!pending) onToggle()
            }}
            type="button"
          >
            {relationship.active ? 'Pasifleştir' : 'Etkinleştir'}
          </button>
          <button
            aria-describedby={nameId}
            aria-disabled={pending}
            className="text-button"
            onClick={() => {
              if (!pending) onRemove()
            }}
            type="button"
          >
            Kaldır
          </button>
        </div>
        {!relationship.schoolActive && (
          <p className="school-warning">
            Bu okul yönetici tarafından pasife alındı ve aramalara katkı
            sağlamaz.
          </p>
        )}
        {relationship.schoolActive && !relationship.active && (
          <p className="school-warning">
            Bu bağlantıyı etkinleştirene kadar okul aramalara katkı sağlamaz.
          </p>
        )}
        {relationship.schoolActive &&
          relationship.active &&
          relationship.coverage.length === 0 && (
            <p className="school-warning">
              Bu okul için hizmet verdiğiniz mahalleleri seçip kaydedin.
            </p>
          )}
      </article>
    </li>
  )
}

function SchoolDialog({
  children,
  description,
  onCancel,
  pending,
  title,
  wide = false,
}: {
  children: ReactNode
  description: string
  onCancel: () => void
  pending: boolean
  title: string
  wide?: boolean
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descriptionId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    dialog?.showModal()
    const target =
      dialog?.querySelector<HTMLElement>('[data-autofocus]') ??
      dialog?.querySelector<HTMLElement>('h2')
    target?.focus()
    return () => {
      dialog?.close()
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      className={`operator-dialog${wide ? ' operator-dialog-wide' : ''}`}
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onCancel()
      }}
      onClose={(event) => {
        // Repeated Escape can close a native dialog without a cancel event.
        const dialog = event.currentTarget
        if (dialog.open) return
        if (pending) dialog.showModal()
        else onCancel()
      }}
      ref={dialogRef}
    >
      <header className="operator-dialog-header">
        <div>
          <h2 id={titleId} tabIndex={-1}>
            {title}
          </h2>
          <p id={descriptionId}>{description}</p>
        </div>
        <button
          aria-label="Kapat"
          className="operator-dialog-close"
          disabled={pending}
          onClick={onCancel}
          type="button"
        >
          <span aria-hidden="true">×</span>
        </button>
      </header>
      <div className="operator-dialog-body">{children}</div>
    </dialog>
  )
}

function CoverageEditor({
  relationship,
  onClose,
  onSaved,
}: {
  relationship: OperatorSchool
  onClose: () => void
  onSaved: (updated: OperatorSchool) => void
}) {
  const navigate = useNavigate()
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
    } catch (reason) {
      handleSession(reason, navigate, setError)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SchoolDialog
      description={`${relationship.schoolName} için hizmet mahalleleri. Aynı ildeki farklı ilçelerden mahalle seçebilirsiniz.`}
      onCancel={onClose}
      pending={saving}
      title="Okul kapsamını düzenle"
      wide
    >
      <div className="operator-coverage-count">
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
              <h4>Bu ilde henüz mahalle bilgisi bulunmuyor</h4>
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
                <legend className="operator-district-legend">
                  <button
                    aria-controls={panelId}
                    aria-describedby={countId}
                    aria-expanded={expanded}
                    className="district-toggle"
                    onClick={() => toggleDistrict(district.id)}
                    type="button"
                  >
                    {district.name}
                  </button>
                  <span id={countId}>{districtSelection.length} seçili</span>
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
      <div className="operator-dialog-actions operator-dialog-sticky-actions">
        <button
          className="secondary-button"
          disabled={saving}
          onClick={onClose}
          type="button"
        >
          Vazgeç
        </button>
        <button
          className="primary-button"
          disabled={saving || districtLoadState === 'loading'}
          onClick={save}
          type="button"
        >
          {saving ? 'Kaydediliyor…' : 'Kapsamı kaydet'}
        </button>
      </div>
    </SchoolDialog>
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
      Bu sayfadaki tüm okulları eklemişsiniz. Başka bir okul arayabilirsiniz.
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

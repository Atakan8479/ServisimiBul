import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from 'react'
import { flushSync } from 'react-dom'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { StatePanel, StatusBadge } from '../../components/design-system'
import { getOperatorSchools, type OperatorSchool } from './operator-api'
import {
  createOffering,
  createVehicle,
  deactivateVehicle,
  deleteVehicle,
  getOfferings,
  getVehicles,
  replaceOfferingCoverage,
  setOfferingPublished,
  updateOffering,
  updateVehicle,
  type ServiceOffering,
  type Vehicle,
} from './offering-api'
import { exitDialog } from '../../components/dialog-exit'

type ResourceKey = 'vehicles' | 'offerings' | 'schools'
type LoadStatus = 'loading' | 'error' | 'ready'
const resourceKeys: ResourceKey[] = ['vehicles', 'offerings', 'schools']

export function OperatorOfferingsPage() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [offerings, setOfferings] = useState<ServiceOffering[]>([])
  const [schools, setSchools] = useState<OperatorSchool[]>([])
  // Each initial read is independent so one failure never hides or empties the others.
  const [loadStatus, setLoadStatus] = useState<Record<ResourceKey, LoadStatus>>(
    { vehicles: 'loading', offerings: 'loading', schools: 'loading' },
  )
  // Latest request per resource; older or post-unmount responses are ignored.
  const loadRequests = useRef<Record<ResourceKey, number>>({
    vehicles: 0,
    offerings: 0,
    schools: 0,
  })
  const sessionRedirected = useRef(false)
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [vehicleCreateOpen, setVehicleCreateOpen] = useState(false)
  const [vehicleToEdit, setVehicleToEdit] = useState<Vehicle>()
  const [vehicleToDelete, setVehicleToDelete] = useState<Vehicle>()
  // True when vehicle eligibility could not be re-read after a change; hides deletion (fail closed).
  const [eligibilityStale, setEligibilityStale] = useState(false)
  const vehiclesHeadingRef = useRef<HTMLHeadingElement>(null)
  const offeringsHeadingRef = useRef<HTMLHeadingElement>(null)
  const cancelDeleteRef = useRef<HTMLButtonElement>(null)
  const [offeringCreateOpen, setOfferingCreateOpen] = useState(false)
  const [offeringToEdit, setOfferingToEdit] = useState<ServiceOffering>()

  const loadResource = useCallback(
    (key: ResourceKey) => {
      const request = ++loadRequests.current[key]
      const read: Promise<() => void> =
        key === 'vehicles'
          ? getVehicles().then((data) => () => {
              setVehicles(data)
              setEligibilityStale(false)
            })
          : key === 'offerings'
            ? getOfferings().then((data) => () => setOfferings(data))
            : getOperatorSchools().then((data) => () => setSchools(data))
      void read.then(
        (apply) => {
          if (loadRequests.current[key] !== request) return
          apply()
          setLoadStatus((current) => ({ ...current, [key]: 'ready' }))
        },
        (reason: unknown) => {
          if (loadRequests.current[key] !== request) return
          if (reason instanceof ApiError && reason.sessionExpired) {
            if (!sessionRedirected.current) {
              sessionRedirected.current = true
              void navigate('/operator/login?reason=session', {
                replace: true,
              })
            }
            return
          }
          // Never treat a failed read as an empty list.
          setLoadStatus((current) => ({ ...current, [key]: 'error' }))
        },
      )
    },
    [navigate],
  )

  useEffect(() => {
    const requests = loadRequests.current
    for (const key of resourceKeys) loadResource(key)
    return () => {
      for (const key of resourceKeys) requests[key] += 1
    }
  }, [loadResource])

  function retryLoad(key: ResourceKey) {
    setLoadStatus((current) => ({ ...current, [key]: 'loading' }))
    // The retry button unmounts while loading; keep focus in the same section.
    ;(key === 'vehicles'
      ? vehiclesHeadingRef
      : offeringsHeadingRef
    ).current?.focus()
    loadResource(key)
  }

  const vehiclesReady = loadStatus.vehicles === 'ready'
  const schoolsReady = loadStatus.schools === 'ready'
  const offeringsReady = loadStatus.offerings === 'ready'
  // Editing and publishing need verified vehicle and school options.
  const prerequisitesVerified = vehiclesReady && schoolsReady
  const activeVehicles = vehicles.filter((vehicle) => vehicle.active)
  const activeSchools = schools.filter((school) => school.active)
  const canCreateOffering =
    prerequisitesVerified &&
    offeringsReady &&
    activeSchools.length > 0 &&
    activeVehicles.length > 0

  function updateVehicleState(updated: Vehicle) {
    setVehicles((current) =>
      current.map((vehicle) => (vehicle.id === updated.id ? updated : vehicle)),
    )
    setOfferings((current) =>
      current.map((offering) =>
        offering.vehicleId === updated.id
          ? {
              ...offering,
              vehiclePlate: updated.plate,
              vehicleCapacity: updated.capacity,
            }
          : offering,
      ),
    )
  }

  function updateOfferingState(updated: ServiceOffering) {
    setOfferings((current) =>
      current.map((offering) =>
        offering.id === updated.id ? updated : offering,
      ),
    )
  }

  async function toggleVehicle(vehicle: Vehicle) {
    if (
      vehicle.active &&
      !window.confirm(
        'Araç pasife alınsın mı? Bu araca bağlı yayımlanmış servisler taslağa döner.',
      )
    ) {
      return
    }

    setPending(`vehicle-${vehicle.id}`)
    setError(undefined)
    setNotice(undefined)
    try {
      const updated = vehicle.active
        ? await deactivateVehicle(vehicle.id)
        : await updateVehicle(vehicle.id, {
            plate: vehicle.plate,
            capacity: vehicle.capacity,
            active: true,
          })
      updateVehicleState(updated)
      // An unloaded offerings section is re-read by its own retry instead.
      if (vehicle.active && offeringsReady) {
        const request = ++loadRequests.current.offerings
        const next = await getOfferings()
        if (loadRequests.current.offerings === request) setOfferings(next)
      }
      setNotice(
        vehicle.active
          ? 'Araç pasife alındı; bağlı servislerin yayın durumu yenilendi.'
          : 'Araç etkinleştirildi. Servisler otomatik yayımlanmaz.',
      )
    } catch (reason) {
      handleSession(reason, navigate, setError)
    } finally {
      setPending(undefined)
    }
  }

  /** Re-reads backend-authoritative deletion eligibility after offerings change. */
  async function refreshVehicles() {
    const request = ++loadRequests.current.vehicles
    try {
      const next = await getVehicles()
      if (loadRequests.current.vehicles !== request) return
      setVehicles(next)
      setEligibilityStale(false)
    } catch {
      if (loadRequests.current.vehicles !== request) return
      setEligibilityStale(true)
    }
  }

  async function removeVehicle(vehicle: Vehicle) {
    setPending(`vehicle-delete-${vehicle.id}`)
    setError(undefined)
    setNotice(undefined)
    let moveFocusToFleet = true
    try {
      await deleteVehicle(vehicle.id)
      setVehicles((current) => current.filter((item) => item.id !== vehicle.id))
      setNotice(`${vehicle.plate} plakalı araç kalıcı olarak silindi.`)
    } catch (reason) {
      const code = reason instanceof ApiError ? reason.problem.code : undefined
      if (code && code in deletionConflictMessages) {
        // Eligibility changed elsewhere (for example another tab); show the server's answer.
        await refreshVehicles()
        setError(deletionConflictMessages[code])
      } else if (code === 'vehicle_not_found') {
        setVehicles((current) =>
          current.filter((item) => item.id !== vehicle.id),
        )
        setNotice('Araç zaten silinmiş; liste güncellendi.')
      } else {
        moveFocusToFleet = false
        handleSession(reason, navigate, setError)
      }
    } finally {
      // Commit synchronously so the modal is gone before focus moves.
      flushSync(() => {
        setVehicleToDelete(undefined)
        setPending(undefined)
      })
    }
    // The opener may no longer exist, so keep keyboard focus in the fleet section.
    if (moveFocusToFleet) vehiclesHeadingRef.current?.focus()
  }

  async function toggleOffering(offering: ServiceOffering) {
    setPending(`offering-${offering.id}`)
    setError(undefined)
    setNotice(undefined)
    try {
      updateOfferingState(
        await setOfferingPublished(offering.id, !offering.published),
      )
      setNotice(
        offering.published
          ? 'Servis yayından kaldırıldı.'
          : 'Servis yayımlandı.',
      )
    } catch (reason) {
      handleSession(reason, navigate, setError)
    } finally {
      setPending(undefined)
    }
  }

  return (
    <section className="workspace-page operator-workspace-page operator-offerings-page">
      <header className="operator-page-header operator-offerings-header">
        <h1>Araçlar ve servis teklifleri</h1>
        <p>Paylaşmak istediğiniz araç ve hizmet ayrıntılarını düzenleyin.</p>
        <p className="operator-offerings-optional-note">
          Araç ve ayrıntılı servis teklifi eklemek arama görünürlüğü için
          zorunlu değildir.
        </p>
      </header>

      <div className="operator-offerings-callout">
        <InfoIcon />
        <p>
          <strong>Bu bölüm isteğe bağlıdır.</strong> Araç veya teklif eklemeden
          de okul ve mahalle kapsamınızla uygun aramalarda yer alabilirsiniz.
        </p>
      </div>

      {error && (
        <div className="form-error" role="alert">
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div
          className="status-banner operator-action-notice success"
          role="status"
        >
          {notice}
        </div>
      )}

      <section
        aria-labelledby="vehicles-title"
        className="operator-offerings-section"
      >
        <div className="operator-offerings-section-heading">
          <div>
            <h2 id="vehicles-title" ref={vehiclesHeadingRef} tabIndex={-1}>
              Filo bilgileri
            </h2>
            <p>Servis tekliflerinizde kullanacağınız araçları yönetin.</p>
          </div>
          {vehiclesReady && (
            <button
              className="secondary-button operator-add-button"
              onClick={() => setVehicleCreateOpen(true)}
              type="button"
            >
              <PlusIcon />
              Araç ekle
            </button>
          )}
        </div>

        {loadStatus.vehicles === 'loading' ? (
          <InlineLoading label="Araçlar yükleniyor" />
        ) : loadStatus.vehicles === 'error' ? (
          <LoadErrorPanel
            detail="Filo bilgileriniz şu anda alınamadı. Araç ekleme ve silme, bilgiler yüklenene kadar kapalıdır."
            onRetry={() => retryLoad('vehicles')}
            title="Araç bilgileri yüklenemedi"
          />
        ) : vehicles.length === 0 ? (
          <StatePanel
            action={
              <button
                className="primary-button"
                onClick={() => setVehicleCreateOpen(true)}
                type="button"
              >
                İlk aracı ekle
              </button>
            }
            detail="Servis teklifi paylaşmak isterseniz önce plaka ve kapasite bilgisiyle bir araç ekleyin."
            title="Henüz araç eklenmedi"
          />
        ) : (
          <div className="operator-vehicle-grid">
            {vehicles.map((vehicle) => (
              <article className="operator-vehicle-card" key={vehicle.id}>
                <div className="operator-vehicle-visual" aria-hidden="true">
                  <BusIcon />
                </div>
                <div className="operator-vehicle-body">
                  <div className="operator-vehicle-status-row">
                    <StatusBadge tone={vehicle.active ? 'success' : 'neutral'}>
                      {vehicle.active ? 'Etkin' : 'Pasif'}
                    </StatusBadge>
                    <button
                      aria-label={`${vehicle.plate} aracını düzenle`}
                      className="operator-icon-button"
                      onClick={() => setVehicleToEdit(vehicle)}
                      type="button"
                    >
                      <EditIcon />
                    </button>
                  </div>
                  <h3>{vehicle.plate}</h3>
                  <p className="operator-vehicle-capacity">
                    <SeatIcon /> {vehicle.capacity} kişilik kapasite
                  </p>
                  <button
                    className="operator-text-action"
                    disabled={pending === `vehicle-${vehicle.id}`}
                    onClick={() => void toggleVehicle(vehicle)}
                    type="button"
                  >
                    {pending === `vehicle-${vehicle.id}`
                      ? 'Güncelleniyor…'
                      : vehicle.active
                        ? 'Pasife al'
                        : 'Etkinleştir'}
                    <ArrowIcon />
                  </button>
                  {!vehicle.deletable || eligibilityStale ? (
                    <p className="operator-vehicle-removal-note">
                      {eligibilityStale
                        ? 'Silme uygunluğu doğrulanamadı; sayfayı yenileyin.'
                        : deletionBlockedNotes[
                            vehicle.deletionBlockedReason ?? 'HISTORY_UNKNOWN'
                          ]}
                    </p>
                  ) : (
                    <button
                      aria-label={`${vehicle.plate} aracını kalıcı olarak sil`}
                      className="operator-text-action operator-text-action-danger"
                      disabled={pending !== undefined}
                      onClick={() => setVehicleToDelete(vehicle)}
                      type="button"
                    >
                      Sil
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section
        aria-labelledby="offerings-title"
        className="operator-offerings-section"
      >
        <div className="operator-offerings-section-heading">
          <div>
            <h2 id="offerings-title" ref={offeringsHeadingRef} tabIndex={-1}>
              Paylaşılan hizmetler
            </h2>
            <p>
              Okul ve mahalle kapsamıyla ilişkilendirilmiş servis teklifleri.
            </p>
          </div>
          {canCreateOffering && (
            <button
              className="primary-button operator-add-button"
              onClick={() => setOfferingCreateOpen(true)}
              type="button"
            >
              <PlusIcon />
              Teklif oluştur
            </button>
          )}
        </div>

        {loadStatus.schools === 'error' ? (
          <LoadErrorPanel
            detail="Teklif oluşturmak, düzenlemek ve yayımlamak için okul bağlantılarınızın yüklenmesi gerekir."
            onRetry={() => retryLoad('schools')}
            title="Okul bağlantıları yüklenemedi"
          />
        ) : (
          loadStatus.vehicles === 'error' &&
          schoolsReady && (
            <StatePanel
              detail="Araç bilgileri yüklenene kadar teklif oluşturma, düzenleme ve yayımlama kapalıdır."
              title="Teklif işlemleri şu an kullanılamıyor"
            />
          )
        )}

        {prerequisitesVerified &&
          (activeSchools.length === 0 || activeVehicles.length === 0) && (
            <StatePanel
              action={
                activeSchools.length === 0 ? (
                  <Link
                    className="secondary-button button-link"
                    to="/operator/schools"
                    viewTransition
                  >
                    Okullara git
                  </Link>
                ) : undefined
              }
              detail={
                activeSchools.length === 0
                  ? 'Servis teklifi oluşturmak için önce etkin bir okul bağlantısı ekleyin.'
                  : 'Servis teklifi oluşturmak için en az bir etkin aracınız olmalıdır.'
              }
              title="Önce gerekli bilgileri tamamlayın"
            />
          )}

        {loadStatus.offerings === 'loading' ? (
          <InlineLoading label="Servis teklifleri yükleniyor" />
        ) : loadStatus.offerings === 'error' ? (
          <LoadErrorPanel
            detail="Teklifleriniz şu anda alınamadı. Mevcut teklifler doğrulanana kadar yeni teklif oluşturulamaz."
            onRetry={() => retryLoad('offerings')}
            title="Servis teklifleri yüklenemedi"
          />
        ) : offerings.length === 0 ? (
          canCreateOffering && (
            <StatePanel
              action={
                <button
                  className="primary-button"
                  onClick={() => setOfferingCreateOpen(true)}
                  type="button"
                >
                  İlk teklifi oluştur
                </button>
              }
              detail="Taslak oluşturduktan sonra servis mahallelerini seçip teklifi yayımlayabilirsiniz."
              title="Henüz servis teklifi yok"
            />
          )
        ) : (
          <div className="operator-offerings-table-wrap">
            <table className="operator-offerings-table">
              <thead>
                <tr>
                  <th>Hizmet</th>
                  <th>Kapsam</th>
                  <th>Durum</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {offerings.map((offering) => (
                  <tr key={offering.id}>
                    <td data-label="Hizmet">
                      <div className="operator-offering-name">
                        <span aria-hidden="true">
                          <BusIcon />
                        </span>
                        <div>
                          <strong>{offering.schoolName}</strong>
                          <small>{offering.vehiclePlate}</small>
                          {offering.description && (
                            <small>{offering.description}</small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td data-label="Kapsam">
                      <strong>{offering.coverage.length} mahalle</strong>
                      <small>
                        {offering.coverage.length > 0
                          ? offering.coverage
                              .map((item) => item.neighborhoodName)
                              .join(', ')
                          : 'Yayın için kapsam ekleyin'}
                      </small>
                      {offering.availableSeats !== null && (
                        <small>
                          Uygun koltuk: {offering.availableSeats}/
                          {offering.vehicleCapacity}
                        </small>
                      )}
                    </td>
                    <td data-label="Durum">
                      <StatusBadge
                        tone={offering.published ? 'success' : 'warning'}
                      >
                        {offering.published ? 'Yayında' : 'Taslak'}
                      </StatusBadge>
                    </td>
                    <td data-label="İşlem">
                      <div className="operator-offering-actions">
                        <button
                          className="operator-text-action"
                          disabled={!prerequisitesVerified}
                          onClick={() => setOfferingToEdit(offering)}
                          type="button"
                        >
                          Düzenle
                        </button>
                        <button
                          className="operator-text-action"
                          disabled={
                            pending === `offering-${offering.id}` ||
                            // Withdrawing stays available; publishing needs verified prerequisites.
                            (!offering.published && !prerequisitesVerified)
                          }
                          onClick={() => void toggleOffering(offering)}
                          type="button"
                        >
                          {pending === `offering-${offering.id}`
                            ? 'Güncelleniyor…'
                            : offering.published
                              ? 'Taslağa al'
                              : 'Yayımla'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <ModalDialog
        onClose={() => setVehicleCreateOpen(false)}
        open={vehicleCreateOpen}
        title="Araç ekle"
      >
        <VehicleCreateForm
          onCreated={(vehicle) => {
            setVehicles((current) => [...current, vehicle])
            setNotice('Araç eklendi.')
            setVehicleCreateOpen(false)
          }}
          onError={(reason) => dialogErrorFor(reason, navigate)}
        />
      </ModalDialog>

      {vehicleToEdit && (
        <ModalDialog
          onClose={() => setVehicleToEdit(undefined)}
          open
          title="Araç bilgilerini düzenle"
        >
          <VehicleEditor
            onError={(reason) => dialogErrorFor(reason, navigate)}
            onUpdated={(updated) => {
              updateVehicleState(updated)
              setNotice('Araç bilgileri kaydedildi.')
              setVehicleToEdit(undefined)
            }}
            vehicle={vehicleToEdit}
          />
        </ModalDialog>
      )}

      {vehicleToDelete && (
        <ModalDialog
          dismissible={pending === undefined}
          initialFocusRef={cancelDeleteRef}
          onClose={() => setVehicleToDelete(undefined)}
          open
          title="Aracı kalıcı olarak sil"
        >
          <div className="operator-dialog-form">
            <p className="operator-dialog-intro">
              <strong>{vehicleToDelete.plate}</strong> plakalı araç filonuzdan
              kalıcı olarak silinecek. Bu işlem geri alınamaz.
            </p>
            <div className="operator-dialog-actions">
              <button
                className="secondary-button"
                disabled={pending !== undefined}
                onClick={() => setVehicleToDelete(undefined)}
                ref={cancelDeleteRef}
                type="button"
              >
                Vazgeç
              </button>
              <button
                className="danger-button"
                disabled={pending !== undefined}
                onClick={() => void removeVehicle(vehicleToDelete)}
                type="button"
              >
                {pending === `vehicle-delete-${vehicleToDelete.id}`
                  ? 'Siliniyor…'
                  : 'Kalıcı olarak sil'}
              </button>
            </div>
          </div>
        </ModalDialog>
      )}

      <ModalDialog
        onClose={() => setOfferingCreateOpen(false)}
        open={offeringCreateOpen}
        title="Servis teklifi oluştur"
      >
        <OfferingCreateForm
          onCreated={(offering) => {
            setOfferings((current) => [...current, offering])
            setNotice('Servis taslağı oluşturuldu.')
            setOfferingCreateOpen(false)
            void refreshVehicles()
          }}
          onError={(reason) => dialogErrorFor(reason, navigate)}
          schools={activeSchools}
          vehicles={activeVehicles}
        />
      </ModalDialog>

      {offeringToEdit && (
        <ModalDialog
          onClose={() => setOfferingToEdit(undefined)}
          open
          title="Servis teklifini düzenle"
          wide
        >
          <OfferingEditor
            offering={offeringToEdit}
            onError={(reason) => dialogErrorFor(reason, navigate)}
            onUpdated={(updated, message) => {
              updateOfferingState(updated)
              setOfferingToEdit(updated)
              setNotice(message)
              void refreshVehicles()
            }}
            schools={activeSchools}
            vehicles={activeVehicles}
          />
        </ModalDialog>
      )}
    </section>
  )
}

function VehicleCreateForm({
  onCreated,
  onError,
}: {
  onCreated: (vehicle: Vehicle) => void
  onError: (reason: unknown) => string | undefined
}) {
  const [plate, setPlate] = useState('')
  const [capacity, setCapacity] = useState('')
  const [pending, setPending] = useState(false)
  const [validation, setValidation] = useState<string>()
  const [apiError, setApiError] = useState<string>()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsedCapacity = Number(capacity)
    if (
      !plate.trim() ||
      !Number.isInteger(parsedCapacity) ||
      parsedCapacity < 1
    ) {
      setValidation('Plaka ve 1 veya daha büyük tam sayı kapasite girin.')
      return
    }
    setPending(true)
    setValidation(undefined)
    setApiError(undefined)
    try {
      onCreated(
        await createVehicle({ plate: plate.trim(), capacity: parsedCapacity }),
      )
      setPlate('')
      setCapacity('')
    } catch (reason) {
      setApiError(onError(reason))
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="operator-dialog-form" onSubmit={submit}>
      <p className="operator-dialog-intro">
        Plaka ve kapasite bilgisi servis tekliflerinde kullanılır.
      </p>
      <div className="form-grid two-columns">
        <label className="form-field">
          Plaka
          <input
            onChange={(event) => setPlate(event.target.value)}
            value={plate}
          />
        </label>
        <label className="form-field">
          Kapasite
          <input
            min="1"
            onChange={(event) => setCapacity(event.target.value)}
            type="number"
            value={capacity}
          />
        </label>
      </div>
      {validation && <p className="field-error">{validation}</p>}
      {apiError && (
        <div className="form-error" role="alert">
          {apiError}
        </div>
      )}
      <div className="operator-dialog-actions">
        <button className="primary-button" disabled={pending} type="submit">
          {pending ? 'Ekleniyor…' : 'Aracı ekle'}
        </button>
      </div>
    </form>
  )
}

function VehicleEditor({
  onError,
  onUpdated,
  vehicle,
}: {
  onError: (reason: unknown) => string | undefined
  onUpdated: (vehicle: Vehicle) => void
  vehicle: Vehicle
}) {
  const [plate, setPlate] = useState(vehicle.plate)
  const [capacity, setCapacity] = useState(String(vehicle.capacity))
  const [pending, setPending] = useState(false)
  const [validation, setValidation] = useState<string>()
  const [apiError, setApiError] = useState<string>()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const parsedCapacity = Number(capacity)
    if (
      !plate.trim() ||
      !Number.isInteger(parsedCapacity) ||
      parsedCapacity < 1
    ) {
      setValidation('Geçerli plaka ve kapasite girin.')
      return
    }
    setPending(true)
    setValidation(undefined)
    setApiError(undefined)
    try {
      onUpdated(
        await updateVehicle(vehicle.id, {
          plate: plate.trim(),
          capacity: parsedCapacity,
        }),
      )
    } catch (reason) {
      setApiError(onError(reason))
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="operator-dialog-form" onSubmit={submit}>
      <p className="operator-dialog-intro">
        Plaka değişikliği tüm bağlı servis tekliflerinde görünür.
      </p>
      <div className="form-grid two-columns">
        <label className="form-field">
          Plaka
          <input
            onChange={(event) => setPlate(event.target.value)}
            value={plate}
          />
        </label>
        <label className="form-field">
          Kapasite
          <input
            min="1"
            onChange={(event) => setCapacity(event.target.value)}
            type="number"
            value={capacity}
          />
        </label>
      </div>
      {validation && <p className="field-error">{validation}</p>}
      {apiError && (
        <div className="form-error" role="alert">
          {apiError}
        </div>
      )}
      <div className="operator-dialog-actions">
        <button className="primary-button" disabled={pending} type="submit">
          {pending ? 'Kaydediliyor…' : 'Aracı kaydet'}
        </button>
      </div>
    </form>
  )
}

function OfferingCreateForm({
  onCreated,
  onError,
  schools,
  vehicles,
}: {
  onCreated: (offering: ServiceOffering) => void
  onError: (reason: unknown) => string | undefined
  schools: OperatorSchool[]
  vehicles: Vehicle[]
}) {
  const [operatorSchoolId, setOperatorSchoolId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [availableSeats, setAvailableSeats] = useState('')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)
  const [validation, setValidation] = useState<string>()
  const [apiError, setApiError] = useState<string>()

  async function submit(event: FormEvent) {
    event.preventDefault()
    const vehicle = vehicles.find((item) => item.id === vehicleId)
    const seats = availableSeats === '' ? null : Number(availableSeats)
    if (!operatorSchoolId || !vehicle) {
      setValidation('Etkin bir okul bağlantısı ve araç seçin.')
      return
    }
    if (
      seats !== null &&
      (!Number.isInteger(seats) || seats < 0 || seats > vehicle.capacity)
    ) {
      setValidation(`Uygun koltuk 0–${vehicle.capacity} arasında olmalıdır.`)
      return
    }
    setPending(true)
    setValidation(undefined)
    setApiError(undefined)
    try {
      onCreated(
        await createOffering({
          operatorSchoolId,
          vehicleId,
          availableSeats: seats,
          description: description.trim() || null,
        }),
      )
      setAvailableSeats('')
      setDescription('')
    } catch (reason) {
      setApiError(onError(reason))
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="operator-dialog-form" onSubmit={submit}>
      <p className="operator-dialog-intro">
        Teklif önce taslak olarak oluşturulur. Mahalle kapsamını ekledikten
        sonra yayımlayabilirsiniz.
      </p>
      <div className="form-grid two-columns">
        <label className="form-field">
          Okul bağlantısı
          <select
            onChange={(event) => setOperatorSchoolId(event.target.value)}
            value={operatorSchoolId}
          >
            <option value="">Etkin okul seçin</option>
            {schools.map((school) => (
              <option key={school.id} value={school.id}>
                {school.schoolName}
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Etkin araç
          <select
            onChange={(event) => setVehicleId(event.target.value)}
            value={vehicleId}
          >
            <option value="">Araç seçin</option>
            {vehicles.map((vehicle) => (
              <option key={vehicle.id} value={vehicle.id}>
                {vehicle.plate} — {vehicle.capacity} kişi
              </option>
            ))}
          </select>
        </label>
        <label className="form-field">
          Uygun koltuk (isteğe bağlı)
          <input
            min="0"
            onChange={(event) => setAvailableSeats(event.target.value)}
            type="number"
            value={availableSeats}
          />
        </label>
        <label className="form-field">
          Açıklama (isteğe bağlı)
          <input
            onChange={(event) => setDescription(event.target.value)}
            value={description}
          />
        </label>
      </div>
      {validation && <p className="field-error">{validation}</p>}
      {apiError && (
        <div className="form-error" role="alert">
          {apiError}
        </div>
      )}
      {(schools.length === 0 || vehicles.length === 0) && (
        <p className="empty-note">
          Taslak oluşturmak için etkin okul bağlantısı ve etkin araç gerekir.
        </p>
      )}
      <div className="operator-dialog-actions">
        <button
          className="primary-button"
          disabled={pending || schools.length === 0 || vehicles.length === 0}
          type="submit"
        >
          {pending ? 'Oluşturuluyor…' : 'Taslağı oluştur'}
        </button>
      </div>
    </form>
  )
}

function OfferingEditor({
  offering,
  onError,
  onUpdated,
  schools,
  vehicles,
}: {
  offering: ServiceOffering
  onError: (reason: unknown) => string | undefined
  onUpdated: (offering: ServiceOffering, message: string) => void
  schools: OperatorSchool[]
  vehicles: Vehicle[]
}) {
  const currentVehicleActive = vehicles.some(
    (vehicle) => vehicle.id === offering.vehicleId,
  )
  const currentSchoolActive = schools.some(
    (school) => school.id === offering.operatorSchoolId,
  )
  const [operatorSchoolId, setOperatorSchoolId] = useState(
    currentSchoolActive ? offering.operatorSchoolId : '',
  )
  const [vehicleId, setVehicleId] = useState(
    currentVehicleActive ? offering.vehicleId : '',
  )
  const [availableSeats, setAvailableSeats] = useState(
    offering.availableSeats === null ? '' : String(offering.availableSeats),
  )
  const [description, setDescription] = useState(offering.description ?? '')
  const [selectedCoverage, setSelectedCoverage] = useState(
    () => new Set(offering.coverage.map((item) => item.neighborhoodId)),
  )
  const [pending, setPending] = useState<string>()
  const [validation, setValidation] = useState<string>()
  const [detailsError, setDetailsError] = useState<string>()
  const [coverageError, setCoverageError] = useState<string>()

  const parentSchool = schools.find(
    (school) => school.id === offering.operatorSchoolId,
  )
  const groupedCoverage = useMemo(() => {
    const groups = new Map<
      string,
      NonNullable<typeof parentSchool>['coverage']
    >()
    parentSchool?.coverage.forEach((item) => {
      const group = groups.get(item.districtName) ?? []
      group.push(item)
      groups.set(item.districtName, group)
    })
    return [...groups.entries()]
  }, [parentSchool])

  async function saveDetails(event: FormEvent) {
    event.preventDefault()
    const vehicle = vehicles.find((item) => item.id === vehicleId)
    const seats = availableSeats === '' ? null : Number(availableSeats)
    if (!operatorSchoolId || !vehicle) {
      setValidation('Etkin bir okul bağlantısı ve araç seçin.')
      return
    }
    if (
      seats !== null &&
      (!Number.isInteger(seats) || seats < 0 || seats > vehicle.capacity)
    ) {
      setValidation(`Uygun koltuk 0–${vehicle.capacity} arasında olmalıdır.`)
      return
    }
    setPending('details')
    setValidation(undefined)
    setDetailsError(undefined)
    try {
      const updated = await updateOffering(offering.id, {
        operatorSchoolId,
        vehicleId,
        availableSeats: seats,
        description: description.trim() || null,
      })
      if (updated.operatorSchoolId !== offering.operatorSchoolId) {
        setSelectedCoverage(new Set())
      }
      onUpdated(updated, 'Servis ayrıntıları kaydedildi.')
    } catch (reason) {
      setDetailsError(onError(reason))
    } finally {
      setPending(undefined)
    }
  }

  async function saveCoverage(event: FormEvent) {
    event.preventDefault()
    setPending('coverage')
    setValidation(undefined)
    setCoverageError(undefined)
    try {
      const updated = await replaceOfferingCoverage(offering.id, [
        ...selectedCoverage,
      ])
      setSelectedCoverage(
        new Set(updated.coverage.map((item) => item.neighborhoodId)),
      )
      onUpdated(updated, 'Servis kapsamı kaydedildi.')
    } catch (reason) {
      setCoverageError(onError(reason))
    } finally {
      setPending(undefined)
    }
  }

  return (
    <div className="operator-offering-editor">
      <form className="operator-dialog-form" onSubmit={saveDetails}>
        <h3>Teklif ayrıntıları</h3>
        <div className="form-grid two-columns">
          <label className="form-field">
            Okul bağlantısı
            <select
              onChange={(event) => setOperatorSchoolId(event.target.value)}
              value={operatorSchoolId}
            >
              <option value="">Etkin okul seçin</option>
              {schools.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.schoolName}
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Etkin araç
            <select
              onChange={(event) => setVehicleId(event.target.value)}
              value={vehicleId}
            >
              <option value="">Araç seçin</option>
              {vehicles.map((vehicle) => (
                <option key={vehicle.id} value={vehicle.id}>
                  {vehicle.plate} — {vehicle.capacity} kişi
                </option>
              ))}
            </select>
          </label>
          <label className="form-field">
            Uygun koltuk (isteğe bağlı)
            <input
              min="0"
              onChange={(event) => setAvailableSeats(event.target.value)}
              type="number"
              value={availableSeats}
            />
          </label>
          <label className="form-field">
            Açıklama (isteğe bağlı)
            <textarea
              onChange={(event) => setDescription(event.target.value)}
              rows={3}
              value={description}
            />
          </label>
        </div>
        {validation && <p className="field-error">{validation}</p>}
        {detailsError && (
          <div className="form-error" role="alert">
            {detailsError}
          </div>
        )}
        <div className="operator-dialog-actions">
          <button
            className="secondary-button"
            disabled={pending === 'details'}
            type="submit"
          >
            {pending === 'details' ? 'Kaydediliyor…' : 'Ayrıntıları kaydet'}
          </button>
        </div>
      </form>

      <form className="offering-coverage" onSubmit={saveCoverage}>
        <h4>Servise özel mahalleler</h4>

        {groupedCoverage.length === 0 ? (
          <p className="empty-note">
            Önce okulun genel kapsamına mahalle ekleyin.
          </p>
        ) : (
          groupedCoverage.map(([district, items]) => (
            <fieldset className="coverage-group" key={district}>
              <legend>{district}</legend>
              {items.map((item) => (
                <label className="checkbox-row" key={item.neighborhoodId}>
                  <input
                    checked={selectedCoverage.has(item.neighborhoodId)}
                    onChange={() =>
                      setSelectedCoverage((current) => {
                        const next = new Set(current)
                        if (next.has(item.neighborhoodId))
                          next.delete(item.neighborhoodId)
                        else next.add(item.neighborhoodId)
                        return next
                      })
                    }
                    type="checkbox"
                  />
                  {item.neighborhoodName}
                </label>
              ))}
            </fieldset>
          ))
        )}
        {coverageError && (
          <div className="form-error" role="alert">
            {coverageError}
          </div>
        )}
        <div className="operator-dialog-actions">
          <button
            className="secondary-button"
            disabled={pending === 'coverage'}
            type="submit"
          >
            {pending === 'coverage'
              ? 'Kaydediliyor…'
              : 'Servis kapsamını kaydet'}
          </button>
        </div>
      </form>
    </div>
  )
}

const deletionConflictMessages: Record<string, string> = {
  vehicle_in_use:
    'Bu araç bir servis teklifinde kullanıldığı için silinemez. Bunun yerine pasife alabilirsiniz.',
  vehicle_previously_used:
    'Bu araç daha önce bir servis teklifinde kullanıldığı için silinemez. Bunun yerine pasife alabilirsiniz.',
  vehicle_history_unknown:
    'Bu aracın kullanım geçmişi doğrulanamadığı için silinemez. Bunun yerine pasife alabilirsiniz.',
}

const deletionBlockedNotes: Record<
  NonNullable<Vehicle['deletionBlockedReason']>,
  string
> = {
  IN_USE:
    'Servis tekliflerinde kullanıldığı için silinemez; pasife alabilirsiniz.',
  PREVIOUSLY_USED:
    'Daha önce bir servis teklifinde kullanıldığı için silinemez; pasife alabilirsiniz.',
  HISTORY_UNKNOWN:
    'Kullanım geçmişi doğrulanamadığı için silinemez; pasife alabilirsiniz.',
}

function ModalDialog({
  children,
  dismissible = true,
  initialFocusRef,
  onClose,
  open,
  title,
  wide = false,
}: {
  children: ReactNode
  dismissible?: boolean
  initialFocusRef?: RefObject<HTMLElement | null>
  onClose: () => void
  open: boolean
  title: string
  wide?: boolean
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const openerRef = useRef<Element | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      openerRef.current = document.activeElement
      dialog.showModal()
      initialFocusRef?.current?.focus()
    }
    if (!open && dialog.open) dialog.close()
    if (!open) delete dialog.dataset.closing
  }, [initialFocusRef, open])

  // Conditionally rendered dialogs unmount instead of closing, which skips the browser's own
  // focus restoration; return focus to the opener when it still exists.
  useEffect(
    () => () => {
      const opener = openerRef.current
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    },
    [],
  )

  return (
    <dialog
      aria-label={title}
      className={`operator-dialog${wide ? ' operator-dialog-wide' : ''}`}
      onCancel={(event) => {
        event.preventDefault()
        if (dismissible) exitDialog(dialogRef.current, onClose)
      }}
      ref={dialogRef}
    >
      <div className="operator-dialog-header">
        <div>
          <h2>{title}</h2>
          <p>Değişiklikler gerçek hesabınıza kaydedilir.</p>
        </div>
        <button
          aria-label={`${title} penceresini kapat`}
          className="operator-dialog-close"
          disabled={!dismissible}
          onClick={() => exitDialog(dialogRef.current, onClose)}
          type="button"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="operator-dialog-content">{children}</div>
    </dialog>
  )
}

function BusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 17V6.8C6 4.7 8.7 4 12 4s6 .7 6 2.8V17" />
      <path d="M6 9h12M8 14h.01M16 14h.01M8 17h8" />
      <path d="M8 17v2M16 17v2" />
    </svg>
  )
}

function SeatIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="9" cy="7" r="3" />
      <path d="M4 20v-2.5A4.5 4.5 0 0 1 8.5 13H10a4.5 4.5 0 0 1 4.5 4.5V20M17 10a3 3 0 0 1 3 3v4" />
    </svg>
  )
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m4 16-.8 4 4-.8L18.5 7.9a2.1 2.1 0 0 0-3-3Z" />
      <path d="m14 6 4 4" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="m6 6 12 12M18 6 6 18" />
    </svg>
  )
}

function InfoIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  )
}

function handleSession(
  reason: unknown,
  navigate: ReturnType<typeof useNavigate>,
  setError: (message: string) => void,
) {
  if (reason instanceof ApiError && reason.sessionExpired) {
    void navigate('/operator/login?reason=session', { replace: true })
    return
  }
  setError(messageFor(reason))
}

function dialogErrorFor(
  reason: unknown,
  navigate: ReturnType<typeof useNavigate>,
): string | undefined {
  if (reason instanceof ApiError && reason.sessionExpired) {
    void navigate('/operator/login?reason=session', { replace: true })
    return undefined
  }
  return messageFor(reason)
}

function messageFor(reason: unknown): string {
  return reason instanceof ApiError
    ? reason.problem.detail
    : 'İşlem tamamlanamadı. Lütfen tekrar deneyin.'
}

/** Section-scoped read failure with a localized message; never shows server text. */
function LoadErrorPanel({
  detail,
  onRetry,
  title,
}: {
  detail: string
  onRetry: () => void
  title: string
}) {
  return (
    <StatePanel
      action={
        <button className="secondary-button" onClick={onRetry} type="button">
          Yeniden dene
        </button>
      }
      detail={detail}
      title={title}
      tone="error"
    />
  )
}

function InlineLoading({ label }: { label: string }) {
  return (
    <div className="inline-loading" role="status">
      <span className="loading-dot" aria-hidden="true" />
      {label}
    </div>
  )
}

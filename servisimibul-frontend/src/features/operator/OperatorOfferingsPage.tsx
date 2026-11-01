import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { StatePanel, StatusBadge } from '../../components/design-system'
import { getOperatorSchools, type OperatorSchool } from './operator-api'
import {
  createOffering,
  createVehicle,
  deactivateVehicle,
  getOfferings,
  getVehicles,
  replaceOfferingCoverage,
  setOfferingPublished,
  updateOffering,
  updateVehicle,
  type ServiceOffering,
  type Vehicle,
} from './offering-api'

export function OperatorOfferingsPage() {
  const navigate = useNavigate()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [offerings, setOfferings] = useState<ServiceOffering[]>([])
  const [schools, setSchools] = useState<OperatorSchool[]>([])
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [loadRetry, setLoadRetry] = useState(0)
  const [pending, setPending] = useState<string>()
  const [error, setError] = useState<string>()
  const [notice, setNotice] = useState<string>()
  const [vehicleCreateOpen, setVehicleCreateOpen] = useState(false)
  const [vehicleToEdit, setVehicleToEdit] = useState<Vehicle>()
  const [offeringCreateOpen, setOfferingCreateOpen] = useState(false)
  const [offeringToEdit, setOfferingToEdit] = useState<ServiceOffering>()

  useEffect(() => {
    let active = true
    void Promise.all([getVehicles(), getOfferings(), getOperatorSchools()])
      .then(([nextVehicles, nextOfferings, nextSchools]) => {
        if (!active) return
        setVehicles(nextVehicles)
        setOfferings(nextOfferings)
        setSchools(nextSchools)
      })
      .catch((reason: unknown) => {
        if (!active) return
        setLoadFailed(true)
        handleSession(reason, navigate, setError)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [loadRetry, navigate])

  const activeVehicles = vehicles.filter((vehicle) => vehicle.active)
  const activeSchools = schools.filter((school) => school.active)

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
      if (vehicle.active) setOfferings(await getOfferings())
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

  if (loading) return <InlineLoading label="Araçlar ve servisler yükleniyor" />

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
          {loadFailed && (
            <button
              className="secondary-button"
              onClick={() => {
                setLoading(true)
                setLoadFailed(false)
                setError(undefined)
                setLoadRetry((current) => current + 1)
              }}
              type="button"
            >
              Yeniden dene
            </button>
          )}
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

      {!loadFailed && (
        <>
          <section
            aria-labelledby="vehicles-title"
            className="operator-offerings-section"
          >
            <div className="operator-offerings-section-heading">
              <div>
                <h2 id="vehicles-title">Filo bilgileri</h2>
                <p>Servis tekliflerinizde kullanacağınız araçları yönetin.</p>
              </div>
              <button
                className="secondary-button operator-add-button"
                onClick={() => setVehicleCreateOpen(true)}
                type="button"
              >
                <PlusIcon />
                Araç ekle
              </button>
            </div>

            {vehicles.length === 0 ? (
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
                        <StatusBadge
                          tone={vehicle.active ? 'success' : 'neutral'}
                        >
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
                <h2 id="offerings-title">Paylaşılan hizmetler</h2>
                <p>
                  Okul ve mahalle kapsamıyla ilişkilendirilmiş servis
                  teklifleri.
                </p>
              </div>
              {activeSchools.length > 0 && activeVehicles.length > 0 && (
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

            {(activeSchools.length === 0 || activeVehicles.length === 0) && (
              <StatePanel
                action={
                  activeSchools.length === 0 ? (
                    <Link
                      className="secondary-button button-link"
                      to="/operator/schools"
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

            {offerings.length === 0 ? (
              activeSchools.length > 0 &&
              activeVehicles.length > 0 && (
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
                              onClick={() => setOfferingToEdit(offering)}
                              type="button"
                            >
                              Düzenle
                            </button>
                            <button
                              className="operator-text-action"
                              disabled={pending === `offering-${offering.id}`}
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
        </>
      )}

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

function ModalDialog({
  children,
  onClose,
  open,
  title,
  wide = false,
}: {
  children: ReactNode
  onClose: () => void
  open: boolean
  title: string
  wide?: boolean
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog
      aria-label={title}
      className={`operator-dialog${wide ? ' operator-dialog-wide' : ''}`}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
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
          onClick={onClose}
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

function InlineLoading({ label }: { label: string }) {
  return (
    <div className="inline-loading" role="status">
      <span className="loading-dot" aria-hidden="true" />
      {label}
    </div>
  )
}

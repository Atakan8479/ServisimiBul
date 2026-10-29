import { useEffect, useMemo, useState, type FormEvent } from 'react'
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
      <header className="operator-page-header">
        <h1>Servis ayrıntılarınız</h1>
        <p>
          Araç ve servis bilgileri isteğe bağlıdır. Aramalarda görünmek için
          araç eklemek zorunda değilsiniz.
        </p>
      </header>

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
            className="management-section operator-flow-stage"
          >
            <div className="section-heading">
              <div>
                <h2 id="vehicles-title">Araçlar</h2>
                <p>Servis ayrıntısı paylaşacaksanız önce aracınızı ekleyin.</p>
              </div>
              <span className="count-badge">{vehicles.length} araç</span>
            </div>
            <VehicleCreateForm
              onCreated={(vehicle) => {
                setVehicles((current) => [...current, vehicle])
                setNotice('Araç eklendi.')
              }}
              onError={(reason) => handleSession(reason, navigate, setError)}
            />
            {vehicles.length === 0 ? (
              <p className="operator-section-note">Henüz araç eklenmedi.</p>
            ) : (
              <div className="management-grid">
                {vehicles.map((vehicle) => (
                  <article
                    className="school-card management-card"
                    key={vehicle.id}
                  >
                    <div className="school-title-row">
                      <h3>{vehicle.plate}</h3>
                      <StatusBadge
                        tone={vehicle.active ? 'success' : 'neutral'}
                      >
                        {vehicle.active ? 'Etkin' : 'Pasif'}
                      </StatusBadge>
                    </div>
                    <p>{vehicle.capacity} kişilik kapasite</p>
                    <VehicleEditor
                      onError={(reason) =>
                        handleSession(reason, navigate, setError)
                      }
                      onUpdated={(updated) => {
                        updateVehicleState(updated)
                        setNotice('Araç bilgileri kaydedildi.')
                      }}
                      vehicle={vehicle}
                    />
                    <button
                      className={
                        vehicle.active ? 'danger-button' : 'secondary-button'
                      }
                      disabled={pending === `vehicle-${vehicle.id}`}
                      onClick={() => void toggleVehicle(vehicle)}
                      type="button"
                    >
                      {vehicle.active ? 'Pasife al' : 'Etkinleştir'}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section
            aria-labelledby="offerings-title"
            className="management-section operator-flow-stage"
          >
            <div className="section-heading">
              <div>
                <h2 id="offerings-title">Servis bilgileri</h2>
                <p>
                  Etkin bir okul ve araç seçerek paylaşacağınız servisi
                  hazırlayın.
                </p>
              </div>
              <span className="count-badge">{offerings.length} servis</span>
            </div>
            {activeSchools.length === 0 || activeVehicles.length === 0 ? (
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
                    ? 'Servis bilgisi oluşturmak için önce etkin bir okul bağlantısı ekleyin.'
                    : 'Servis bilgisi oluşturmak için yukarıdan etkin bir araç ekleyin.'
                }
                title="Önce gerekli bilgileri tamamlayın"
              />
            ) : (
              <OfferingCreateForm
                onCreated={(offering) => {
                  setOfferings((current) => [...current, offering])
                  setNotice('Servis taslağı oluşturuldu.')
                }}
                onError={(reason) => handleSession(reason, navigate, setError)}
                schools={activeSchools}
                vehicles={activeVehicles}
              />
            )}
            {offerings.length === 0 ? (
              <p className="operator-section-note">Henüz servis taslağı yok.</p>
            ) : (
              <div className="management-grid">
                {offerings.map((offering) => (
                  <article
                    className="school-card management-card"
                    key={offering.id}
                  >
                    <div className="school-title-row">
                      <h3>{offering.schoolName}</h3>
                      <StatusBadge
                        tone={offering.published ? 'success' : 'neutral'}
                      >
                        {offering.published ? 'Yayında' : 'Taslak'}
                      </StatusBadge>
                    </div>
                    <p>
                      {offering.vehiclePlate} · {offering.coverage.length}{' '}
                      mahalle
                    </p>
                    {offering.availableSeats !== null && (
                      <p>
                        Uygun koltuk: {offering.availableSeats}/
                        {offering.vehicleCapacity}
                      </p>
                    )}
                    {offering.description && <p>{offering.description}</p>}
                    <OfferingEditor
                      offering={offering}
                      onError={(reason) =>
                        handleSession(reason, navigate, setError)
                      }
                      onUpdated={(updated, message) => {
                        updateOfferingState(updated)
                        setNotice(message)
                      }}
                      schools={activeSchools}
                      vehicles={activeVehicles}
                    />
                    <button
                      className={
                        offering.published
                          ? 'secondary-button'
                          : 'primary-button'
                      }
                      disabled={pending === `offering-${offering.id}`}
                      onClick={() => void toggleOffering(offering)}
                      type="button"
                    >
                      {offering.published ? 'Yayından kaldır' : 'Yayımla'}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </section>
  )
}

function VehicleCreateForm({
  onCreated,
  onError,
}: {
  onCreated: (vehicle: Vehicle) => void
  onError: (reason: unknown) => void
}) {
  const [plate, setPlate] = useState('')
  const [capacity, setCapacity] = useState('')
  const [pending, setPending] = useState(false)
  const [validation, setValidation] = useState<string>()

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
    try {
      onCreated(
        await createVehicle({ plate: plate.trim(), capacity: parsedCapacity }),
      )
      setPlate('')
      setCapacity('')
    } catch (reason) {
      onError(reason)
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="form-card compact-card" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <h2>Araç ekle</h2>
        </div>
      </div>
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
      <button className="primary-button" disabled={pending} type="submit">
        {pending ? 'Ekleniyor…' : 'Araç ekle'}
      </button>
    </form>
  )
}

function VehicleEditor({
  onError,
  onUpdated,
  vehicle,
}: {
  onError: (reason: unknown) => void
  onUpdated: (vehicle: Vehicle) => void
  vehicle: Vehicle
}) {
  const [plate, setPlate] = useState(vehicle.plate)
  const [capacity, setCapacity] = useState(String(vehicle.capacity))
  const [pending, setPending] = useState(false)
  const [validation, setValidation] = useState<string>()

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
    try {
      onUpdated(
        await updateVehicle(vehicle.id, {
          plate: plate.trim(),
          capacity: parsedCapacity,
        }),
      )
    } catch (reason) {
      onError(reason)
    } finally {
      setPending(false)
    }
  }

  return (
    <details className="inline-editor">
      <summary>Bilgileri düzenle</summary>
      <form onSubmit={submit}>
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
        {validation && <p className="field-error">{validation}</p>}
        <button className="secondary-button" disabled={pending} type="submit">
          {pending ? 'Kaydediliyor…' : 'Aracı kaydet'}
        </button>
      </form>
    </details>
  )
}

function OfferingCreateForm({
  onCreated,
  onError,
  schools,
  vehicles,
}: {
  onCreated: (offering: ServiceOffering) => void
  onError: (reason: unknown) => void
  schools: OperatorSchool[]
  vehicles: Vehicle[]
}) {
  const [operatorSchoolId, setOperatorSchoolId] = useState('')
  const [vehicleId, setVehicleId] = useState('')
  const [availableSeats, setAvailableSeats] = useState('')
  const [description, setDescription] = useState('')
  const [pending, setPending] = useState(false)
  const [validation, setValidation] = useState<string>()

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
      onError(reason)
    } finally {
      setPending(false)
    }
  }

  return (
    <form className="form-card compact-card" onSubmit={submit}>
      <div className="section-heading">
        <div>
          <h2>Servis taslağı oluştur</h2>
        </div>
      </div>
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
      {(schools.length === 0 || vehicles.length === 0) && (
        <p className="empty-note">
          Taslak oluşturmak için etkin okul bağlantısı ve etkin araç gerekir.
        </p>
      )}
      <button
        className="primary-button"
        disabled={pending || schools.length === 0 || vehicles.length === 0}
        type="submit"
      >
        {pending ? 'Oluşturuluyor…' : 'Servis taslağı oluştur'}
      </button>
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
  onError: (reason: unknown) => void
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
      onError(reason)
    } finally {
      setPending(undefined)
    }
  }

  async function saveCoverage(event: FormEvent) {
    event.preventDefault()
    setPending('coverage')
    setValidation(undefined)
    try {
      const updated = await replaceOfferingCoverage(offering.id, [
        ...selectedCoverage,
      ])
      setSelectedCoverage(
        new Set(updated.coverage.map((item) => item.neighborhoodId)),
      )
      onUpdated(updated, 'Servis kapsamı kaydedildi.')
    } catch (reason) {
      onError(reason)
    } finally {
      setPending(undefined)
    }
  }

  return (
    <details className="inline-editor">
      <summary>Servisi düzenle</summary>
      <form onSubmit={saveDetails}>
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
        {validation && <p className="field-error">{validation}</p>}
        <button
          className="secondary-button"
          disabled={pending === 'details'}
          type="submit"
        >
          {pending === 'details' ? 'Kaydediliyor…' : 'Ayrıntıları kaydet'}
        </button>
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
        <button
          className="secondary-button"
          disabled={pending === 'coverage'}
          type="submit"
        >
          {pending === 'coverage' ? 'Kaydediliyor…' : 'Servis kapsamını kaydet'}
        </button>
      </form>
    </details>
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

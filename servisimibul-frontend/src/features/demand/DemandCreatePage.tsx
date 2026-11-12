import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Link,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom'
import { ApiError } from '../../api/client'
import { currentUser } from '../auth/auth-api'
import {
  createDemand,
  supportReasons,
  type SupportReason,
  type SupportValues,
} from './demand-api'
import { reasonLabel } from './demand-labels'
import {
  DemandLocationPicker,
  type DemandLocationSelection,
  type InitialDemandLocation,
} from './DemandLocationPicker'
import { DemandSupportForm } from './DemandSupportForm'

const defaultSupport = (): SupportValues => ({
  needsMorning: true,
  needsAfternoon: false,
  reasons: [],
})
const PENDING_DRAFT_KEY = 'servisimibul:demand-create-auth-draft'

export function DemandCreatePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const locationKey = draftLocationKey(searchParams)
  const draftId = searchParams.get('draft')
  const initialDraft = readPendingDraft(draftId, locationKey)
  const [selection, setSelection] = useState<DemandLocationSelection>()
  const [hasLocationDraft, setHasLocationDraft] = useState(false)
  const [academicYear, setAcademicYear] = useState(
    searchParams.get('academicYear') ?? initialDraft?.academicYear ?? '',
  )
  const [support, setSupport] = useState<SupportValues>(
    initialDraft?.support ?? defaultSupport(),
  )
  const [confirmation, setConfirmation] = useState<SupportValues>()
  const [error, setError] = useState<string>()
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (draftId && locationKey) {
      writePendingDraft(draftId, locationKey, academicYear, support)
    }
  }, [academicYear, draftId, locationKey, support])

  const initialLocation = useMemo<InitialDemandLocation | undefined>(() => {
    const schoolId = searchParams.get('schoolId')
    const pickupDistrictId = Number(searchParams.get('pickupDistrictId'))
    const neighborhoodId = Number(searchParams.get('neighborhoodId'))
    return schoolId && pickupDistrictId > 0 && neighborhoodId > 0
      ? { schoolId, pickupDistrictId, neighborhoodId }
      : undefined
  }, [searchParams])

  function handleSelection(nextSelection?: DemandLocationSelection) {
    setSelection(nextSelection)
    if (nextSelection) setHasLocationDraft(false)
    setError(undefined)
    if (!nextSelection) return
    const next = new URLSearchParams({
      schoolId: nextSelection.school.id,
      pickupDistrictId: String(nextSelection.pickupDistrict.id),
      neighborhoodId: String(nextSelection.neighborhood.id),
    })
    if (academicYear.trim()) next.set('academicYear', academicYear.trim())
    if (draftId) next.set('draft', draftId)
    setSearchParams(next, { replace: true })
  }

  async function review(values: SupportValues) {
    if (!selection || hasLocationDraft) {
      setError('Okul, servis alınacak ilçe ve mahalle seçimlerini tamamlayın.')
      return
    }
    if (!validAcademicYear(academicYear.trim())) {
      setError('Eğitim yılını 2026-2027 biçiminde ve ardışık girin.')
      return
    }
    setSupport(values)
    setError(undefined)
    try {
      const user = await currentUser()
      if (user.role !== 'PARENT') {
        setError(
          'Talep oluşturma ve destek işlemleri yalnızca veli hesabıyla yapılabilir.',
        )
        return
      }
      setConfirmation(values)
    } catch (failure) {
      if (failure instanceof ApiError && failure.problem.status === 401) {
        const next = rememberForLogin(values)
        void navigate(`/parent/login?next=${encodeURIComponent(next)}`)
        return
      }
      setError('Oturum bilgisi kontrol edilemedi. Tekrar deneyin.')
    }
  }

  async function submit() {
    if (!selection || !confirmation) return
    setSubmitting(true)
    setError(undefined)
    try {
      const response = await createDemand(
        selection.school.id,
        selection.neighborhood.id,
        confirmation,
        academicYear.trim() || undefined,
      )
      clearPendingDraft()
      void navigate(`/demands/${response.demand.id}`, {
        state: {
          notice: response.created
            ? 'Talebiniz oluşturuldu.'
            : response.demand.closureReason === 'INACTIVE'
              ? 'Bu okul ve mahalle için talep hareketsizlik nedeniyle kapanmış. Talebe katılarak yeniden açabilirsiniz.'
              : response.demand.status !== 'OPEN'
                ? 'Bu okul ve mahalle için talep var ancak yeni katılıma kapalı.'
                : 'Bu okul ve mahalle için zaten bir talep var. Katılmak için “Benim de ihtiyacım var” seçeneğini kullanın.',
        },
        viewTransition: typeof document.startViewTransition === 'function',
      })
    } catch (failure) {
      if (failure instanceof ApiError && failure.problem.status === 401) {
        const next = rememberForLogin(confirmation)
        void navigate(
          `/parent/login?next=${encodeURIComponent(next)}&reason=session`,
        )
        return
      }
      setConfirmation(undefined)
      setError(
        failure instanceof ApiError && failure.problem.fieldErrors?.academicYear
          ? 'Bu eğitim yılı için yeni talep açılamıyor. Güncel eğitim yılını seçin.'
          : failure instanceof ApiError
            ? failure.problem.detail
            : 'Talep oluşturulamadı. Bilgileri koruduk; tekrar deneyin.',
      )
    } finally {
      setSubmitting(false)
    }
  }

  function rememberForLogin(values: SupportValues) {
    if (!locationKey) return `${location.pathname}${location.search}`
    const id = rememberPendingDraft(locationKey, academicYear, values)
    const nextParams = new URLSearchParams(location.search)
    nextParams.set('draft', id)
    return `${location.pathname}?${nextParams}`
  }

  return (
    <section className="demand-page demand-create-page">
      <nav className="demand-breadcrumb" aria-label="Sayfa yolu">
        <Link to="/demands" viewTransition>
          Talep panosu
        </Link>
        <span aria-hidden="true">/</span>
        <span>Yeni talep</span>
      </nav>

      <header className="demand-intro">
        <div>
          <h1>Yeni servis talebi oluştur</h1>
          <p>Konumu ve ihtiyacınızı gözden geçirin, ardından onaylayın.</p>
        </div>
      </header>

      <section className="demand-filter-panel" aria-labelledby="location-title">
        <div className="section-heading">
          <div>
            <h2 id="location-title">Okul ve servis konumu</h2>
            <p>Önceki seçiminiz hazırdır; gerekirse değiştirebilirsiniz.</p>
          </div>
        </div>
        <DemandLocationPicker
          initialLocation={initialLocation}
          onLocationDraftChange={(hasLocation) => {
            setHasLocationDraft(hasLocation && !selection)
          }}
          onSelectionChange={handleSelection}
        />
        <label className="form-field demand-create-year">
          Eğitim yılı
          <input
            inputMode="numeric"
            placeholder="Güncel yıl veya 2026-2027"
            value={academicYear}
            onChange={(event) => setAcademicYear(event.target.value)}
          />
        </label>
      </section>

      <section className="demand-create-panel" aria-labelledby="need-title">
        <div className="section-heading">
          <div>
            <h2 id="need-title">Servis ihtiyacınız</h2>
            <p>Öğrenci adı, açık adres veya iletişim bilgisi eklemeyin.</p>
          </div>
        </div>
        <DemandSupportForm
          busyLabel="Kontrol ediliyor…"
          initialValues={support}
          submitLabel="Bilgileri gözden geçir"
          onCancel={() => void navigate(boardPath(selection, academicYear))}
          onChange={setSupport}
          onSubmit={review}
        />
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
      </section>

      {confirmation && selection && (
        <DemandConfirmationDialog
          academicYear={academicYear}
          pending={submitting}
          selection={selection}
          values={confirmation}
          onCancel={() => setConfirmation(undefined)}
          onConfirm={() => void submit()}
        />
      )}
    </section>
  )
}

function DemandConfirmationDialog({
  academicYear,
  onCancel,
  onConfirm,
  pending,
  selection,
  values,
}: {
  academicYear: string
  onCancel: () => void
  onConfirm: () => void
  pending: boolean
  selection: DemandLocationSelection
  values: SupportValues
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    if (typeof dialog?.showModal === 'function') dialog.showModal()
    else dialog?.setAttribute('open', '')
    cancelRef.current?.focus()
    return () => {
      if (typeof dialog?.close === 'function') dialog.close()
      else dialog?.removeAttribute('open')
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  const directions = [
    values.needsMorning && 'Sabah — okula gidiş',
    values.needsAfternoon && 'Öğleden sonra — okuldan dönüş',
  ].filter(Boolean)

  return (
    <dialog
      aria-labelledby="demand-confirm-title"
      className="demand-confirm-dialog"
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onCancel()
      }}
      ref={dialogRef}
    >
      <h2 id="demand-confirm-title">Talebi onaylayın</h2>
      <dl className="demand-confirm-summary">
        <div>
          <dt>Okul</dt>
          <dd>{selection.school.name}</dd>
        </div>
        <div>
          <dt>Servis konumu</dt>
          <dd>
            {selection.neighborhood.name}, {selection.pickupDistrict.name}
          </dd>
        </div>
        <div>
          <dt>Eğitim yılı</dt>
          <dd>{academicYear.trim() || 'Güncel eğitim yılı'}</dd>
        </div>
        <div>
          <dt>Servis yönü</dt>
          <dd>{directions.join(', ')}</dd>
        </div>
        <div>
          <dt>İhtiyaç nedenleri</dt>
          <dd>{values.reasons.map(reasonLabel).join(', ')}</dd>
        </div>
      </dl>
      <div className="button-row">
        <button
          className="secondary-button"
          disabled={pending}
          ref={cancelRef}
          type="button"
          onClick={onCancel}
        >
          Düzenlemeye dön
        </button>
        <button
          className="primary-button"
          disabled={pending}
          type="button"
          onClick={onConfirm}
        >
          {pending ? 'Talep oluşturuluyor…' : 'Talebi oluştur'}
        </button>
      </div>
    </dialog>
  )
}

function validAcademicYear(value: string) {
  if (!value) return true
  const match = /^(\d{4})-(\d{4})$/.exec(value)
  return Boolean(match && Number(match[2]) === Number(match[1]) + 1)
}

function draftLocationKey(searchParams: URLSearchParams) {
  const schoolId = searchParams.get('schoolId')
  const pickupDistrictId = searchParams.get('pickupDistrictId')
  const neighborhoodId = searchParams.get('neighborhoodId')
  return schoolId && pickupDistrictId && neighborhoodId
    ? `${schoolId}:${pickupDistrictId}:${neighborhoodId}`
    : ''
}

function readPendingDraft(id: string | null, locationKey: string) {
  if (!id || !locationKey) return undefined
  try {
    const draft = JSON.parse(
      sessionStorage.getItem(PENDING_DRAFT_KEY) ?? '',
    ) as {
      id?: unknown
      locationKey?: unknown
      academicYear?: unknown
      support?: {
        needsMorning?: unknown
        needsAfternoon?: unknown
        reasons?: unknown
      }
    }
    if (draft.id !== id || draft.locationKey !== locationKey) return undefined
    return {
      academicYear:
        typeof draft.academicYear === 'string' ? draft.academicYear : '',
      support: {
        needsMorning: draft.support?.needsMorning === true,
        needsAfternoon: draft.support?.needsAfternoon === true,
        reasons: Array.isArray(draft.support?.reasons)
          ? draft.support.reasons.filter(isSupportReason)
          : [],
      },
    }
  } catch {
    return undefined
  }
}

function rememberPendingDraft(
  locationKey: string,
  academicYear: string,
  support: SupportValues,
) {
  const id = crypto.randomUUID()
  writePendingDraft(id, locationKey, academicYear, support)
  return id
}

function clearPendingDraft() {
  try {
    sessionStorage.removeItem(PENDING_DRAFT_KEY)
  } catch {
    // Storage can be unavailable in restricted browser contexts.
  }
}

function writePendingDraft(
  id: string,
  locationKey: string,
  academicYear: string,
  support: SupportValues,
) {
  try {
    sessionStorage.setItem(
      PENDING_DRAFT_KEY,
      JSON.stringify({ id, locationKey, academicYear, support }),
    )
  } catch {
    // The auth return path still works; only draft restoration is unavailable.
  }
}

function isSupportReason(value: unknown): value is SupportReason {
  return (
    typeof value === 'string' && supportReasons.includes(value as SupportReason)
  )
}

function boardPath(
  selection: DemandLocationSelection | undefined,
  academicYear: string,
) {
  if (!selection) return '/demands'
  const parameters = new URLSearchParams({
    schoolId: selection.school.id,
    pickupDistrictId: String(selection.pickupDistrict.id),
    neighborhoodId: String(selection.neighborhood.id),
  })
  if (academicYear.trim()) parameters.set('academicYear', academicYear.trim())
  return `/demands?${parameters.toString()}`
}

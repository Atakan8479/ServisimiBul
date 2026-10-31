import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { StatePanel, StatusBadge } from '../../components/design-system'
import { AdminConfirmDialog } from './AdminConfirmDialog'
import {
  getTariff,
  replaceTariff,
  tariffSchema,
  type Tariff,
} from '../tariff/tariff-api'
import { TariffDetails } from '../tariff/PublicTariffReference'

const PROVINCE_CODE = '34'

export function AdminTariffsPage() {
  const navigate = useNavigate()
  // A response applies only while its request is still the latest load.
  const loadRequest = useRef(0)
  const focusEditorAfterLoad = useRef(false)
  const editorRef = useRef<HTMLTextAreaElement>(null)
  const [published, setPublished] = useState<Tariff>()
  const [loadedValue, setLoadedValue] = useState('')
  const [editorValue, setEditorValue] = useState('')
  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [error, setError] = useState<string>()
  const [conflict, setConflict] = useState(false)
  const [confirmingReload, setConfirmingReload] = useState(false)
  const preview = useMemo(() => parseTariffDraft(editorValue), [editorValue])
  const previewable = preview.tariff?.provinceCode === PROVINCE_CODE
  const expectedVersion = published?.version ?? null

  const showLoaded = useCallback((tariff: Tariff | undefined) => {
    const value = pretty(tariff ?? emptyIstanbulTariff())
    setPublished(tariff)
    setLoadedValue(value)
    setEditorValue(value)
    setReady(true)
  }, [])

  const load = useCallback(async () => {
    const request = ++loadRequest.current
    setLoading(true)
    setError(undefined)
    setNotice(undefined)
    setConflict(false)
    try {
      const tariff = await getTariff(PROVINCE_CODE)
      if (request !== loadRequest.current) return
      showLoaded(tariff)
    } catch (reason) {
      if (request !== loadRequest.current) return
      if (
        reason instanceof ApiError &&
        reason.problem.code === 'tariff_not_found'
      ) {
        showLoaded(undefined)
        setNotice(
          'İstanbul için kayıtlı tarife yok. İlk sürümü oluşturabilirsiniz.',
        )
      } else {
        handleSession(reason, navigate, setError)
      }
    }
    setLoading(false)
  }, [navigate, showLoaded])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  useEffect(() => {
    if (loading || !focusEditorAfterLoad.current) return
    focusEditorAfterLoad.current = false
    editorRef.current?.focus()
  }, [loading])

  function reload() {
    setConfirmingReload(false)
    focusEditorAfterLoad.current = true
    void load()
  }

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(undefined)
    setNotice(undefined)
    setConflict(false)

    if (!preview.tariff) {
      setError(preview.error)
      return
    }
    if (!previewable) {
      setError('Bu ekranda yalnızca İstanbul (34) tarifesi düzenlenebilir.')
      return
    }

    setSaving(true)
    try {
      const saved = await replaceTariff(
        PROVINCE_CODE,
        expectedVersion,
        preview.tariff,
      )
      showLoaded(saved)
      setNotice(`Tarife ${saved.version} sürümüyle kaydedildi.`)
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.problem.code === 'tariff_version_conflict'
      ) {
        setConflict(true)
        setError(
          'Tarife başka bir yönetici tarafından değiştirildi. Taslağınız korunuyor; üzerine yazmadan önce güncel sürümü yükleyin.',
        )
      } else {
        handleSession(reason, navigate, setError)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="workspace-page admin-page tariff-admin-page">
      <header className="admin-page-header admin-operator-header admin-detail-header">
        <div>
          <p className="admin-eyebrow">Yönetim paneli</p>
          <h1>UKOME tarife yönetimi</h1>
          <p>Tarife verisini inceleyin, JSON'u doğrulayın ve önizleyin.</p>
        </div>
        {published && (
          <span className="tariff-version-chip">
            {published.academicYear} · {published.version}
          </span>
        )}
      </header>
      <p className="tariff-admin-note">
        Her kayıt, önceki sürümleri değiştirmeden yeni bir sürüm oluşturur.
        Tutarları kaydetmeden önce resmî kaynakla karşılaştırın.
      </p>

      {loading ? (
        <StatePanel
          detail="Güncel resmî tarife getiriliyor."
          title="Tarife yükleniyor"
          tone="loading"
        />
      ) : !ready ? (
        <StatePanel
          action={
            <button
              className="secondary-button"
              onClick={() => void load()}
              type="button"
            >
              Tekrar dene
            </button>
          }
          detail={error ?? 'Tarife işlemi tamamlanamadı.'}
          title="Tarife yüklenemedi"
          tone="error"
        />
      ) : (
        <div className="tariff-admin-grid">
          <form className="tariff-editor-card" onSubmit={save} noValidate>
            <div className="tariff-editor-heading">
              <div>
                <h2>Tarife JSON</h2>
                <p>
                  {published
                    ? `Kaynak: ${published.sourceTitle} · Yüklü sürüm: ${published.version}`
                    : 'Henüz yayımlanmış sürüm yok.'}
                </p>
              </div>
              <button
                className="secondary-button"
                disabled={saving}
                onClick={() =>
                  editorValue === loadedValue
                    ? reload()
                    : setConfirmingReload(true)
                }
                type="button"
              >
                Güncel sürümü yükle
              </button>
            </div>

            <label className="form-field">
              Tarife JSON içeriği
              <textarea
                aria-describedby="tariff-editor-help"
                aria-invalid={!previewable}
                onChange={(event) => setEditorValue(event.target.value)}
                readOnly={saving}
                ref={editorRef}
                rows={20}
                spellCheck={false}
                value={editorValue}
              />
            </label>

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
            {conflict && (
              <button
                className="secondary-button"
                onClick={reload}
                type="button"
              >
                Taslağı bırakıp güncel sürümü yükle
              </button>
            )}

            <div className="tariff-editor-footer">
              <span>JSON · {editorValue.split('\n').length} satır</span>
              <button
                className="primary-button"
                disabled={saving}
                type="submit"
              >
                {saving ? 'Tarife kaydediliyor…' : 'Tarifeyi kaydet'}
              </button>
            </div>
            <p className="tariff-editor-help" id="tariff-editor-help">
              Yeni bir sürüm kaydederken <code>version</code> değerini
              değiştirin. Aylık ve yıllık tutarlar kuruş cinsinden tam sayı
              olmalıdır. Ek kilometre kuralı varsa eşiği son sabit aralığın üst
              sınırıyla aynı olmalıdır.
            </p>
          </form>

          <div className="tariff-admin-side">
            <aside
              aria-labelledby="tariff-preview-heading"
              className="tariff-admin-preview"
            >
              <div className="tariff-preview-heading">
                <div>
                  <p className="admin-eyebrow">Önizleme</p>
                  <h2 id="tariff-preview-heading">
                    Uygulanacak ücret tarifesi
                  </h2>
                </div>
                <StatusBadge tone={previewable ? 'success' : 'warning'}>
                  {previewable ? 'Biçim geçerli' : 'Geçersiz'}
                </StatusBadge>
              </div>
              {previewable && preview.tariff ? (
                <TariffDetails tariff={preview.tariff} />
              ) : (
                <div className="state-panel">
                  <div>
                    <h3>Önizleme henüz hazır değil</h3>
                    <p>
                      {preview.tariff
                        ? 'Önizleme yalnızca İstanbul (34) tarifesini gösterir.'
                        : preview.error}
                    </p>
                  </div>
                </div>
              )}
            </aside>

            {published && (
              <section
                aria-labelledby="tariff-current-heading"
                className="tariff-current-version"
              >
                <h2 id="tariff-current-heading">
                  Mevcut sürüm · {published.version}
                </h2>
                <p>{published.academicYear}</p>
                <p>Yürürlük: {formatEffectivePeriod(published)}</p>
                <p>{published.sourceTitle}</p>
              </section>
            )}
          </div>
        </div>
      )}

      {confirmingReload && (
        <AdminConfirmDialog
          confirmLabel="Taslağı bırak"
          danger
          onCancel={() => setConfirmingReload(false)}
          onConfirm={reload}
          pending={false}
          title="Kaydedilmemiş taslak bırakılsın mı?"
        >
          <p>
            Güncel sürüm yüklendiğinde bu taslaktaki değişiklikler kaybolur.
          </p>
        </AdminConfirmDialog>
      )}
    </section>
  )
}

function formatEffectivePeriod(tariff: Tariff) {
  const format = (value: string) =>
    new Intl.DateTimeFormat('tr-TR').format(new Date(`${value}T00:00:00`))
  return tariff.effectiveTo === null
    ? `${format(tariff.effectiveFrom)} tarihinden itibaren`
    : `${format(tariff.effectiveFrom)}–${format(tariff.effectiveTo)}`
}

function emptyIstanbulTariff(): Tariff {
  const year = new Date().getFullYear()
  return {
    provinceCode: PROVINCE_CODE,
    provinceName: 'İstanbul',
    authority: 'İstanbul Büyükşehir Belediyesi UKOME',
    academicYear: `${year}–${year + 1}`,
    currency: 'TRY',
    effectiveFrom: `${year}-09-01`,
    effectiveTo: null,
    sourceTitle: '',
    officialSourceUrl: 'https://',
    version: `${year}-01`,
    bands: [{ minDistanceKm: 0, maxDistanceKm: null, amountKurus: 0 }],
  }
}

type TariffDraftResult =
  { tariff: Tariff; error?: never } | { tariff?: never; error: string }

function parseTariffDraft(value: string): TariffDraftResult {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(value) as unknown
  } catch {
    return {
      error: 'JSON biçimi geçersiz. Eksik virgül veya parantezi düzeltin.',
    }
  }

  const parsed = tariffSchema.safeParse(parsedJson)
  if (parsed.success) return { tariff: parsed.data }

  const issue = parsed.error.issues[0]
  const field = issue?.path.length ? `${issue.path.join('.')}: ` : ''
  return { error: `${field}${issue?.message ?? 'Tarife içeriği geçersiz.'}` }
}

function pretty(tariff: Tariff): string {
  return JSON.stringify(tariff, null, 2)
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
  setError(
    reason instanceof ApiError
      ? reason.problem.detail
      : 'Tarife işlemi tamamlanamadı. Lütfen tekrar deneyin.',
  )
}

import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
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
  const [expectedVersion, setExpectedVersion] = useState<string | null>(null)
  const [editorValue, setEditorValue] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<string>()
  const [error, setError] = useState<string>()
  const [conflict, setConflict] = useState(false)
  const preview = useMemo(() => parseTariffDraft(editorValue), [editorValue])

  const load = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    setNotice(undefined)
    setConflict(false)
    try {
      const tariff = await getTariff(PROVINCE_CODE)
      setExpectedVersion(tariff.version)
      setEditorValue(pretty(tariff))
    } catch (reason) {
      if (
        reason instanceof ApiError &&
        reason.problem.code === 'tariff_not_found'
      ) {
        setExpectedVersion(null)
        setEditorValue(pretty(emptyIstanbulTariff()))
        setNotice(
          'İstanbul için kayıtlı tarife yok. İlk sürümü oluşturabilirsiniz.',
        )
      } else {
        handleSession(reason, navigate, setError)
      }
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    let active = true
    void getTariff(PROVINCE_CODE)
      .then((tariff) => {
        if (!active) return
        setExpectedVersion(tariff.version)
        setEditorValue(pretty(tariff))
      })
      .catch((reason: unknown) => {
        if (!active) return
        if (
          reason instanceof ApiError &&
          reason.problem.code === 'tariff_not_found'
        ) {
          setExpectedVersion(null)
          setEditorValue(pretty(emptyIstanbulTariff()))
          setNotice(
            'İstanbul için kayıtlı tarife yok. İlk sürümü oluşturabilirsiniz.',
          )
        } else {
          handleSession(reason, navigate, setError)
        }
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [navigate])

  async function save(event: FormEvent) {
    event.preventDefault()
    setError(undefined)
    setNotice(undefined)
    setConflict(false)

    if (!preview.tariff) {
      setError(preview.error)
      return
    }
    if (preview.tariff.provinceCode !== PROVINCE_CODE) {
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
      setExpectedVersion(saved.version)
      setEditorValue(pretty(saved))
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
    <section className="workspace-page tariff-admin-page">
      <h1>Resmî tarifeler</h1>
      <p className="page-lead">
        İstanbul için yayımlanacak UKOME mesafe tarifesini yönetin. Bu kayıt
        işletmeciye özel fiyat değildir.
      </p>

      {loading ? (
        <div className="inline-loading" role="status">
          <span className="loading-dot" aria-hidden="true" />
          Tarife yükleniyor…
        </div>
      ) : (
        <form className="form-card tariff-editor" onSubmit={save} noValidate>
          <div className="section-heading">
            <div>
              <h2>İstanbul · 34</h2>
              <p>
                {expectedVersion
                  ? `Yüklü sürüm: ${expectedVersion}`
                  : 'Henüz yayımlanmış sürüm yok.'}
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => void load()}
              type="button"
            >
              Güncel sürümü yükle
            </button>
          </div>

          <div className="tariff-admin-grid">
            <div className="tariff-editor-column">
              <label className="form-field">
                Tarife JSON içeriği
                <textarea
                  aria-describedby="tariff-editor-help"
                  onChange={(event) => setEditorValue(event.target.value)}
                  rows={24}
                  spellCheck={false}
                  value={editorValue}
                />
              </label>
              <p className="tariff-editor-help" id="tariff-editor-help">
                Yeni bir sürüm kaydederken <code>version</code> değerini
                değiştirin. Aylık ve yıllık tutarlar kuruş cinsinden tam sayı
                olmalıdır. Ek kilometre kuralı varsa eşiği son sabit aralığın
                üst sınırıyla aynı olmalıdır.
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
              {conflict && (
                <button
                  className="secondary-button"
                  onClick={() => void load()}
                  type="button"
                >
                  Taslağı bırakıp güncel sürümü yükle
                </button>
              )}

              <button
                className="primary-button"
                disabled={saving}
                type="submit"
              >
                {saving ? 'Tarife kaydediliyor…' : 'Tarifeyi kaydet'}
              </button>
            </div>

            <aside
              aria-labelledby="tariff-preview-heading"
              className="tariff-admin-preview"
            >
              <div>
                <h2 id="tariff-preview-heading">Yayımlanacak görünüm</h2>
                <p>
                  Kaydetmeden önce kaynak, sürüm, koşullar ve ücret bantlarını
                  doğrulayın.
                </p>
              </div>
              {preview.tariff?.provinceCode === PROVINCE_CODE ? (
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
          </div>
        </form>
      )}
    </section>
  )
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

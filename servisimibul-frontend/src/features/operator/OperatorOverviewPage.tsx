import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { StatusBadge } from '../../components/design-system'
import { getDiscoveryReadiness, type DiscoveryReadiness } from './operator-api'
import { schoolInitials } from './school-initials'

export function OperatorOverviewPage() {
  const navigate = useNavigate()
  const [readiness, setReadiness] = useState<DiscoveryReadiness>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>()

  const loadReadiness = useCallback(async () => {
    setLoading(true)
    setError(undefined)
    try {
      setReadiness(await getDiscoveryReadiness())
    } catch (reason) {
      if (reason instanceof ApiError && reason.sessionExpired) {
        void navigate('/operator/login?reason=session', { replace: true })
        return
      }
      setError(
        reason instanceof ApiError
          ? reason.problem.detail
          : 'Arama uygunluğu yüklenemedi. Lütfen tekrar deneyin.',
      )
    } finally {
      setLoading(false)
    }
  }, [navigate])

  useEffect(() => {
    let active = true
    void getDiscoveryReadiness()
      .then((result) => {
        if (active) setReadiness(result)
      })
      .catch((reason: unknown) => {
        if (!active) return
        if (reason instanceof ApiError && reason.sessionExpired) {
          void navigate('/operator/login?reason=session', { replace: true })
          return
        }
        setError(
          reason instanceof ApiError
            ? reason.problem.detail
            : 'Arama uygunluğu yüklenemedi. Lütfen tekrar deneyin.',
        )
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [navigate])

  return (
    <section className="workspace-page operator-workspace-page operator-overview-page">
      <header className="operator-page-header operator-overview-header">
        <div>
          <h1>Genel bakış</h1>
          <p>Profilinizi, okul kapsamınızı ve servis bilgilerinizi yönetin.</p>
        </div>
        <Link className="secondary-button button-link" to="/operator/profile">
          Profili düzenle
        </Link>
      </header>

      {loading && <InlineLoading label="Arama uygunluğu yükleniyor" />}

      {error && (
        <div className="form-error readiness-error" role="alert">
          <p>{error}</p>
          <button
            className="secondary-button"
            onClick={loadReadiness}
            type="button"
          >
            Yeniden dene
          </button>
        </div>
      )}

      {readiness && (
        <>
          <div
            className={`status-banner operator-readiness-summary ${readiness.discoveryEligible ? 'success' : 'warning'}`}
            role="status"
          >
            <span className="operator-readiness-icon" aria-hidden="true" />
            <div>
              <strong>
                {readiness.discoveryEligible
                  ? 'Profiliniz uygun aramalarda görünebilir.'
                  : 'Profiliniz henüz arama sonuçlarında görünmüyor.'}
              </strong>
              <span>
                {readiness.discoveryEligible
                  ? 'Veliler sizi yalnızca okul ve mahalle kapsamınızla eşleşen aramalarda görür.'
                  : 'Aramalarda yer almak için aşağıdaki eksik adımları tamamlayın.'}
              </span>
            </div>
          </div>

          <div className="operator-overview-summary" aria-label="Profil özeti">
            <SummaryCard
              label="Arama durumu"
              note={
                readiness.discoveryEligible
                  ? 'Yayın koşulları tamamlandı'
                  : 'Tamamlanması gereken adımlar var'
              }
              tone={readiness.discoveryEligible ? 'success' : 'warning'}
              value={readiness.discoveryEligible ? 'Hazır' : 'Eksik'}
            />
            <SummaryCard
              label="Bağlı okul"
              note={`${activeSchoolCount(readiness)} aktif okul bağlantısı`}
              tone="info"
              value={String(readiness.schools.length)}
            />
            <SummaryCard
              label="Okul-mahalle kapsamı"
              note="Okul bazındaki geçerli kayıt toplamı"
              tone="accent"
              value={String(coverageCount(readiness))}
            />
          </div>

          <div className="operator-overview-primary-grid">
            <section
              className="operator-task-section"
              aria-labelledby="readiness-steps-title"
            >
              <div className="operator-section-heading">
                <div>
                  <h2 id="readiness-steps-title">Profilinizi hazırlayın</h2>
                  <p>
                    Profil ve hizmet kapsamınızı güncel tutun. Araç bilgileri
                    arama görünürlüğü için isteğe bağlıdır.
                  </p>
                </div>
              </div>
              <ol
                className="readiness-list"
                aria-label="Arama uygunluğu adımları"
              >
                <ReadinessItem
                  complete={readiness.emailVerified && readiness.accountEnabled}
                  description={
                    readiness.emailVerified && readiness.accountEnabled
                      ? 'E-posta doğrulandı ve hesap kullanıma açık.'
                      : 'Doğrulanmış ve kullanıma açık bir hesap gereklidir.'
                  }
                  title="Hesap doğrulaması"
                />
                <ReadinessItem
                  action="Profili düzenle"
                  complete={
                    readiness.profileActive && readiness.publiclyVisible
                  }
                  description={profileGuidance(readiness)}
                  to="/operator/profile"
                  title="İşletme profilinizi tamamlayın"
                />
                {readiness.approvalRequired && (
                  <ReadinessItem
                    action="Başvuruyu görüntüle"
                    complete={readiness.approvalSatisfied}
                    description={
                      readiness.approvalSatisfied
                        ? 'Yönetici onayı tamamlandı.'
                        : 'Bu ortamda arama görünürlüğü için yönetici onayı gereklidir.'
                    }
                    to="/operator/profile"
                    title="Yönetici onayı"
                  />
                )}
                <ReadinessItem
                  action="Okulları yönet"
                  complete={readiness.hasActiveSchoolRelationship}
                  description={
                    readiness.hasActiveSchoolRelationship
                      ? 'En az bir aktif okul bağlantınız var.'
                      : 'Aktif bir okula bağlı en az bir okul bağlantısı ekleyin.'
                  }
                  to={
                    canManageSchools(readiness)
                      ? '/operator/schools'
                      : undefined
                  }
                  title="Okul kapsamınızı ekleyin"
                />
                <ReadinessItem
                  action="Mahalleleri seç"
                  complete={readiness.hasEligibleSchoolCoverage}
                  description={
                    readiness.hasEligibleSchoolCoverage
                      ? 'En az bir uygun okul için geçerli hizmet mahallesi seçildi.'
                      : 'Aktif okullarınızdan en az biri için hizmet mahallesi seçin.'
                  }
                  to={
                    canManageSchools(readiness)
                      ? '/operator/schools'
                      : undefined
                  }
                  title="Hizmet mahallelerini seçin"
                />
              </ol>
              {canManageSchools(readiness) && (
                <Link className="operator-card-link" to="/operator/offerings">
                  Araçlar ve servisler isteğe bağlıdır
                </Link>
              )}
            </section>

            <section
              className="readiness-schools"
              aria-labelledby="school-readiness-title"
            >
              <div className="operator-card-heading">
                <h2 id="school-readiness-title">Bağlı okullar</h2>
                {canManageSchools(readiness) && (
                  <Link to="/operator/schools">Tümünü gör</Link>
                )}
              </div>
              {readiness.schools.length > 0 ? (
                <ul>
                  {readiness.schools.slice(0, 3).map((school) => (
                    <li key={school.operatorSchoolId}>
                      <span className="operator-school-mark" aria-hidden="true">
                        {schoolInitials(school.schoolName)}
                      </span>
                      <div>
                        <strong>{school.schoolName}</strong>
                        <span>{schoolReadinessMessage(school)}</span>
                      </div>
                      <StatusBadge
                        tone={
                          school.contributesToDiscovery ? 'success' : 'warning'
                        }
                      >
                        {school.contributesToDiscovery ? 'Aktif' : 'Eksik'}
                      </StatusBadge>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="operator-overview-empty">
                  Henüz bağlı okulunuz yok. Aramalarda görünmek için hizmet
                  verdiğiniz okulu ve mahalleleri ekleyin.
                </p>
              )}
              {canManageSchools(readiness) && (
                <Link
                  className="secondary-button button-link operator-school-action"
                  to="/operator/schools"
                >
                  Okul kapsamını düzenle
                </Link>
              )}
            </section>
          </div>

          <div className="operator-overview-secondary-grid">
            <section
              className="operator-quick-links"
              aria-labelledby="quick-links-title"
            >
              <h2 id="quick-links-title">Profilinize kısayollar</h2>
              <div>
                <QuickLink
                  description="İletişim ve görünürlük"
                  title="İşletme profilim"
                  to="/operator/profile"
                />
                {canManageSchools(readiness) && (
                  <>
                    <QuickLink
                      description="Hizmet alanını yönetin"
                      title="Okul ve mahalle kapsamı"
                      to="/operator/schools"
                    />
                    <QuickLink
                      description="İsteğe bağlı ayrıntılar"
                      title="Araçlar ve servisler"
                      to="/operator/offerings"
                    />
                  </>
                )}
              </div>
            </section>

            <section
              className="operator-account-status"
              aria-labelledby="account-status-title"
            >
              <h2 id="account-status-title">Profil görünürlüğü</h2>
              <p>
                Yayın koşulları tamamlandığında profiliniz uygun aramalarda
                gösterilir.
              </p>
              <StatusLine
                complete={readiness.emailVerified && readiness.accountEnabled}
                label="Hesap durumu"
              />
              <StatusLine
                complete={readiness.profileActive && readiness.publiclyVisible}
                label="Profil durumu"
              />
              {readiness.approvalRequired && (
                <StatusLine
                  complete={readiness.approvalSatisfied}
                  label="Yönetici onayı"
                />
              )}
              <StatusLine
                complete={readiness.hasEligibleSchoolCoverage}
                label="Okul ve mahalle kapsamı"
              />
            </section>
          </div>
        </>
      )}
    </section>
  )
}

function ReadinessItem({
  action,
  complete,
  description,
  title,
  to,
}: {
  action?: string
  complete: boolean
  description: string
  title: string
  to?: string
}) {
  return (
    <li className={complete ? 'complete' : 'incomplete'}>
      <span
        className="operator-readiness-state"
        data-complete={complete}
        aria-label={complete ? 'Tamam' : 'Eksik'}
        role="img"
      />
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {to && action && <Link to={to}>{action}</Link>}
    </li>
  )
}

function SummaryCard({
  label,
  note,
  tone,
  value,
}: {
  label: string
  note: string
  tone: 'accent' | 'info' | 'success' | 'warning'
  value: string
}) {
  return (
    <article className={`operator-summary-card ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{note}</small>
    </article>
  )
}

function QuickLink({
  description,
  title,
  to,
}: {
  description: string
  title: string
  to: string
}) {
  return (
    <Link className="operator-quick-link" to={to}>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
    </Link>
  )
}

function StatusLine({ complete, label }: { complete: boolean; label: string }) {
  return (
    <div className="operator-status-line">
      <span>{label}</span>
      <StatusBadge tone={complete ? 'success' : 'warning'}>
        {complete ? 'Tamam' : 'Eksik'}
      </StatusBadge>
    </div>
  )
}

function canManageSchools(readiness: DiscoveryReadiness) {
  return (
    readiness.emailVerified &&
    readiness.accountEnabled &&
    readiness.profileActive &&
    (!readiness.approvalRequired || readiness.approvalSatisfied)
  )
}

function profileGuidance(readiness: DiscoveryReadiness) {
  if (!readiness.profileActive) {
    return 'Askıya alınmış veya etkin olmayan profil aramalarda gösterilmez.'
  }
  if (!readiness.publiclyVisible) {
    return 'Profil görünürlüğünü açarak işletme ve iletişim bilgilerinizi aramalarda yayınlayın.'
  }
  return 'Profil aktif ve herkese açık.'
}

function schoolReadinessMessage(school: DiscoveryReadiness['schools'][number]) {
  if (!school.schoolActive) {
    return 'Okul yönetici tarafından pasife alındı; aramalara katkı sağlamaz.'
  }
  if (!school.relationshipActive) {
    return 'Okul bağlantısı pasif; etkinleştirmeniz gerekir.'
  }
  if (school.validCoverageCount === 0) {
    return 'Henüz hizmet mahallesi seçilmedi.'
  }
  return `${school.validCoverageCount} geçerli hizmet mahallesiyle aramalara katkı sağlar.`
}

function activeSchoolCount(readiness: DiscoveryReadiness) {
  return readiness.schools.filter(
    (school) => school.relationshipActive && school.schoolActive,
  ).length
}

function coverageCount(readiness: DiscoveryReadiness) {
  return readiness.schools.reduce(
    (total, school) => total + school.validCoverageCount,
    0,
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

import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiError } from '../../api/client'
import { StatusBadge } from '../../components/design-system'
import { getDiscoveryReadiness, type DiscoveryReadiness } from './operator-api'

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
      <header className="operator-page-header">
        <h1>Aramalarda görünmeye hazır mısınız?</h1>
        <p>
          Profilinizin velilerin aramalarında görünmesi için gereken adımları
          buradan takip edin.
        </p>
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
            <strong>
              {readiness.discoveryEligible
                ? 'Profiliniz uygun aramalarda görünebilir.'
                : 'Profiliniz henüz arama sonuçlarında görünmüyor.'}
            </strong>
            <span>
              {readiness.discoveryEligible
                ? 'Yalnızca seçtiğiniz okullar ve hizmet mahalleleriyle eşleşen aramalarda listelenirsiniz.'
                : 'Eksik adımları tamamlayın.'}
            </span>
          </div>

          <section
            className="operator-task-section"
            aria-labelledby="readiness-steps-title"
          >
            <div className="operator-section-heading">
              <div>
                <h2 id="readiness-steps-title">Kurulum adımları</h2>
                <p>Eksik adımların bağlantılarını izleyerek devam edin.</p>
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
                complete={readiness.profileActive && readiness.publiclyVisible}
                description={profileGuidance(readiness)}
                to="/operator/profile"
                title="Aktif ve herkese açık profil"
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
                  canManageSchools(readiness) ? '/operator/schools' : undefined
                }
                title="Hizmet verdiğiniz okullar"
              />
              <ReadinessItem
                action="Hizmet mahallelerini seç"
                complete={readiness.hasEligibleSchoolCoverage}
                description={
                  readiness.hasEligibleSchoolCoverage
                    ? 'En az bir uygun okul için geçerli hizmet mahallesi seçildi.'
                    : 'Aktif okullarınızdan en az biri için hizmet mahallesi seçin.'
                }
                to={
                  canManageSchools(readiness) ? '/operator/schools' : undefined
                }
                title="Hizmet verdiğiniz mahalleler"
              />
            </ol>
          </section>

          {readiness.schools.length > 0 && (
            <section
              className="readiness-schools"
              aria-labelledby="school-readiness-title"
            >
              <h2 id="school-readiness-title">Okul bazında durum</h2>
              <ul>
                {readiness.schools.map((school) => (
                  <li key={school.operatorSchoolId}>
                    <strong>{school.schoolName}</strong>
                    <span>{schoolReadinessMessage(school)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section
            className="optional-next-steps"
            aria-labelledby="optional-title"
          >
            <div>
              <h2 id="optional-title">
                Araç ve servis bilgileri (isteğe bağlı)
              </h2>
              <p>Aramalarda görünmek için araç eklemek zorunda değilsiniz.</p>
            </div>
            {canManageSchools(readiness) && (
              <Link
                className="secondary-button button-link"
                to="/operator/offerings"
              >
                Araçlar ve servis bilgileri
              </Link>
            )}
          </section>
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
      <StatusBadge tone={complete ? 'success' : 'warning'}>
        {complete ? 'Tamam' : 'Eksik'}
      </StatusBadge>
      <div>
        <strong>{title}</strong>
        <p>{description}</p>
      </div>
      {!complete && to && action && <Link to={to}>{action}</Link>}
    </li>
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

function InlineLoading({ label }: { label: string }) {
  return (
    <div className="inline-loading" aria-busy="true" aria-live="polite">
      <span className="loading-dot" aria-hidden="true" />
      {label}
    </div>
  )
}

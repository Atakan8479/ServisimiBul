import { Link, useSearchParams } from 'react-router-dom'
import { AuthFrame } from './AuthFrame'
import './auth-ui.css'

function nextForDemand(next: string | null): string {
  if (next === '/demands') return next
  if (next?.startsWith('/demands?')) return next
  if (next?.startsWith('/demands/')) return next
  return '/demands'
}

export function SignupChoicePage() {
  const [params] = useSearchParams()
  const next = encodeURIComponent(nextForDemand(params.get('next')))

  return (
    <AuthFrame
      title="Nasıl katılmak istersiniz?"
      subtitle="İhtiyacınıza uygun hesap türünü seçin. Servis aramak için hesap oluşturmanız gerekmez."
    >
      <div className="account-type-options">
        <Link
          className="account-type-option"
          to={`/parent/register?next=${next}`}
          viewTransition
        >
          <span className="account-type-mark parent" aria-hidden="true">
            V
          </span>
          <span>
            <strong>Veli olarak</strong>
            <small>
              Servis talebi oluşturun, destekleyin ve bildirimlerinizi yönetin.
            </small>
          </span>
          <span className="auth-arrow" aria-hidden="true" />
        </Link>
        <Link
          className="account-type-option"
          to="/operator/register"
          viewTransition
        >
          <span className="account-type-mark operator" aria-hidden="true">
            İ
          </span>
          <span>
            <strong>İşletmeci olarak</strong>
            <small>İşletme profilinizi ve hizmet kapsamınızı paylaşın.</small>
          </span>
          <span className="auth-arrow" aria-hidden="true" />
        </Link>
      </div>
      <div className="auth-separator" aria-hidden="true">
        <span>veya</span>
      </div>
      <div className="auth-choice-login">
        <span>Zaten hesabınız var mı?</span>
        <div>
          <Link to={`/parent/login?next=${next}`} viewTransition>
            Veli girişi
          </Link>
          <Link to="/operator/login" viewTransition>
            İşletmeci girişi
          </Link>
        </div>
      </div>
      <p className="auth-privacy-note">
        Veli hesabı yalnızca talep ve bildirim işlemleri içindir. Okul servisi
        araması herkese açıktır.
      </p>
    </AuthFrame>
  )
}

import { Link, useSearchParams } from 'react-router-dom'

function nextForDemand(next: string | null): string {
  return next?.startsWith('/demands') && !next.startsWith('//') && !next.includes('\\')
    ? next
    : '/demands'
}

export function SignupChoicePage() {
  const [params] = useSearchParams()
  const next = encodeURIComponent(nextForDemand(params.get('next')))
  return (
    <section className="auth-card" aria-labelledby="account-type-title">
      <p className="eyebrow">Kayıt</p>
      <h1 id="account-type-title">Nasıl kullanmak istiyorsunuz?</h1>
      <p>Hesap türünüzü seçin. Veli ve işletmeci hesapları farklı yetkilere sahiptir.</p>
      <div className="form-stack">
        <Link className="button-link" to={`/parent/register?next=${next}`} viewTransition>
          Veliyim — servis talebi oluşturmak istiyorum
        </Link>
        <Link className="button-link" to="/operator/register" viewTransition>
          İşletmeciyim — servis hizmeti sunuyorum
        </Link>
      </div>
      <p className="auth-switch">Zaten hesabınız var mı?{' '}
        <Link to={`/operator/login?next=${next}`} viewTransition>Giriş yapın</Link>
      </p>
    </section>
  )
}

export function ParentSignupPage() {
  const [params] = useSearchParams()
  const next = encodeURIComponent(nextForDemand(params.get('next')))
  return (
    <section className="auth-card" aria-labelledby="parent-register-title">
      <p className="eyebrow">Veli hesabı</p>
      <h1 id="parent-register-title">Veli kaydı henüz açık değil</h1>
      <p>Veli hesapları şu anda yalnızca doğrulanmış pilot katılımcıları için oluşturuluyor.
        E-posta gönderimi kapalı olduğu için herkese açık kayıt başlatılamıyor.</p>
      <p>Mevcut bir veli hesabınız varsa giriş yaparak servis talebi oluşturabilir veya destekleyebilirsiniz.</p>
      <Link className="button-link" to={`/operator/login?next=${next}`} viewTransition>Veli hesabımla giriş yap</Link>
      <p className="auth-switch"><Link to="/register" viewTransition>Hesap türüne geri dön</Link></p>
    </section>
  )
}

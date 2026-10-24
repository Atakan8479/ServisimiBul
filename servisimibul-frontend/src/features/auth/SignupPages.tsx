import { Link, useSearchParams } from 'react-router-dom'

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
    <section className="auth-card" aria-labelledby="account-type-title">
      <p className="eyebrow">Kayıt</p>
      <h1 id="account-type-title">Nasıl kullanmak istiyorsunuz?</h1>
      <p>Veli ve işletmeci hesaplarının yetkileri farklıdır.</p>
      <div className="form-stack">
        <Link
          className="button-link"
          to={`/parent/register?next=${next}`}
          viewTransition
        >
          Veliyim — servis talebi oluşturmak istiyorum
        </Link>
        <Link className="button-link" to="/operator/register" viewTransition>
          İşletmeciyim — servis hizmeti sunuyorum
        </Link>
      </div>
      <p className="auth-switch">
        Zaten hesabınız var mı?{' '}
        <Link to={`/operator/login?next=${next}`} viewTransition>
          Giriş yapın
        </Link>
      </p>
    </section>
  )
}

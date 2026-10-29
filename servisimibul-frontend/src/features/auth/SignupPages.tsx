import { Link, useSearchParams } from 'react-router-dom'
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
    <section
      className="auth-card auth-ui-card signup-choice-card"
      aria-labelledby="account-type-title"
    >
      <header className="auth-ui-heading">
        <h1 id="account-type-title">Nasıl kullanmak istiyorsunuz?</h1>
      </header>

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
        Veli hesabınız var mı?{' '}
        <Link to={`/parent/login?next=${next}`} viewTransition>
          Veli girişi
        </Link>
      </p>
      <p className="auth-switch">
        İşletmeci hesabınız var mı?{' '}
        <Link to="/operator/login" viewTransition>
          İşletmeci girişi
        </Link>
      </p>
    </section>
  )
}

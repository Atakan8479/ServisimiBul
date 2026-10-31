import { useId, type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  const titleId = useId()

  return (
    <div className="auth-experience">
      <aside
        className="auth-experience-visual"
        aria-label="ServisimiBul tanıtımı"
      >
        <div className="auth-experience-image" aria-hidden="true" />
        <div className="auth-experience-copy">
          <h2>Okul servisi keşfi, daha anlaşılır.</h2>
          <span>
            Aramanızı okul ve mahalle kapsamına göre yapın; hizmeti işletmeciyle
            doğrudan teyit edin.
          </span>
          <small>Hesap gerektirmeyen keşif · Doğrudan iletişim</small>
        </div>
      </aside>

      <section className="auth-experience-main" aria-labelledby={titleId}>
        <div className="auth-experience-panel">
          <header className="auth-experience-heading">
            <h1 id={titleId}>{title}</h1>
            {subtitle && <span>{subtitle}</span>}
          </header>
          {children}
          <footer className="auth-experience-footer">
            <span>ServisimiBul · Okul servisi keşfi</span>
            <Link to="/" viewTransition>
              Anonim aramaya dön
            </Link>
          </footer>
        </div>
      </section>
    </div>
  )
}

export function HomePage() {
  return (
    <section className="hero">
      <div className="hero-card">
        <h1>ServisimiBul</h1>
        <p className="hero-copy">Servis bulmanın yeni yolu.</p>
      </div>
      <div className="notice" role="note">
        Okul arama ekranı yakında burada olacak.
      </div>
    </section>
  )
}

export function FoundationPage({
  eyebrow,
  title,
  detail,
}: {
  eyebrow: string
  title: string
  detail: string
}) {
  return (
    <section className="foundation-card">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{detail}</p>
    </section>
  )
}

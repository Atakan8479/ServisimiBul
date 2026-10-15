export function HomePage() {
  return (
    <section className="hero">
      <h1>
        Okul servisi aramanın <span>daha açık yolu.</span>
      </h1>
      <p className="hero-copy">
        ServisimiBul, velilerin okula ve mahalleye göre uygun servis
        işletmecilerini bulup doğrudan iletişime geçmesine yardımcı olur.
      </p>
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

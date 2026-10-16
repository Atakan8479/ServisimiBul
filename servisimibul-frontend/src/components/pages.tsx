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

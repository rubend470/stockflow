import { AppLayout } from '../components/layout/AppLayout'

interface PlaceholderPageProps {
  title: string
  subtitle: string
  description: string
  highlights?: string[]
}

export function PlaceholderPage({
  title,
  subtitle,
  description,
  highlights = [],
}: PlaceholderPageProps) {
  return (
    <AppLayout title={title} subtitle={subtitle}>
      <section className="page-card">
        <div className="page-card-icon">🚧</div>
        <h2>Módulo en construcción</h2>
        <p>{description}</p>

        {highlights.length > 0 && (
          <ul className="page-highlights">
            {highlights.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </section>
    </AppLayout>
  )
}

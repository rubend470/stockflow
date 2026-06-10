import type { ReactNode } from 'react'

interface PosSectionProps {
  step: number
  title: string
  hint?: string
  tone?: 'green' | 'blue' | 'violet' | 'amber'
  children: ReactNode
}

export function PosSection({ step, title, hint, tone = 'green', children }: PosSectionProps) {
  return (
    <section className={`pos-section pos-section-${tone}`}>
      <header className="pos-section-header">
        <span className="pos-section-step">{step}</span>
        <div>
          <h2>{title}</h2>
          {hint && <p>{hint}</p>}
        </div>
      </header>
      <div className="pos-section-body">{children}</div>
    </section>
  )
}

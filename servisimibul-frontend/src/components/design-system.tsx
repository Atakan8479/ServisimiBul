import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  ReactElement,
  ReactNode,
} from 'react'
import { cloneElement } from 'react'

type ButtonTone = 'primary' | 'secondary' | 'danger' | 'quiet'
type StatusTone = 'neutral' | 'info' | 'success' | 'warning' | 'danger'

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup${compact ? ' brand-lockup-compact' : ''}`}>
      <span className="brand-mark" aria-hidden="true">
        <span />
      </span>
      <span className="brand-wordmark">
        Servisimi<span>Bul</span>
      </span>
    </span>
  )
}

export function Button({
  className = '',
  tone = 'primary',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: ButtonTone }) {
  return (
    <button
      className={`ui-button ui-button-${tone} ${className}`.trim()}
      {...props}
    />
  )
}

export function StatusBadge({
  children,
  tone = 'neutral',
}: {
  children: ReactNode
  tone?: StatusTone
}) {
  return <span className={`ui-status ui-status-${tone}`}>{children}</span>
}

export function SurfaceCard({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return <div className={`ui-surface ${className}`.trim()} {...props} />
}

export function SectionShell({
  children,
  className = '',
  title,
  description,
}: {
  children?: ReactNode
  className?: string
  title: string
  description?: string
}) {
  return (
    <section className={`ui-section ${className}`.trim()}>
      <header className="ui-section-heading">
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </header>
      {children}
    </section>
  )
}

export function FormField({
  children,
  error,
  hint,
  htmlFor,
  label,
}: {
  children: ReactElement<{
    'aria-describedby'?: string
    'aria-invalid'?: boolean
    id?: string
  }>
  error?: string
  hint?: string
  htmlFor: string
  label: string
}) {
  const messageId = error
    ? `${htmlFor}-error`
    : hint
      ? `${htmlFor}-hint`
      : undefined
  const control = cloneElement(children, {
    id: children.props.id ?? htmlFor,
    'aria-describedby': children.props['aria-describedby'] ?? messageId,
    'aria-invalid': error ? true : children.props['aria-invalid'],
  })

  return (
    <div className="ui-field">
      <label htmlFor={htmlFor}>{label}</label>
      {control}
      {error ? (
        <small className="ui-field-error" id={`${htmlFor}-error`}>
          {error}
        </small>
      ) : hint ? (
        <small id={`${htmlFor}-hint`}>{hint}</small>
      ) : null}
    </div>
  )
}

export function StatePanel({
  action,
  detail,
  title,
  tone = 'neutral',
}: {
  action?: ReactNode
  detail: string
  title: string
  tone?: 'neutral' | 'loading' | 'error'
}) {
  return (
    <SurfaceCard
      className={`ui-state ui-state-${tone}`}
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      aria-busy={tone === 'loading' || undefined}
    >
      <span className="ui-state-mark" aria-hidden="true" />
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
      </div>
      {action && <div className="ui-state-action">{action}</div>}
    </SurfaceCard>
  )
}

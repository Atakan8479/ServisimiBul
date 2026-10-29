import { cloneElement, isValidElement, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { X, Search, Inbox } from 'lucide-react';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'quiet';
export function Button({ variant = 'primary', size = 'md', className = '', asChild = false, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg' | 'icon'; asChild?: boolean }) {
  const classes = `btn btn-${variant} btn-${size} ${className}`.trim();
  if (asChild && isValidElement(children)) {
    const child = children as React.ReactElement<{ className?: string }>;
    return cloneElement(child, { ...props, className: `${classes} ${child.props.className ?? ''}`.trim() } as never);
  }
  return <button className={classes} {...props}>{children}</button>;
}

export function IconButton({ label, className = '', children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return <button className={`icon-button ${className}`} aria-label={label} title={label} {...props}>{children}</button>;
}

export function Card({ className = '', children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={`card ${className}`.trim()} {...props}>{children}</div>;
}

export function Badge({ tone = 'neutral', dot = false, children }: { tone?: 'neutral' | 'teal' | 'green' | 'yellow' | 'red' | 'blue' | 'outline'; dot?: boolean; children: ReactNode }) {
  return <span className={`badge badge-${tone}`}>{dot && <i aria-hidden="true" />}{children}</span>;
}

export function PageHeader({ eyebrow, title, description, actions, className = '' }: { eyebrow?: string; title: string; description?: string; actions?: ReactNode; className?: string }) {
  return <div className={`page-header ${className}`}>
    <div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="page-header-actions">{actions}</div>}
  </div>;
}

export function Field({ label, hint, error, className = '', id, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string; className?: string }) {
  const fieldId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
  return <div className={`field ${className}`}>
    <label htmlFor={fieldId}>{label}</label>
    <input id={fieldId} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined} {...props} />
    {hint && !error && <small id={`${fieldId}-hint`} className="field-hint">{hint}</small>}
    {error && <small id={`${fieldId}-error`} className="field-error">{error}</small>}
  </div>;
}

export function SelectField({ label, hint, error, className = '', id, children, ...props }: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string; className?: string }) {
  const fieldId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');
  return <div className={`field ${className}`}>
    <label htmlFor={fieldId}>{label}</label>
    <select id={fieldId} aria-invalid={Boolean(error)} aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined} {...props}>{children}</select>
    {hint && !error && <small id={`${fieldId}-hint`} className="field-hint">{hint}</small>}
    {error && <small id={`${fieldId}-error`} className="field-error">{error}</small>}
  </div>;
}

export function SearchInput({ placeholder = 'Ara...', className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <label className={`search-input ${className}`}><Search size={17} aria-hidden="true"/><span className="visually-hidden">Ara</span><input placeholder={placeholder} {...props} /></label>;
}

export function StatCard({ label, value, note, icon, tone = 'teal' }: { label: string; value: string; note?: string; icon: ReactNode; tone?: 'teal' | 'yellow' | 'blue' | 'green' }) {
  return <Card className="stat-card"><div className={`stat-icon tone-${tone}`}>{icon}</div><div className="stat-content"><span>{label}</span><strong>{value}</strong>{note && <small>{note}</small>}</div></Card>;
}

export function Modal({ open, title, description, onClose, children, footer, size = 'md' }: { open: boolean; title: string; description?: string; onClose: () => void; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <section className={`modal modal-${size}`} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-header"><div><h2 id="modal-title">{title}</h2>{description && <p>{description}</p>}</div><IconButton label="Pencereyi kapat" onClick={onClose}><X size={18}/></IconButton></div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </section>
  </div>;
}

export function EmptyState({ title, description, action, icon }: { title: string; description: string; action?: ReactNode; icon?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon ?? <Inbox size={24}/>}</div><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function DemoNotice({ children = 'Prototip görünümü · Örnek veriler kullanılır.' }: { children?: ReactNode }) {
  return <div className="demo-notice"><span className="demo-dot" aria-hidden="true" />{children}</div>;
}

export function InlineMessage({ kind = 'info', children }: { kind?: 'info' | 'success' | 'error' | 'warning'; children: ReactNode }) {
  const Icon = kind === 'success' ? Search : kind === 'error' ? X : Search;
  return <div className={`inline-message message-${kind}`} role={kind === 'error' ? 'alert' : 'status'}><Icon size={16} aria-hidden="true"/><span>{children}</span></div>;
}

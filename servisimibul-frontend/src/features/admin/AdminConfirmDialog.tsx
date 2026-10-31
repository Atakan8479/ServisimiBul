import { useEffect, useId, useRef, type ReactNode } from 'react'

export function AdminConfirmDialog({
  children,
  confirmLabel,
  danger = false,
  onCancel,
  onConfirm,
  pending,
  title,
}: {
  children: ReactNode
  confirmLabel: string
  danger?: boolean
  onCancel: () => void
  onConfirm: () => void
  pending: boolean
  title: string
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    const opener = document.activeElement
    dialog?.showModal()
    cancelRef.current?.focus()
    return () => {
      dialog?.close()
      if (opener instanceof HTMLElement) opener.focus()
    }
  }, [])

  return (
    <dialog
      aria-labelledby={titleId}
      className="admin-confirm-dialog"
      onCancel={(event) => {
        event.preventDefault()
        if (!pending) onCancel()
      }}
      ref={dialogRef}
    >
      <h2 id={titleId}>{title}</h2>
      <div className="admin-confirm-body">{children}</div>
      <div className="admin-confirm-actions">
        <button
          className="secondary-button"
          disabled={pending}
          onClick={onCancel}
          ref={cancelRef}
          type="button"
        >
          Vazgeç
        </button>
        <button
          className={danger ? 'admin-danger-solid' : 'primary-button'}
          disabled={pending}
          onClick={onConfirm}
          type="button"
        >
          {pending ? 'İşleniyor…' : confirmLabel}
        </button>
      </div>
    </dialog>
  )
}

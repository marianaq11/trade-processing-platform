import { useEffect, useId, useRef, type ReactNode } from 'react'

interface Props {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
}

// Uses the browser's <dialog> element, which already handles focus trapping and Escape.
export default function Dialog({ open, title, onClose, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog || typeof dialog.showModal !== 'function') return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  return (
    <dialog ref={ref} className="dialog" aria-labelledby={titleId} onClose={onClose}>
      {open && (
        <>
          <div className="dialog-header">
            <h2 id={titleId}>{title}</h2>
            <button type="button" className="dialog-close" aria-label="Close" onClick={onClose}>
              &times;
            </button>
          </div>
          {children}
        </>
      )}
    </dialog>
  )
}

import type { ReactNode } from 'react'

interface Props {
  id: string
  label: string
  hint?: ReactNode
  error?: string
  children: ReactNode
}

// Label + control + one line underneath for either the error or a hint. The control should
// set aria-describedby={messageId(id)} so screen readers read that line too.
export default function Field({ id, label, hint, error, children }: Props) {
  return (
    <div className={error ? 'field has-error' : 'field'}>
      <label htmlFor={id}>{label}</label>
      {children}
      {error ? (
        <span className="field-error" id={messageId(id)}>
          {sentenceCase(error)}
        </span>
      ) : (
        hint && (
          <span className="field-hint" id={messageId(id)}>
            {hint}
          </span>
        )
      )}
    </div>
  )
}

export const messageId = (id: string) => `${id}-message`

// Bean Validation's default messages are lower case ("must not be blank").
function sentenceCase(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1)
}

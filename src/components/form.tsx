import { createContext, useContext, useId, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

const FieldLabel = createContext<string | undefined>(undefined)

/** The id of the enclosing Field's label, for controls a wrapping <label> doesn't name (custom dropdowns). */
export const useFieldLabelId = () => useContext(FieldLabel)

export function Field({ label, hint, error, children, className }: { label: string; hint?: string; error?: string | null; children: ReactNode; className?: string }) {
  const labelId = useId()
  return (
    <label className={cn('block', className)}>
      <span id={labelId} className="field-label">
        {label}
      </span>
      <FieldLabel.Provider value={labelId}>{children}</FieldLabel.Provider>
      {error ? <span className="mt-1 block text-sm text-danger">{error}</span> : hint && <span className="mt-1 block text-xs text-subtle">{hint}</span>}
    </label>
  )
}

export function Alert({ tone = 'danger', children }: { tone?: 'danger' | 'success' | 'info'; children: ReactNode }) {
  const tones = {
    danger: 'bg-danger-soft text-danger',
    success: 'bg-success-soft text-success',
    info: 'bg-accent-soft text-accent-soft-ink',
  }
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cn('rounded-lg px-4 py-3 text-sm', tones[tone])}>
      {children}
    </div>
  )
}

export function errorMessage(error: unknown) {
  if (error instanceof Error) {
    // Zod validator errors arrive as a JSON array of issues.
    try {
      const issues = JSON.parse(error.message) as { message?: string }[]
      if (Array.isArray(issues) && issues[0]?.message) return issues[0].message
    } catch {
      // Plain message.
    }
    return error.message
  }
  return "That didn't work. Try again."
}

/** Runs an async action with pending + error state, for the many small forms in the app. */
export function useAction<A extends unknown[], R>(fn: (...args: A) => Promise<R>) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const run = async (...args: A): Promise<R | undefined> => {
    setPending(true)
    setError(null)
    try {
      return await fn(...args)
    } catch (e) {
      setError(errorMessage(e))
      return undefined
    } finally {
      setPending(false)
    }
  }
  return { run, pending, error, setError }
}

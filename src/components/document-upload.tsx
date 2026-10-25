import { CheckCircleIcon, IdentificationIcon } from '@heroicons/react/24/solid'
import { useEffect, useState } from 'react'
import { uploadDocument } from '#/functions/covers.functions'
import { cn } from '#/lib/utils'
import { compress } from './cover-upload'
import { Alert, errorMessage } from './form'
import { Spinner } from './loading-line'

// An NRC's small print has to survive compression.
const DOCUMENT_EDGE = 1600

type State = { kind: 'idle' } | { kind: 'uploading'; preview: string } | { kind: 'done'; preview: string } | { kind: 'failed'; reason: string }

/**
 * A private photo for verification. The server returns only a key, so after a reload
 * there is no preview: the tile just says it's in.
 */
export function DocumentUpload({ label, hint, value, onChange }: { label: string; hint: string; value: string | null; onChange: (key: string | null) => void }) {
  const [state, setState] = useState<State>({ kind: 'idle' })
  const preview = state.kind === 'uploading' || state.kind === 'done' ? state.preview : null
  useEffect(() => () => (preview ? URL.revokeObjectURL(preview) : undefined), [preview])

  const pick = async (file: File | undefined) => {
    if (!file) return
    try {
      const blob = await compress(file, DOCUMENT_EDGE)
      setState({ kind: 'uploading', preview: URL.createObjectURL(blob) })
      onChange(null)
      const form = new FormData()
      form.append('cover', new File([blob], blob.type === 'image/webp' ? 'document.webp' : 'document.jpg', { type: blob.type }))
      const { key } = await uploadDocument({ data: form })
      setState((s) => (s.kind === 'uploading' ? { kind: 'done', preview: s.preview } : s))
      onChange(key)
    } catch (e) {
      setState({ kind: 'failed', reason: errorMessage(e) })
      onChange(null)
    }
  }

  const done = state.kind === 'done' || (state.kind === 'idle' && value)
  return (
    <div className="space-y-2">
      <label
        className={cn(
          'relative flex min-h-24 cursor-pointer items-center gap-4 overflow-hidden rounded-xl p-3 transition-shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink',
          done ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line-strong)] hover:shadow-[inset_0_0_0_1px_var(--color-accent-ink)]',
        )}
      >
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => void pick(e.target.files?.[0])} aria-label={label} />
        <span className="relative flex aspect-[3/2] w-24 shrink-0 items-center justify-center overflow-hidden rounded-md bg-sunken text-subtle">
          {preview ? <img src={preview} alt="" className="photo-in absolute inset-0 h-full w-full object-cover" /> : <IdentificationIcon className="size-7" aria-hidden />}
          {state.kind === 'uploading' && (
            <span className="absolute inset-0 flex items-center justify-center bg-deep/50 text-on-accent" role="status" aria-label="Uploading">
              <Spinner className="size-5" />
            </span>
          )}
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-medium">
            {label}
            {done && <CheckCircleIcon className="size-4 text-accent-ink" aria-label="Added" />}
          </span>
          <span className="mt-0.5 block text-xs text-subtle">{done ? 'Added. Tap to replace.' : hint}</span>
        </span>
      </label>
      {state.kind === 'failed' && <Alert>{state.reason}</Alert>}
    </div>
  )
}

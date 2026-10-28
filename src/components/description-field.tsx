import { CameraIcon, SparklesIcon } from '@heroicons/react/16/solid'
import { useEffect, useRef, useState } from 'react'
import { findDescriptionWithAi, readBackCoverPhoto } from '#/functions/ai.functions'
import { getBookDescription } from '#/functions/sell.functions'
import { DESCRIPTION_COPY as COPY } from '#/data/ai'
import { compress } from './cover-upload'
import { Alert, Field, useAction } from './form'
import { LoadingLine, Spinner } from './loading-line'

export interface DescribedBookInput {
  title: string
  authors: string[]
  isbn: string | null
  publisher: string | null
}

type Note = { kind: 'empty' } | { kind: 'lookedUp' } | { kind: 'suspect' } | { kind: 'cover' } | { kind: 'ai'; source: string }

/**
 * The book's description on the sell form. One that came with the book (from Kuwala or the online search) is shared
 * by every listing, so it's shown read-only and the helpers are off. Otherwise the seller writes it, or fills it from
 * a photo of the back cover or with AI, and can always edit what lands in the box.
 */
export function DescriptionField({
  fixed,
  fixedFrom,
  lookupIsbn,
  fromPhoto,
  suspect = false,
  onReplace,
  book,
  value,
  onChange,
}: {
  /** The description the book already has; undefined while it loads, null when it has none. */
  fixed: string | null | undefined
  fixedFrom: 'catalogue' | 'online'
  /** Look this ISBN up online once, when the book has no description. */
  lookupIsbn: string | null
  /** The box was filled from the seller's back-cover photo at the start. */
  fromPhoto: boolean
  /** The box holds an online description that may belong to another book. */
  suspect?: boolean
  /** Shown under a locked online description: lets the seller swap a wrong one for their own. */
  onReplace?: () => void
  book: DescribedBookInput
  value: string
  onChange: (value: string) => void
}) {
  const [note, setNote] = useState<Note>(fromPhoto ? { kind: 'cover' } : suspect ? { kind: 'suspect' } : { kind: 'empty' })
  const [looking, setLooking] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (fixed !== null || fromPhoto || !lookupIsbn) return
    let cancelled = false
    setLooking(true)
    getBookDescription({ data: { isbn: lookupIsbn } })
      .then(({ description }) => {
        if (cancelled || !description) return
        onChange(description)
        setNote({ kind: 'lookedUp' })
      })
      .catch(() => {})
      .finally(() => !cancelled && setLooking(false))
    return () => {
      cancelled = true
    }
    // Looked up once per book; onChange is a state setter.
  }, [fixed, lookupIsbn])

  const cover = useAction(async (file: File) => {
    const form = new FormData()
    form.append('photo', new File([await compress(file)], 'back.jpg', { type: 'image/jpeg' }))
    const { description } = await readBackCoverPhoto({ data: form })
    onChange(description)
    setNote({ kind: 'cover' })
  })
  const ai = useAction(async () => {
    if (!book.title.trim()) throw new Error(COPY.needsTitle)
    const found = await findDescriptionWithAi({ data: book })
    onChange(found.description)
    setNote({ kind: 'ai', source: found.source })
  })

  const busy = cover.pending || ai.pending || looking
  const locked = fixed !== null
  const hint = locked
    ? fixedFrom === 'catalogue'
      ? COPY.fixedCatalogue
      : COPY.fixedOnline
    : note.kind === 'cover'
      ? COPY.fromCover
      : note.kind === 'ai'
        ? COPY.fromAi(note.source)
        : note.kind === 'lookedUp'
          ? COPY.lookedUp
          : note.kind === 'suspect'
            ? COPY.suspect
            : COPY.empty

  return (
    <section className="space-y-3" aria-label={COPY.label}>
      <Field label={COPY.label} hint={hint}>
        {locked ? (
          <div className="input h-auto max-h-64 overflow-y-auto bg-sunken py-2.5 whitespace-pre-line text-muted" aria-readonly="true">
            {fixed === undefined ? <span className="text-subtle">…</span> : fixed}
          </div>
        ) : (
          <textarea className="input" rows={6} maxLength={8000} value={value} disabled={busy} onChange={(e) => onChange(e.target.value)} />
        )}
      </Field>
      {locked && onReplace && fixed && (
        <button type="button" onClick={onReplace} className="-mt-1 text-sm font-medium text-accent-ink">
          {COPY.replace}
        </button>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary btn-sm gap-1.5" disabled={locked || busy} onClick={() => fileRef.current?.click()}>
          {cover.pending ? <Spinner /> : <CameraIcon className="size-4" aria-hidden />}
          {COPY.readCover}
        </button>
        <button type="button" className="btn btn-secondary btn-sm gap-1.5" disabled={locked || busy} onClick={() => void ai.run()}>
          {ai.pending ? <Spinner /> : <SparklesIcon className="size-4" aria-hidden />}
          {COPY.findAi}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ''
            if (file) void cover.run(file)
          }}
        />
      </div>

      {cover.pending && <LoadingLine kind="read" />}
      {ai.pending && <LoadingLine kind="describe" />}
      {(cover.error || ai.error) && <Alert tone="info">{cover.error ?? ai.error}</Alert>}
    </section>
  )
}

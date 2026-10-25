import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { findAuthorPages, submitVerification } from '#/functions/verification.functions'
import { cn } from '#/lib/utils'
import { DocumentUpload } from './document-upload'
import { Alert, Field, useAction } from './form'
import { RowShapes } from './placeholder'
import type { VerifyDraft } from './onboarding/draft'

type Match = Awaited<ReturnType<typeof findAuthorPages>>[number]

const choice = (selected: boolean) =>
  cn(
    'flex cursor-pointer items-center gap-3 rounded-lg p-3 transition-[box-shadow,transform] duration-150 active:scale-[0.99] has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink',
    selected ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
  )

/** Proof that the author is who they say: which page is theirs, their NRC, and a photo with the book. */
export function VerificationForm({
  storeName,
  value,
  onChange,
  onSubmitted,
  aside,
}: {
  storeName: string
  value: VerifyDraft
  onChange: (patch: Partial<VerifyDraft>) => void
  onSubmitted: () => void
  /** Beside the submit button, e.g. "I'll do this later". */
  aside?: ReactNode
}) {
  const [matches, setMatches] = useState<Match[] | null>(null)
  useEffect(() => {
    let cancelled = false
    findAuthorPages({ data: { name: storeName } })
      .then((m) => !cancelled && setMatches(m))
      .catch(() => !cancelled && setMatches([]))
    return () => {
      cancelled = true
    }
  }, [storeName])

  const submit = useAction(async () => {
    if (value.authorId === undefined) throw new Error('Choose your author page')
    if (!value.id) throw new Error('Add a photo of your NRC or passport')
    if (!value.selfie) throw new Error('Add a photo of you holding your book')
    const documents = [
      { type: 'id' as const, key: value.id },
      { type: 'selfie' as const, key: value.selfie },
      ...(value.extra ? [{ type: 'extra' as const, key: value.extra }] : []),
    ]
    await submitVerification({ data: { authorId: value.authorId, legalName: value.legalName, documents } })
    onSubmitted()
  })

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault()
        void submit.run()
      }}
    >
      <fieldset>
        <legend className="field-label">Which page is yours?</legend>
        {matches === null ? (
          <RowShapes count={2} />
        ) : (
          <div className="space-y-2">
            {matches.map((m) => (
              <label key={m.id} className={choice(value.authorId === m.id)}>
                <input type="radio" name="author" className="sr-only" checked={value.authorId === m.id} onChange={() => onChange({ authorId: m.id })} />
                <Portrait name={m.name} src={m.photoUrl} />
                <span className="min-w-0">
                  <span className="block font-medium">{m.name}</span>
                  <span className="block text-xs text-subtle">
                    {m.books} {m.books === 1 ? 'book' : 'books'} already on Kuwala
                  </span>
                </span>
              </label>
            ))}
            <label className={choice(value.authorId === null)}>
              <input type="radio" name="author" className="sr-only" checked={value.authorId === null} onChange={() => onChange({ authorId: null })} />
              <Portrait name={storeName} src={null} />
              <span className="min-w-0">
                <span className="block font-medium">{matches.length ? 'None of these' : storeName}</span>
                <span className="block text-xs text-subtle">Start a new author page as {storeName}</span>
              </span>
            </label>
          </div>
        )}
      </fieldset>

      <Field label="Your full name" hint="As it is on your NRC or passport. Only our team sees it.">
        <input className="input" required minLength={3} maxLength={120} autoComplete="name" value={value.legalName} onChange={(e) => onChange({ legalName: e.target.value })} />
      </Field>

      <div className="grid gap-3 sm:grid-cols-2">
        <DocumentUpload label="NRC or passport" hint="The front, with your name and photo clear." value={value.id} onChange={(id) => onChange({ id })} />
        <DocumentUpload label="You with your book" hint="A selfie holding a copy, face and cover in view." value={value.selfie} onChange={(selfie) => onChange({ selfie })} />
        <div className="sm:col-span-2">
          <DocumentUpload label="Anything else (optional)" hint="An ISBN record, publisher letter or copyright certificate." value={value.extra} onChange={(extra) => onChange({ extra })} />
        </div>
      </div>
      <p className="text-xs text-subtle">These photos are private. We delete them once we’ve checked them.</p>

      {submit.error && <Alert>{submit.error}</Alert>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" className="btn btn-primary" disabled={submit.pending}>
          {submit.pending ? 'Sending…' : 'Send for review'}
        </button>
        {aside}
      </div>
    </form>
  )
}

function Portrait({ name, src }: { name: string; src: string | null }) {
  return src ? (
    <img src={src} alt="" className="aspect-[2/3] w-9 shrink-0 rounded-sm object-cover" />
  ) : (
    <span className="band flex aspect-[2/3] w-9 shrink-0 items-end rounded-sm p-1 text-sm leading-none font-bold" aria-hidden>
      {name.charAt(0)}
    </span>
  )
}

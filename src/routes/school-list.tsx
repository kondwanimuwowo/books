import { Link, createFileRoute, useLoaderData, useNavigate } from '@tanstack/react-router'
import { CameraIcon, XMarkIcon } from '@heroicons/react/24/solid'
import { useEffect, useRef, useState } from 'react'
import { readSchoolList } from '#/functions/ai.functions'
import type { ListLine } from '#/functions/ai.functions'
import { BookCover } from '#/components/book'
import { compress } from '#/components/cover-upload'
import { Alert, Field, useAction } from '#/components/form'
import { Price, useBag } from '#/components/providers'
import { conditionLabel } from '#/data/listing-options'
import { LIST_PHOTO_EDGE, MAX_LIST_PHOTOS, SCHOOL_LIST_COPY as COPY } from '#/data/school-list'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/school-list')({
  head: () => ({
    meta: [{ title: 'School book list | Kuwala Books' }, { name: 'description', content: 'Photograph your child’s school book list and find every book on Kuwala.' }],
  }),
  component: SchoolList,
})

type Result = Awaited<ReturnType<typeof readSchoolList>>

function SchoolList() {
  const [result, setResult] = useState<Result | null>(null)
  return (
    <div className="page max-w-3xl py-10 lg:py-14">
      <h1 className="text-4xl sm:text-5xl">{COPY.title}</h1>
      <p className="mt-2 max-w-prose text-muted">{COPY.intro}</p>
      <div className="mt-8">{result ? <Matches result={result} onReset={() => setResult(null)} /> : <ListInput onRead={setResult} />}</div>
    </div>
  )
}

function ListInput({ onRead }: { onRead: (result: Result) => void }) {
  const { user } = useLoaderData({ from: '__root__' })
  const [photos, setPhotos] = useState<{ blob: Blob; preview: string }[]>([])
  const [text, setText] = useState('')
  const previews = useRef<string[]>([])
  useEffect(() => () => previews.current.forEach((url) => URL.revokeObjectURL(url)), [])

  const addPhoto = async (file: File | undefined) => {
    if (!file) return
    const blob = await compress(file, LIST_PHOTO_EDGE)
    const preview = URL.createObjectURL(blob)
    previews.current.push(preview)
    setPhotos((current) => [...current, { blob, preview }].slice(0, MAX_LIST_PHOTOS))
  }

  const read = useAction(async () => {
    const form = new FormData()
    photos.forEach((p, i) => form.append('photo', new File([p.blob], `list-${i + 1}.${p.blob.type === 'image/webp' ? 'webp' : 'jpg'}`, { type: p.blob.type })))
    if (text.trim()) form.append('text', text.trim())
    onRead(await readSchoolList({ data: form }))
  })

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault()
        void read.run()
      }}
    >
      <fieldset>
        <legend className="field-label">{COPY.photos}</legend>
        <div className="flex flex-wrap gap-3">
          {photos.map((p, i) => (
            <div key={p.preview} className="relative w-24 sm:w-28">
              <img src={p.preview} alt={`Page ${i + 1}`} className="aspect-[3/4] w-full rounded-md object-cover shadow-md" />
              <button
                type="button"
                onClick={() => setPhotos(photos.filter((x) => x !== p))}
                aria-label={`Remove page ${i + 1}`}
                className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-surface text-muted shadow-md hover:text-ink"
              >
                <XMarkIcon className="size-3.5" aria-hidden />
              </button>
            </div>
          ))}
          {photos.length < MAX_LIST_PHOTOS && (
            <label className="flex aspect-[3/4] w-24 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-line-strong text-center text-subtle hover:border-accent-ink hover:text-accent-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink sm:w-28">
              <input type="file" accept="image/*" capture="environment" className="sr-only" aria-label={COPY.addPhoto} onChange={(e) => void addPhoto(e.target.files?.[0])} />
              <CameraIcon className="size-6" aria-hidden />
              <span className="px-2 text-xs font-medium">{COPY.addPhoto}</span>
            </label>
          )}
        </div>
      </fieldset>

      <Field label={COPY.text} hint={COPY.textHint}>
        <textarea className="input" rows={5} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} placeholder={'Junior English 3, Haydn Richards\nZambia Primary Mathematics Grade 3'} />
      </Field>

      {read.error && <Alert>{read.error}</Alert>}
      {user ? (
        <button type="submit" className="btn btn-primary" disabled={read.pending || (!photos.length && !text.trim())}>
          {read.pending ? COPY.finding : COPY.find}
        </button>
      ) : (
        <Link to="/login" search={{ next: '/school-list' }} className="btn btn-primary">
          {COPY.signIn}
        </Link>
      )}
    </form>
  )
}

function Matches({ result, onReset }: { result: Result; onReset: () => void }) {
  const { add, lines: bagLines } = useBag()
  const navigate = useNavigate()
  const forSale = result.lines.filter((l) => l.copy)
  const [picked, setPicked] = useState<Set<string>>(() => new Set(forSale.map((l) => l.copy?.listingId ?? '')))
  const chosen = forSale.filter((l) => l.copy && picked.has(l.copy.listingId))
  const total = chosen.reduce((n, l) => n + (l.copy?.priceNgwee ?? 0), 0)

  const toggle = (listingId: string) =>
    setPicked((current) => {
      const next = new Set(current)
      if (next.has(listingId)) next.delete(listingId)
      else next.add(listingId)
      return next
    })

  const addAll = async () => {
    for (const line of chosen) if (line.copy && !bagLines.some((b) => b.listingId === line.copy?.listingId)) add(line.copy.listingId)
    await navigate({ to: '/bag' })
  }

  return (
    <div className="space-y-6">
      {(result.school || result.grade) && <p className="eyebrow">{[result.school, result.grade].filter(Boolean).join(' · ')}</p>}
      <ul className="divide-y divide-line">
        {result.lines.map((line, i) => (
          <MatchRow key={`${line.title}-${i}`} line={line} checked={!!line.copy && picked.has(line.copy.listingId)} onToggle={toggle} />
        ))}
      </ul>

      {!forSale.length && <Alert tone="info">{COPY.empty}</Alert>}

      <div className="flex flex-wrap items-center gap-3 border-t border-line pt-6">
        {forSale.length > 0 && (
          <button type="button" className="btn btn-primary" disabled={!chosen.length} onClick={() => void addAll()}>
            Add {chosen.length} {chosen.length === 1 ? 'book' : 'books'} to bag · <Price ngwee={total} className="tabular-nums" />
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onReset}>
          {COPY.startOver}
        </button>
      </div>
    </div>
  )
}

function MatchRow({ line, checked, onToggle }: { line: ListLine; checked: boolean; onToggle: (listingId: string) => void }) {
  const listed = [line.title, line.author].filter(Boolean).join(', ')
  const content = (
    <>
      <div className="w-12 shrink-0">
        <BookCover src={line.book?.coverUrl ?? null} title={line.book?.title ?? line.title} />
      </div>
      <div className="min-w-0 flex-1">
        {line.book ? (
          <p className="font-medium">
            <Link to="/books/$slug" params={{ slug: line.book.slug }} className="text-ink">
              {line.book.title}
            </Link>
            {line.book.authorNames && <span className="font-normal text-muted"> · {line.book.authorNames}</span>}
          </p>
        ) : (
          <p className="font-medium text-muted">{line.title}</p>
        )}
        <p className="mt-0.5 text-sm text-subtle">
          {line.book ? `${COPY.listSays}: ${listed}` : line.author ? line.author : null}
          {line.subject && ` · ${line.subject}`}
        </p>
        {!line.copy && <p className="mt-1 text-sm text-subtle">{line.book ? COPY.soldOut : COPY.notFound}</p>}
      </div>
      {line.copy && (
        <div className="shrink-0 text-right">
          <Price ngwee={line.copy.priceNgwee} className="font-bold tabular-nums" />
          <p className="text-xs text-subtle">{conditionLabel(line.copy.condition)}</p>
        </div>
      )}
    </>
  )

  if (!line.copy) return <li className="flex items-start gap-4 py-4">{content}</li>
  const listingId = line.copy.listingId
  return (
    <li>
      <label className={cn('flex cursor-pointer items-start gap-4 py-4', !checked && 'opacity-60')}>
        <input type="checkbox" className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]" checked={checked} onChange={() => onToggle(listingId)} />
        {content}
      </label>
    </li>
  )
}

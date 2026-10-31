import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { getMyAuthorship, saveAuthorProfile, saveAuthoredBook } from '#/functions/author.functions'
import { BookCover } from '#/components/book'
import { CoverUpload } from '#/components/cover-upload'
import { SuggestInput, loadPublishers } from '#/components/suggest-input'
import { Alert, Field, useAction } from '#/components/form'
import { Select } from '#/components/select'
import { EmptyMessage, Placeholder, RowShapes } from '#/components/placeholder'
import { LANGUAGES } from '#/data/zambia'
import { AUTHOR_LINKS } from '#/data/tiers'
import { Plaque } from '#/components/plaque'
import { SchoolFields, schoolData, schoolProblem } from '#/components/school-fields'
import type { SchoolValue } from '#/components/school-fields'
import { schoolFieldsFor } from '#/data/listing-types'
import { PlaqueMoment } from '#/components/plaque-moment'

export const Route = createFileRoute('/_authed/account/author')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading your books" shapes={<RowShapes />} />,
  validateSearch: z.object({ book: z.string().uuid().optional() }),
  loader: () => getMyAuthorship(),
  component: AuthorDesk,
})

type Data = Awaited<ReturnType<typeof getMyAuthorship>>
type AuthorPage = Data['pages'][number]
type Book = Data['books'][number]

function AuthorDesk() {
  const { pages, books, categories } = Route.useLoaderData()
  const { book: openId } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  const open = (id: string | undefined) => void navigate({ search: id ? { book: id } : {}, replace: true, resetScroll: false })

  if (!pages.length) {
    return (
      <Placeholder mode="empty" label="Author page" shapes={<RowShapes />}>
        <EmptyMessage title="Not linked to an author yet" />
      </Placeholder>
    )
  }

  return (
    <div className="space-y-12">
      {pages.map((p) => (
        <ProfileEditor key={p.id} page={p} />
      ))}

      <section aria-labelledby="books-heading">
        <h2 id="books-heading" className="mb-4 text-xl">
          {books.length} {books.length === 1 ? 'book' : 'books'}
        </h2>
        {books.length ? (
          <ul className="space-y-3">
            {books.map((b) => (
              <li key={b.id} className="card p-3 sm:p-4">
                {openId === b.id ? (
                  <BookEditor book={b} categories={categories} onDone={() => open(undefined)} />
                ) : (
                  <BookRow book={b} onEdit={() => open(b.id)} />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <Placeholder mode="empty" label="Books" shapes={<RowShapes />}>
            <EmptyMessage title="No books under your name yet" />
          </Placeholder>
        )}
      </section>
    </div>
  )
}

type Links = Partial<Record<(typeof AUTHOR_LINKS)[number]['key'], string>>

function ProfileEditor({ page }: { page: AuthorPage }) {
  const router = useRouter()
  const [bio, setBio] = useState(page.bio ?? '')
  const [links, setLinks] = useState<Links>(page.links)
  const [photo, setPhoto] = useState<{ key: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const save = useAction(async () => {
    await saveAuthorProfile({ data: { authorId: page.id, bio, photoKey: photo?.key, links } })
    setSaved(true)
    await router.invalidate()
  })
  const dirty = bio !== (page.bio ?? '') || !!photo || AUTHOR_LINKS.some((l) => (links[l.key] ?? '') !== (page.links[l.key] ?? ''))
  const fresh = page.plaques.filter((m) => !m.seen)

  return (
    <section aria-labelledby={`author-${page.id}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
        <h2 id={`author-${page.id}`} className="text-2xl">
          {page.name}
        </h2>
        <Link to="/authors/$slug" params={{ slug: page.slug }} className="btn btn-secondary btn-sm shrink-0">
          View page
        </Link>
      </div>
      {fresh.length > 0 && <PlaqueMoment authorId={page.id} tier={fresh[fresh.length - 1].tier} reachedAt={fresh[fresh.length - 1].reachedAt} />}
      {page.plaques.length > fresh.length && (
        <div className="mb-6 grid gap-3 sm:grid-cols-2">
          {page.plaques
            .filter((m) => m.seen)
            .reverse()
            .map((m) => (
              <Plaque key={m.tier} tier={m.tier} reachedAt={m.reachedAt} />
            ))}
        </div>
      )}
      <form
        className="flex flex-col gap-6 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault()
          void save.run()
        }}
      >
        <CoverUpload current={page.photoUrl} label="Add photo" onChange={(p) => (setPhoto(p), setSaved(false))} onBusy={setBusy} />
        <div className="flex-1 space-y-4">
          <Field label="About you" hint="Shown on your author page.">
            <textarea className="input min-h-36 py-3" maxLength={2000} value={bio} onChange={(e) => (setBio(e.target.value), setSaved(false))} />
          </Field>
          <fieldset>
            <legend className="field-label">Where else to find you</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {AUTHOR_LINKS.map((l) => (
                <Field key={l.key} label={l.label}>
                  <input
                    className="input"
                    inputMode="url"
                    autoCapitalize="none"
                    maxLength={200}
                    placeholder={l.placeholder}
                    value={links[l.key] ?? ''}
                    onChange={(e) => (setLinks((v) => ({ ...v, [l.key]: e.target.value })), setSaved(false))}
                  />
                </Field>
              ))}
            </div>
          </fieldset>
          {save.error && <Alert>{save.error}</Alert>}
          <div className="flex items-center gap-3">
            <button type="submit" className="btn btn-primary" disabled={!dirty || busy || save.pending}>
              {busy ? 'Uploading photo…' : save.pending ? 'Saving…' : 'Save'}
            </button>
            {saved && !dirty && <span className="text-sm text-success">Saved</span>}
          </div>
        </div>
      </form>
    </section>
  )
}

function BookRow({ book, onEdit }: { book: Book; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <BookCover src={book.coverUrl} title={book.title} className="w-12 shrink-0 shadow-sm" />
      <div className="min-w-0 flex-1">
        <Link to="/books/$slug" params={{ slug: book.slug }} className="line-clamp-1 font-bold tracking-[-0.01em] text-ink">
          {book.title}
        </Link>
        <p className="text-sm text-subtle">{[book.publishedYear, book.publisher].filter(Boolean).join(' · ') || 'Details missing'}</p>
      </div>
      <button type="button" className="btn btn-secondary btn-sm shrink-0" onClick={onEdit}>
        Edit
      </button>
    </div>
  )
}

const toNumber = (v: string) => (v.trim() ? Number(v) : null)

function BookEditor({ book, categories, onDone }: { book: Book; categories: Data['categories']; onDone: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: book.title,
    subtitle: book.subtitle ?? '',
    description: book.description ?? '',
    publisher: book.publisher ?? '',
    publishedYear: book.publishedYear?.toString() ?? '',
    pageCount: book.pageCount?.toString() ?? '',
    language: book.language,
    categorySlug: book.categorySlug ?? '',
  })
  const [school, setSchool] = useState<SchoolValue>({
    ageBands: book.ageBands as SchoolValue['ageBands'],
    levels: book.levels,
    subject: book.subject ?? '',
    curriculum: book.curriculum === '2023' || book.curriculum === '2013' ? book.curriculum : book.levels.length ? 'both' : '',
  })
  const schoolFields = schoolFieldsFor(form.categorySlug)
  const [cover, setCover] = useState<{ key: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm({ ...form, [k]: e.target.value })
  const save = useAction(async () => {
    const schoolError = schoolProblem(schoolFields, school)
    if (schoolError) throw new Error(schoolError)
    await saveAuthoredBook({
      data: {
        bookId: book.id,
        title: form.title,
        subtitle: form.subtitle,
        description: form.description,
        publisher: form.publisher,
        publishedYear: toNumber(form.publishedYear),
        pageCount: toNumber(form.pageCount),
        language: form.language,
        categorySlug: form.categorySlug || null,
        school: schoolData(schoolFields, school),
        coverKey: cover?.key,
      },
    })
    await router.invalidate()
    onDone()
  })

  return (
    <form
      className="rise flex flex-col gap-6 p-1 sm:flex-row sm:p-2"
      onSubmit={(e) => {
        e.preventDefault()
        void save.run()
      }}
    >
      <CoverUpload current={book.coverUrl} label="Add cover" onChange={setCover} onBusy={setBusy} />
      <div className="grid flex-1 gap-4 sm:grid-cols-2">
        <Field label="Title" className="sm:col-span-2">
          <input className="input" required maxLength={300} value={form.title} onChange={set('title')} />
        </Field>
        <Field label="Subtitle" className="sm:col-span-2">
          <input className="input" maxLength={300} value={form.subtitle} onChange={set('subtitle')} />
        </Field>
        <Field label="Description" className="sm:col-span-2">
          <textarea className="input min-h-40 py-3" maxLength={8000} value={form.description} onChange={set('description')} />
        </Field>
        <Field label="Publisher">
          <SuggestInput maxLength={200} value={form.publisher} onChange={(publisher) => setForm((f) => ({ ...f, publisher }))} load={loadPublishers} />
        </Field>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Year">
            <input className="input" inputMode="numeric" type="number" min={1450} max={2100} value={form.publishedYear} onChange={set('publishedYear')} />
          </Field>
          <Field label="Pages">
            <input className="input" inputMode="numeric" type="number" min={1} max={10000} value={form.pageCount} onChange={set('pageCount')} />
          </Field>
        </div>
        <Field label="Language">
          <Select value={form.language} options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} onChange={(language) => setForm((f) => ({ ...f, language }))} />
        </Field>
        <Field label="Section">
          <Select
            value={form.categorySlug}
            options={[{ value: '', label: 'None' }, ...categories.map((c) => ({ value: c.slug, label: c.name }))]}
            onChange={(categorySlug) => setForm((f) => ({ ...f, categorySlug }))}
          />
        </Field>
        {schoolFields && (
          <div className="sm:col-span-2">
            <SchoolFields fields={schoolFields} value={school} onChange={setSchool} />
          </div>
        )}
        {save.error && (
          <div className="sm:col-span-2">
            <Alert>{save.error}</Alert>
          </div>
        )}
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className="btn btn-primary" disabled={busy || save.pending}>
            {busy ? 'Uploading photo…' : save.pending ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onDone}>
            Cancel
          </button>
        </div>
      </div>
    </form>
  )
}

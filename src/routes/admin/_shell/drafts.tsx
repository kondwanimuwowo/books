import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { createDraft, deleteDraft, listDrafts, publishDraft, saveDraft, sendInvite } from '#/functions/drafts.functions'
import type { DraftRow } from '#/functions/drafts.functions'
import { Empty, PageHeader, useStoreUrl } from '#/components/admin'
import { Alert, Field, useAction } from '#/components/form'
import { LoadingLine } from '#/components/loading-line'
import { Placeholder, RowShapes } from '#/components/placeholder'
import { AUTHOR_LINKS } from '#/data/tiers'
import { formatDate } from '#/lib/utils'

export const Route = createFileRoute('/admin/_shell/drafts')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading drafts" shapes={<RowShapes cover={false} />} />,
  loader: () => listDrafts(),
  component: Drafts,
})

function Drafts() {
  const rows = Route.useLoaderData()
  return (
    <div className="space-y-8">
      <PageHeader
        title="Author drafts"
        description="Research a Zambian author, check every fact against its source, publish their page, then invite them to claim it. Nothing reaches the author until you send it."
      />
      <NewDraft />
      {rows.length ? (
        <ul className="space-y-4">
          {rows.map((row) => (
            <DraftCard key={row.draft.id} row={row} />
          ))}
        </ul>
      ) : (
        <Empty>No drafts yet.</Empty>
      )}
    </div>
  )
}

function NewDraft() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [hints, setHints] = useState('')
  const create = useAction(async () => {
    await createDraft({ data: { name, hints } })
    setName('')
    setHints('')
    await router.invalidate()
  })
  return (
    <form
      className="card space-y-4 p-4 sm:p-5"
      onSubmit={(e) => {
        e.preventDefault()
        void create.run()
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Field label="Author">
          <input className="input" required minLength={3} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name as on their books" />
        </Field>
        <Field label="What you know (optional)" hint="A book title, their town or publisher helps tell people apart.">
          <input className="input" maxLength={600} value={hints} onChange={(e) => setHints(e.target.value)} />
        </Field>
      </div>
      {create.error && <Alert>{create.error}</Alert>}
      <div className="flex min-h-11 flex-wrap items-center gap-4">
        <button type="submit" className="btn btn-primary" disabled={create.pending}>
          Research and draft
        </button>
        {create.pending && <LoadingLine kind="research" className="flex-1" />}
      </div>
    </form>
  )
}

const toNumber = (v: string) => (v.trim() ? Number(v) : null)

function DraftCard({ row }: { row: DraftRow }) {
  const { draft, author } = row
  const router = useRouter()
  const storeUrl = useStoreUrl()
  const [editing, setEditing] = useState(!draft.authorId)
  const [form, setForm] = useState({
    name: draft.name,
    isZambian: draft.isZambian,
    bio: draft.bio,
    links: Object.fromEntries(AUTHOR_LINKS.map((l) => [l.key, draft.links[l.key] ?? ''])) as Record<(typeof AUTHOR_LINKS)[number]['key'], string>,
    books: draft.books.map((b) => ({ ...b, year: b.year?.toString() ?? '' })),
    email: draft.contact.email ?? '',
    phone: draft.contact.phone ?? '',
    invite: draft.invite ?? { subject: '', body: '', whatsapp: '' },
  })
  const [notice, setNotice] = useState<string | null>(null)
  const save = useAction(async () => {
    await saveDraft({ data: { id: draft.id, ...form, books: form.books.map((b) => ({ ...b, year: toNumber(b.year) })) } })
    setNotice('Saved')
    await router.invalidate()
  })
  const publish = useAction(async () => {
    await saveDraft({ data: { id: draft.id, ...form, books: form.books.map((b) => ({ ...b, year: toNumber(b.year) })) } })
    const result = await publishDraft({ data: { id: draft.id } })
    setNotice(`Published. ${result.added} ${result.added === 1 ? 'book' : 'books'} added to the catalogue by ISBN.`)
    setEditing(false)
    await router.invalidate()
  })
  const remove = useAction(async () => {
    await deleteDraft({ data: { id: draft.id } })
    await router.invalidate()
  })
  const invite = useAction(async (channel: 'email' | 'whatsapp') => {
    // Opened before the request, so the browser doesn't block it as a pop-up.
    const tab = channel === 'whatsapp' ? window.open('', '_blank') : null
    const result = await sendInvite({ data: { id: draft.id, channel } }).catch((e: unknown) => {
      tab?.close()
      throw e
    })
    if (tab && result.whatsapp) tab.location.href = result.whatsapp
    setNotice(channel === 'email' ? `Invite emailed to ${form.email}` : 'WhatsApp opened with the invite. Send it from there.')
    await router.invalidate()
  })
  const error = save.error ?? publish.error ?? remove.error ?? invite.error
  const busy = save.pending || publish.pending || remove.pending || invite.pending
  const setLink = (key: keyof typeof form.links) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, links: { ...form.links, [key]: e.target.value } })

  return (
    <li className="card space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-medium">
            {author ? (
              <a href={storeUrl(`/authors/${author.slug}`)} target="_blank" rel="noreferrer">
                {draft.name}
              </a>
            ) : (
              draft.name
            )}
          </p>
          <p className="text-sm text-subtle">
            {author ? (author.claimed ? 'Claimed by the author' : 'Published, not claimed yet') : 'Draft, not public'}
            {draft.invitedAt && ` · invited ${formatDate(draft.invitedAt)}`}
            {draft.optedOutAt && ' · asked not to be contacted'}
          </p>
        </div>
        {author && !editing && (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Edit invite
          </button>
        )}
      </div>

      {editing && (
        <div className="space-y-5">
          {!author && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Name on their books">
                  <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
                </Field>
                <label className="flex items-center gap-3 self-end pb-3 text-sm font-medium">
                  <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={form.isZambian} onChange={(e) => setForm({ ...form, isZambian: e.target.checked })} />
                  Zambian author
                </label>
              </div>
              <Field label="Bio" hint="Shown on their page until they claim it and write their own.">
                <textarea className="input" rows={5} maxLength={2000} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                {AUTHOR_LINKS.map((l) => (
                  <Field key={l.key} label={l.label}>
                    <input className="input" value={form.links[l.key]} onChange={setLink(l.key)} />
                  </Field>
                ))}
              </div>
              <fieldset>
                <legend className="field-label">Books found</legend>
                <p className="mb-2 text-xs text-subtle">Only books with an ISBN that Google or Open Library recognise are added to the catalogue.</p>
                <ul className="divide-y divide-line rounded-lg shadow-[inset_0_0_0_1px_var(--color-line)]">
                  {form.books.map((b, i) => (
                    <li key={i} className="grid gap-2 p-3 text-sm sm:grid-cols-[minmax(0,2fr)_5rem_minmax(0,1fr)_9rem_auto] sm:items-center">
                      <input className="input h-9" aria-label="Title" value={b.title} onChange={(e) => setForm({ ...form, books: form.books.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} />
                      <input className="input h-9" aria-label="Year" inputMode="numeric" value={b.year} onChange={(e) => setForm({ ...form, books: form.books.map((x, j) => (j === i ? { ...x, year: e.target.value } : x)) })} />
                      <span className="truncate text-subtle">{b.publisher ?? 'Publisher unknown'}</span>
                      <input className="input h-9" aria-label="ISBN" placeholder="ISBN" value={b.isbn ?? ''} onChange={(e) => setForm({ ...form, books: form.books.map((x, j) => (j === i ? { ...x, isbn: e.target.value || null } : x)) })} />
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setForm({ ...form, books: form.books.filter((_, j) => j !== i) })}>
                        Remove
                      </button>
                    </li>
                  ))}
                  {!form.books.length && <li className="p-3 text-sm text-subtle">None found.</li>}
                </ul>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm mt-2"
                  onClick={() => setForm({ ...form, books: [...form.books, { title: '', year: '', publisher: null, isbn: null }] })}
                >
                  Add a book
                </button>
              </fieldset>
            </>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Contact email" hint={draft.contact.emailSource ? `Found on ${draft.contact.emailSource}` : 'Only one they publish themselves.'}>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
            <Field label="WhatsApp / phone" hint={draft.contact.phoneSource ? `Found on ${draft.contact.phoneSource}` : 'International format, e.g. +260 97…'}>
              <input className="input" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
          </div>
          <Field label="Email subject">
            <input className="input" maxLength={120} value={form.invite.subject} onChange={(e) => setForm({ ...form, invite: { ...form.invite, subject: e.target.value } })} />
          </Field>
          <Field label="Email" hint="The claim link and a way to opt out are added below it.">
            <textarea className="input" rows={8} maxLength={3000} value={form.invite.body} onChange={(e) => setForm({ ...form, invite: { ...form.invite, body: e.target.value } })} />
          </Field>
          <Field label="WhatsApp message" hint="The claim link is added at the end.">
            <textarea className="input" rows={3} maxLength={600} value={form.invite.whatsapp} onChange={(e) => setForm({ ...form, invite: { ...form.invite, whatsapp: e.target.value } })} />
          </Field>

          {draft.sources.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">{draft.sources.length} sources</summary>
              <ul className="mt-2 space-y-1">
                {draft.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="break-all">
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {error && <Alert>{error}</Alert>}
      {notice && !error && <Alert tone="success">{notice}</Alert>}
      <div className="flex flex-wrap gap-2">
        {!author && (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void publish.run()}>
              {publish.pending ? 'Publishing…' : 'Publish page'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void save.run()}>
              Save draft
            </button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void remove.run()}>
              Discard
            </button>
          </>
        )}
        {author && editing && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void save.run()}>
            Save invite
          </button>
        )}
        {author && !author.claimed && !draft.optedOutAt && (
          <>
            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !draft.contact.email} onClick={() => void invite.run('email')}>
              {draft.invitedAt ? 'Email again' : 'Email invite'}
            </button>
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy || !draft.contact.phone} onClick={() => void invite.run('whatsapp')}>
              WhatsApp invite
            </button>
          </>
        )}
      </div>
    </li>
  )
}

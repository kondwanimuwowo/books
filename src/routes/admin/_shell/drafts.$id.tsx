import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { ArrowLeftIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { deleteDraft, getDraft, publishDraft, saveDraft, sendInvite } from '#/functions/drafts.functions'
import { PageHeader, useStoreUrl } from '#/components/admin'
import { Alert, Field, useAction } from '#/components/form'
import { PhotoFallback } from '#/components/photo-fallback'
import { Placeholder, RowShapes } from '#/components/placeholder'
import { AUTHOR_LINKS } from '#/data/tiers'
import { formatDate } from '#/lib/utils'

export const Route = createFileRoute('/admin/_shell/drafts/$id')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading draft" shapes={<RowShapes count={6} cover={false} />} />,
  loader: ({ params }) => getDraft({ data: { id: params.id } }),
  component: DraftPage,
})

const toNumber = (v: string) => (v.trim() ? Number(v) : null)

function DraftPage() {
  const { draft, author } = Route.useLoaderData()
  const router = useRouter()
  const navigate = useNavigate()
  const storeUrl = useStoreUrl()
  const [form, setForm] = useState({
    name: draft.name,
    isZambian: draft.isZambian,
    bio: draft.bio,
    links: Object.fromEntries(AUTHOR_LINKS.map((l) => [l.key, draft.links[l.key] ?? ''])) as Record<(typeof AUTHOR_LINKS)[number]['key'], string>,
    books: draft.books.map((b) => ({ ...b, year: b.year?.toString() ?? '' })),
    email: draft.contact.email ?? '',
    phone: draft.contact.phone ?? '',
    invite: draft.invite ?? { subject: '', body: '', whatsapp: '' },
    usePhoto: draft.extras.usePhoto ?? false,
    initiatives: draft.extras.initiatives ?? [],
  })
  const [notice, setNotice] = useState<string | null>(null)
  const payload = () => ({ id: draft.id, ...form, books: form.books.map((b) => ({ ...b, year: toNumber(b.year) })) })
  const save = useAction(async () => {
    await saveDraft({ data: payload() })
    setNotice('Saved')
    await router.invalidate()
  })
  const publish = useAction(async () => {
    await saveDraft({ data: payload() })
    const result = await publishDraft({ data: { id: draft.id } })
    setNotice(`Published. ${result.added} ${result.added === 1 ? 'book' : 'books'} added to the catalogue by ISBN${result.photo ? ', with their photo' : ''}.`)
    await router.invalidate()
  })
  const remove = useAction(async () => {
    await deleteDraft({ data: { id: draft.id } })
    await navigate({ to: '/admin/drafts' })
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
  const setBook = (i: number, patch: Partial<(typeof form.books)[number]>) => setForm({ ...form, books: form.books.map((x, j) => (j === i ? { ...x, ...patch } : x)) })
  const status = author ? (author.claimed ? 'Claimed by the author' : 'Published, not claimed yet') : 'Draft, not public'
  const photo = draft.extras.photo

  return (
    <div className="space-y-6">
      <Link to="/admin/drafts" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowLeftIcon className="size-4" aria-hidden />
        All drafts
      </Link>
      <PageHeader
        title={draft.name}
        description={
          <>
            {status}
            {draft.invitedAt && ` · invited ${formatDate(draft.invitedAt)}`}
            {draft.optedOutAt && ' · asked not to be contacted'}
            {author && (
              <>
                {' · '}
                <a href={storeUrl(`/authors/${author.slug}`)} target="_blank" rel="noreferrer">
                  See the page
                </a>
              </>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="card space-y-5 p-4 sm:p-5">
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
                <textarea className="input" rows={7} maxLength={2000} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} />
              </Field>
              <div className="grid gap-3 sm:grid-cols-3">
                {AUTHOR_LINKS.map((l) => (
                  <Field key={l.key} label={l.label}>
                    <input className="input" value={form.links[l.key]} onChange={setLink(l.key)} />
                  </Field>
                ))}
              </div>
              <fieldset>
                <legend className="field-label">Books ({form.books.length})</legend>
                <p className="mb-2 text-xs text-subtle">Only books with an ISBN that Google or Open Library recognise are added to the catalogue.</p>
                <ul className="divide-y divide-line rounded-lg shadow-[inset_0_0_0_1px_var(--color-line)]">
                  {form.books.map((b, i) => (
                    <li key={i} className="grid gap-2 p-3 text-sm sm:grid-cols-[minmax(0,2fr)_5rem_minmax(0,1fr)_9rem_auto] sm:items-center">
                      <input className="input h-9" aria-label="Title" value={b.title} onChange={(e) => setBook(i, { title: e.target.value })} />
                      <input className="input h-9" aria-label="Year" inputMode="numeric" value={b.year} onChange={(e) => setBook(i, { year: e.target.value })} />
                      <span className="truncate text-subtle">{b.publisher ?? 'Publisher unknown'}</span>
                      <input className="input h-9" aria-label="ISBN" placeholder="ISBN" value={b.isbn ?? ''} onChange={(e) => setBook(i, { isbn: e.target.value || null })} />
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

          {form.initiatives.length > 0 && (
            <fieldset>
              <legend className="field-label">Initiatives</legend>
              <p className="mb-2 text-xs text-subtle">For you: worth a line in the bio or the invite.</p>
              <ul className="space-y-2">
                {form.initiatives.map((item, i) => (
                  <li key={i} className="flex items-start justify-between gap-3 rounded-lg bg-sunken p-3 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium">
                        {item.url ? (
                          <a href={item.url} target="_blank" rel="noreferrer">
                            {item.name}
                          </a>
                        ) : (
                          item.name
                        )}
                      </span>
                      <span className="text-muted">{item.note}</span>
                    </span>
                    <button type="button" className="btn btn-ghost btn-sm shrink-0" onClick={() => setForm({ ...form, initiatives: form.initiatives.filter((_, j) => j !== i) })}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </fieldset>
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
          <Field label="Email" hint="The claim button and a way to opt out are added below it.">
            <textarea className="input" rows={9} maxLength={3000} value={form.invite.body} onChange={(e) => setForm({ ...form, invite: { ...form.invite, body: e.target.value } })} />
          </Field>
          <Field label="WhatsApp message" hint="The claim link is added at the end.">
            <textarea className="input" rows={3} maxLength={600} value={form.invite.whatsapp} onChange={(e) => setForm({ ...form, invite: { ...form.invite, whatsapp: e.target.value } })} />
          </Field>

          {error && <Alert>{error}</Alert>}
          {notice && !error && <Alert tone="success">{notice}</Alert>}
          <div className="flex flex-wrap gap-2">
            {!author && (
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void publish.run()}>
                {publish.pending ? 'Publishing…' : 'Publish page'}
              </button>
            )}
            <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void save.run()}>
              {save.pending ? 'Saving…' : 'Save'}
            </button>
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
            {!author && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => void remove.run()}>
                Discard
              </button>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="card space-y-3 p-4">
            <p className="field-label">Photo</p>
            {author?.photoUrl ? (
              <img src={storeUrl(author.photoUrl)} alt="" className="aspect-[2/3] w-32 rounded-md object-cover" />
            ) : photo ? (
              <>
                <img src={photo.url} alt="" referrerPolicy="no-referrer" className="aspect-[2/3] w-32 rounded-md bg-sunken object-cover" />
                <p className="text-xs break-all text-subtle">
                  From{' '}
                  <a href={photo.source} target="_blank" rel="noreferrer">
                    {photo.source}
                  </a>
                </p>
                {!author && (
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={form.usePhoto} onChange={(e) => setForm({ ...form, usePhoto: e.target.checked })} />
                    Use this photo. It’s on a page they run, and they can replace it when they claim.
                  </label>
                )}
              </>
            ) : (
              <>
                <PhotoFallback kind="person" className="aspect-[2/3] w-32 rounded-md" />
                <p className="text-xs text-subtle">None found on a page they run. They add one when they claim.</p>
              </>
            )}
          </div>
          {draft.sources.length > 0 && (
            <div className="card p-4 text-sm">
              <p className="field-label">{draft.sources.length} sources</p>
              <ul className="space-y-1.5">
                {draft.sources.map((s) => (
                  <li key={s.url}>
                    <a href={s.url} target="_blank" rel="noreferrer" className="break-all">
                      {s.title || s.url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

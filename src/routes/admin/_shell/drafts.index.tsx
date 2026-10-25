import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { createDraft, listDrafts } from '#/functions/drafts.functions'
import { Empty, PageHeader, StatusPill, useStoreUrl } from '#/components/admin'
import { Alert, Field, useAction } from '#/components/form'
import { LoadingLine } from '#/components/loading-line'
import { PhotoFallback } from '#/components/photo-fallback'
import { Placeholder, RowShapes } from '#/components/placeholder'
import { formatDate } from '#/lib/utils'

export const Route = createFileRoute('/admin/_shell/drafts/')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading drafts" shapes={<RowShapes cover={false} />} />,
  loader: () => listDrafts(),
  component: Drafts,
})

type Draft = Awaited<ReturnType<typeof listDrafts>>[number]

function Drafts() {
  const drafts = Route.useLoaderData()
  return (
    <div className="space-y-8">
      <PageHeader
        title="Author drafts"
        description="Research a Zambian author, check every fact against its source, publish their page, then invite them to claim it. Nothing reaches the author until you send it."
      />
      <NewDraft />
      {drafts.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {drafts.map((d) => (
            <DraftTile key={d.id} draft={d} />
          ))}
        </ul>
      ) : (
        <Empty>No drafts yet.</Empty>
      )}
    </div>
  )
}

function NewDraft() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [hints, setHints] = useState('')
  const create = useAction(async () => {
    const draft = await createDraft({ data: { name, hints } })
    await navigate({ to: '/admin/drafts/$id', params: { id: draft.id } })
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
        <Field label="What you know (optional)" hint="Their website, a book title or their town helps the research.">
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

function DraftTile({ draft: d }: { draft: Draft }) {
  const storeUrl = useStoreUrl()
  const state = d.claimed
    ? { label: 'Claimed', tone: 'bg-success-soft text-success' }
    : d.optedOut
      ? { label: 'Opted out', tone: 'bg-sunken text-muted' }
      : d.invitedAt
        ? { label: `Invited ${formatDate(d.invitedAt)}`, tone: 'bg-accent-soft text-accent-soft-ink' }
        : d.published
          ? { label: 'Published', tone: 'bg-sunken text-ink' }
          : { label: 'Draft', tone: 'bg-warning-soft text-warning' }
  return (
    <li>
      <Link to="/admin/drafts/$id" params={{ id: d.id }} className="card lift flex h-full gap-4 p-4 text-ink no-underline hover:text-ink">
        {d.photo ? (
          <img src={d.photo.startsWith('/') ? storeUrl(d.photo) : d.photo} alt="" referrerPolicy="no-referrer" className="aspect-[2/3] w-16 shrink-0 rounded-md object-cover" />
        ) : (
          <PhotoFallback kind="person" className="aspect-[2/3] w-16 rounded-md" />
        )}
        <div className="min-w-0 space-y-1.5">
          <p className="truncate font-medium">{d.name}</p>
          <StatusPill label={state.label} tone={state.tone} />
          <p className="text-xs text-subtle">
            {d.books} {d.books === 1 ? 'book' : 'books'} · {d.hasContact ? 'contact found' : 'no contact'}
          </p>
        </div>
      </Link>
    </li>
  )
}

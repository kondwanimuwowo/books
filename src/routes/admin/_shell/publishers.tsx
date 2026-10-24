import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { listPublishers, mergePublishers, updatePublisher } from '#/functions/admin.functions'
import { AdminSearch, Empty, PageHeader, useStoreUrl } from '#/components/admin'
import { VerifiedMark, ZambianMark } from '#/components/book'
import { Alert, Field, useAction } from '#/components/form'
import { Placeholder, RowShapes } from '#/components/placeholder'

export const Route = createFileRoute('/admin/_shell/publishers')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading publishers" shapes={<RowShapes cover={false} />} />,
  validateSearch: z.object({ q: z.string().optional() }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listPublishers({ data: deps }),
  component: Publishers,
})

type Publisher = Awaited<ReturnType<typeof listPublishers>>[number]

function Publishers() {
  const publishers = Route.useLoaderData()
  const { q } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <div className="space-y-5">
      <PageHeader title="Publishers" description="Fix names, merge duplicates, and link a verified publisher's shop." />
      <AdminSearch value={q ?? ''} placeholder="Search publisher name" onSearch={(value) => void navigate({ search: value ? { q: value } : {} })} />
      {publishers.length ? (
        <ul className="space-y-3">
          {publishers.map((p) => (
            <PublisherRow key={p.id} publisher={p} />
          ))}
        </ul>
      ) : (
        <Empty>{q ? `No publishers match "${q}".` : 'No publishers yet. They are added when books are listed.'}</Empty>
      )}
    </div>
  )
}

type Mode = 'view' | 'edit' | 'merge'

function PublisherRow({ publisher: p }: { publisher: Publisher }) {
  const router = useRouter()
  const storeUrl = useStoreUrl()
  const [mode, setMode] = useState<Mode>('view')
  const [details, setDetails] = useState({ name: p.name, bio: p.bio ?? '', website: p.website ?? '' })
  const [shop, setShop] = useState('')
  const [into, setInto] = useState('')
  const save = useAction(async (changes: Omit<Parameters<typeof updatePublisher>[0]['data'], 'publisherId'>) => {
    await updatePublisher({ data: { publisherId: p.id, ...changes } })
    setShop('')
    setMode('view')
    await router.invalidate()
  })
  const merge = useAction(async () => {
    await mergePublishers({ data: { fromId: p.id, intoSlug: into.trim() } })
    await router.invalidate()
  })

  return (
    <li className="card space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <a href={storeUrl(`/publishers/${p.slug}`)} target="_blank" rel="noreferrer">
            {p.name}
          </a>
          {p.isZambian && <ZambianMark label="Zambian publisher" />}
          {p.verifiedSeller && <VerifiedMark label="Verified publisher" />}
          <span className="text-sm font-normal text-subtle">
            {p.books} {p.books === 1 ? 'book' : 'books'} · {p.slug}
          </span>
        </p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary btn-sm" disabled={save.pending} onClick={() => void save.run({ isZambian: !p.isZambian })}>
            {p.isZambian ? 'Not Zambian' : 'Mark as Zambian'}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode(mode === 'edit' ? 'view' : 'edit')}>
            Edit
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode(mode === 'merge' ? 'view' : 'merge')}>
            Merge
          </button>
        </div>
      </div>

      {mode === 'edit' && (
        <form
          className="grid gap-3 sm:grid-cols-2"
          onSubmit={(e) => {
            e.preventDefault()
            void save.run({ details })
          }}
        >
          <Field label="Name">
            <input className="input" required maxLength={200} value={details.name} onChange={(e) => setDetails({ ...details, name: e.target.value })} />
          </Field>
          <Field label="Website">
            <input className="input" type="url" placeholder="https://" value={details.website} onChange={(e) => setDetails({ ...details, website: e.target.value })} />
          </Field>
          <Field label="About" className="sm:col-span-2">
            <textarea className="input" rows={3} maxLength={4000} value={details.bio} onChange={(e) => setDetails({ ...details, bio: e.target.value })} />
          </Field>
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" className="btn btn-primary btn-sm" disabled={save.pending}>
              {save.pending ? 'Saving…' : 'Save'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('view')}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === 'merge' && (
        <form
          className="space-y-2"
          onSubmit={(e) => {
            e.preventDefault()
            void merge.run()
          }}
        >
          <p className="text-sm text-muted">
            Moves {p.books === 1 ? 'its book' : `all ${p.books} books`} to another publisher and deletes {p.name}. This can’t be undone.
          </p>
          <div className="flex max-w-md gap-2">
            <input className="input h-9" value={into} onChange={(e) => setInto(e.target.value)} placeholder="Keep this one, e.g. penguin-books" aria-label="Publisher to keep" />
            <button type="submit" className="btn btn-primary btn-sm" disabled={merge.pending || !into.trim()}>
              Merge
            </button>
          </div>
          {merge.error && <Alert>{merge.error}</Alert>}
        </form>
      )}

      {p.verifiedSeller ? (
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
          Linked to shop{' '}
          <a href={storeUrl(`/sellers/${p.verifiedSeller.slug}`)} target="_blank" rel="noreferrer" className="font-medium">
            {p.verifiedSeller.storeName}
          </a>
          <button type="button" className="btn btn-ghost btn-sm" disabled={save.pending} onClick={() => void save.run({ verifiedSellerSlug: null })}>
            Unlink
          </button>
        </p>
      ) : (
        <form
          className="flex max-w-md gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void save.run({ verifiedSellerSlug: shop.trim() })
          }}
        >
          <input className="input h-9" value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Publisher's shop address" aria-label="Shop address" />
          <button type="submit" className="btn btn-secondary btn-sm" disabled={save.pending || !shop.trim()}>
            Link shop
          </button>
        </form>
      )}
      {save.error && <Alert>{save.error}</Alert>}
    </li>
  )
}

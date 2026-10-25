import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { deleteBook, listBooks } from '#/functions/admin.functions'
import { AdminSearch, Empty, PageHeader, useStoreUrl } from '#/components/admin'
import { BookCover } from '#/components/book'
import { Alert, useAction } from '#/components/form'
import { Placeholder, RowShapes } from '#/components/placeholder'

export const Route = createFileRoute('/admin/_shell/books')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading books" shapes={<RowShapes />} />,
  validateSearch: z.object({ q: z.string().optional() }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listBooks({ data: deps }),
  component: Books,
})

type Book = Awaited<ReturnType<typeof listBooks>>[number]

function Books() {
  const rows = Route.useLoaderData()
  const { q } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  return (
    <div className="space-y-5">
      <PageHeader title="Books" description="Deleting a book removes its listings, offers and cover. Past orders keep their title and price." />
      <AdminSearch value={q ?? ''} placeholder="Search title, author or ISBN" onSearch={(value) => void navigate({ search: value ? { q: value } : {} })} />
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((b) => (
            <BookRow key={b.id} book={b} />
          ))}
        </ul>
      ) : (
        <Empty>{q ? `No books match "${q}".` : 'No books yet.'}</Empty>
      )}
    </div>
  )
}

function BookRow({ book: b }: { book: Book }) {
  const router = useRouter()
  const storeUrl = useStoreUrl()
  // Two taps: the first only arms the button.
  const [armed, setArmed] = useState(false)
  const remove = useAction(async () => {
    await deleteBook({ data: { bookId: b.id } })
    await router.invalidate()
  })
  return (
    <li className="card flex flex-wrap items-center gap-4 p-4">
      <BookCover src={b.coverUrl ? storeUrl(b.coverUrl) : null} title={b.title} className="w-12 shrink-0" />
      <div className="min-w-0 flex-1 text-sm">
        <a href={storeUrl(`/books/${b.slug}`)} target="_blank" rel="noreferrer" className="line-clamp-1 text-base font-medium">
          {b.title}
        </a>
        <p className="text-subtle">{[b.authors, b.isbn13].filter(Boolean).join(' · ') || 'No author or ISBN'}</p>
        <p className="text-subtle">
          {b.listings} active {b.listings === 1 ? 'listing' : 'listings'} · {b.sold} sold
        </p>
        {remove.error && (
          <div className="mt-2">
            <Alert>{remove.error}</Alert>
          </div>
        )}
      </div>
      {b.busy ? (
        <span className="text-xs text-subtle">Order or offer in progress</span>
      ) : armed ? (
        <div className="flex gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={remove.pending} onClick={() => void remove.run()}>
            {remove.pending ? 'Deleting…' : 'Delete for good'}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setArmed(false)}>
            Keep
          </button>
        </div>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setArmed(true)}>
          Delete
        </button>
      )}
    </li>
  )
}

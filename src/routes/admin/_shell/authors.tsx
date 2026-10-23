import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { listAuthors, updateAuthor } from '#/functions/admin.functions'
import { AdminSearch, Empty, PageHeader, useStoreUrl } from '#/components/admin'
import { VerifiedMark, ZambianMark } from '#/components/book'
import { Alert, useAction } from '#/components/form'
import { Placeholder, RowShapes } from '#/components/placeholder'

export const Route = createFileRoute('/admin/_shell/authors')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading authors" shapes={<RowShapes cover={false} />} />,
  validateSearch: z.object({ q: z.string().optional() }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listAuthors({ data: deps }),
  component: Authors,
})

type Author = Awaited<ReturnType<typeof listAuthors>>[number]

function Authors() {
  const authors = Route.useLoaderData()
  const { q } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <div className="space-y-5">
      <PageHeader title="Authors" description="Check identity before linking a shop." />
      <AdminSearch value={q ?? ''} placeholder="Search author name" onSearch={(value) => void navigate({ search: value ? { q: value } : {} })} />
      {authors.length ? (
        <ul className="space-y-3">
          {authors.map((a) => (
            <AuthorRow key={a.id} author={a} />
          ))}
        </ul>
      ) : (
        <Empty>{q ? `No authors match "${q}".` : 'No authors yet. They are added when books are listed.'}</Empty>
      )}
    </div>
  )
}

function AuthorRow({ author: a }: { author: Author }) {
  const router = useRouter()
  const storeUrl = useStoreUrl()
  const [shop, setShop] = useState('')
  const save = useAction(async (changes: { isZambian?: boolean; verifiedSellerSlug?: string | null }) => {
    await updateAuthor({ data: { authorId: a.id, ...changes } })
    setShop('')
    await router.invalidate()
  })

  return (
    <li className="card space-y-3 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <a href={storeUrl(`/authors/${a.slug}`)} target="_blank" rel="noreferrer">
            {a.name}
          </a>
          {a.isZambian && <ZambianMark />}
          {a.verifiedSeller && <VerifiedMark label="Verified author" />}
          <span className="text-sm font-normal text-subtle">
            {a.books} {a.books === 1 ? 'book' : 'books'}
          </span>
        </p>
        <button type="button" className="btn btn-secondary btn-sm" disabled={save.pending} onClick={() => void save.run({ isZambian: !a.isZambian })}>
          {a.isZambian ? 'Not Zambian' : 'Mark as Zambian'}
        </button>
      </div>

      {a.verifiedSeller ? (
        <p className="flex flex-wrap items-center gap-3 text-sm text-muted">
          Linked to shop{' '}
          <a href={storeUrl(`/sellers/${a.verifiedSeller.slug}`)} target="_blank" rel="noreferrer" className="font-medium">
            {a.verifiedSeller.storeName}
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
          <input className="input h-9" value={shop} onChange={(e) => setShop(e.target.value)} placeholder="Author's shop address, e.g. mwila-books" aria-label="Shop address" />
          <button type="submit" className="btn btn-primary btn-sm" disabled={save.pending || !shop.trim()}>
            Link shop
          </button>
        </form>
      )}
      {save.error && <Alert>{save.error}</Alert>}
    </li>
  )
}

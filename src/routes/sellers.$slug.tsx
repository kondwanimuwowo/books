import { createFileRoute } from '@tanstack/react-router'
import { MapPinIcon } from '@heroicons/react/16/solid'
import { getSeller } from '#/functions/catalog.functions'
import { BookGrid, VerifiedMark } from '#/components/book'
import { SELLER_KINDS } from '#/data/listing-options'
import { formatDate } from '#/lib/utils'
import { CoverGridShapes, EmptyMessage, PageShapes, Placeholder } from '#/components/placeholder'

export const Route = createFileRoute('/sellers/$slug')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading shop" shapes={<PageShapes><CoverGridShapes /></PageShapes>} />,
  loader: ({ params }) => getSeller({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `${loaderData.storeName} | Kuwala Books` }] : [] }),
  component: SellerPage,
})

function SellerPage() {
  const seller = Route.useLoaderData()
  const kind = SELLER_KINDS.find((k) => k.value === seller.kind)?.label
  return (
    <div className="page rise py-10">
      <p className="eyebrow">{kind}</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">{seller.storeName}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        {seller.verified && <VerifiedMark />}
        <span className="inline-flex items-center gap-1">
          <MapPinIcon className="size-3.5" aria-hidden />
          {seller.town}, {seller.province}
        </span>
        <span>Since {formatDate(seller.createdAt)}</span>
      </p>
      {seller.bio && <p className="mt-5 max-w-prose leading-relaxed">{seller.bio}</p>}
      <h2 className="mt-12 mb-6 text-xl">
        {seller.books.length} in stock
      </h2>
      {seller.books.length > 0 ? (
        <BookGrid books={seller.books} />
      ) : (
        <Placeholder mode="empty" label="Books" shapes={<CoverGridShapes count={5} />}>
          <EmptyMessage title="Nothing in stock right now" />
        </Placeholder>
      )}
    </div>
  )
}

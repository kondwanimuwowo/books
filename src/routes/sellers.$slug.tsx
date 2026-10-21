import { createFileRoute } from '@tanstack/react-router'
import { MapPin } from 'lucide-react'
import { getSeller } from '#/functions/catalog.functions'
import { BookGrid, VerifiedMark } from '#/components/book'
import { SELLER_KINDS } from '#/data/listing-options'
import { formatDate } from '#/lib/utils'

export const Route = createFileRoute('/sellers/$slug')({
  loader: ({ params }) => getSeller({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({ meta: loaderData ? [{ title: `${loaderData.storeName} | Kuwala Books` }] : [] }),
  component: SellerPage,
})

function SellerPage() {
  const seller = Route.useLoaderData()
  const kind = SELLER_KINDS.find((k) => k.value === seller.kind)?.label
  return (
    <div className="page py-10">
      <p className="text-sm font-medium text-neutral-600">{kind}</p>
      <h1 className="mt-1 text-3xl">{seller.storeName}</h1>
      <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-neutral-700">
        {seller.verified && <VerifiedMark />}
        <span className="inline-flex items-center gap-1">
          <MapPin size={14} aria-hidden />
          {seller.town}, {seller.province}
        </span>
        <span>Selling since {formatDate(seller.createdAt)}</span>
      </p>
      {seller.bio && <p className="mt-5 max-w-2xl leading-relaxed text-neutral-800">{seller.bio}</p>}
      <h2 className="mt-10 mb-5 text-xl">In stock ({seller.books.length})</h2>
      {seller.books.length ? <BookGrid books={seller.books} /> : <p className="text-neutral-700">Nothing listed right now.</p>}
    </div>
  )
}

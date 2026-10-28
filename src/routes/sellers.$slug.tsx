import { createFileRoute } from '@tanstack/react-router'
import { CalendarIcon, MapPinIcon } from '@heroicons/react/16/solid'
import { getSeller } from '#/functions/catalog.functions'
import { BookGrid, VerifiedMark } from '#/components/book'
import { ShareOnWhatsApp } from '#/components/share'
import { SHARE_COPY } from '#/data/share'
import { SELLER_KINDS } from '#/data/listing-options'
import { cn, formatDate } from '#/lib/utils'
import { ogMeta } from '#/lib/og'
import { shopFallback } from '#/data/brand'
import { CoverGridShapes, EmptyMessage, PageShapes, Placeholder } from '#/components/placeholder'
import { PhotoFallback } from '#/components/photo-fallback'
import { RatingMark } from '#/components/reputation'
import { OFFICIAL_LABEL } from '#/data/onboarding'

export const Route = createFileRoute('/sellers/$slug')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading shop" shapes={<PageShapes><CoverGridShapes /></PageShapes>} />,
  loader: ({ params }) => getSeller({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.storeName} | Kuwala Books` },
          ...ogMeta({
            title: loaderData.storeName,
            description: loaderData.bio?.slice(0, 160) ?? SHARE_COPY.shop({ storeName: loaderData.storeName, inStock: loaderData.books.length }),
            path: `/sellers/${loaderData.slug}`,
            // Shops without a logo share their book photo; people without a photo fall back to the kb mark.
            image: loaderData.photoUrl ?? (loaderData.kind === 'bookshop' || loaderData.kind === 'publisher' ? shopFallback(loaderData.slug, 'share') : null),
          }),
        ]
      : [],
  }),
  component: SellerPage,
})

function SellerPage() {
  const seller = Route.useLoaderData()
  const kind = SELLER_KINDS.find((k) => k.value === seller.kind)?.label
  return (
    <div className="page rise py-10">
      <div className="flex items-end gap-5">
        <SellerPhoto src={seller.photoUrl} portrait={seller.kind === 'author'} person={seller.kind === 'author' || seller.kind === 'individual'} seed={seller.slug} />
        <div className="min-w-0">
          <p className="eyebrow">{kind}</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">{seller.storeName}</h1>
        </div>
      </div>
      <p className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
        {seller.official ? <VerifiedMark label={OFFICIAL_LABEL} /> : seller.verified && <VerifiedMark />}
        <RatingMark rating={seller.rating} />
        <span className="inline-flex items-center gap-1">
          <MapPinIcon className="size-3.5" aria-hidden />
          {seller.town}, {seller.province}
        </span>
        <span className="inline-flex items-center gap-1">
          <CalendarIcon className="size-3.5" aria-hidden />
          Since {formatDate(seller.createdAt)}
        </span>
      </p>
      {seller.bio && <p className="mt-5 max-w-prose leading-relaxed">{seller.bio}</p>}
      <ShareOnWhatsApp className="mt-5" path={`/sellers/${seller.slug}`} text={SHARE_COPY.shop({ storeName: seller.storeName, inStock: seller.books.length })} />
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

function SellerPhoto({ src, portrait, person, seed }: { src: string | null; portrait: boolean; person: boolean; seed: string }) {
  const shape = portrait ? 'aspect-[2/3] w-20 rounded-md sm:w-24' : 'aspect-square w-20 rounded-xl sm:w-24'
  return src ? (
    <img src={src} alt="" className={cn('shrink-0 object-cover shadow-md', shape)} />
  ) : (
    <PhotoFallback kind={person ? 'person' : 'shop'} seed={seed} className={cn('shadow-md', shape)} />
  )
}

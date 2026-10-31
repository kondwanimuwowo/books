import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowTopRightOnSquareIcon, MapPinIcon } from '@heroicons/react/16/solid'
import { getPublisher } from '#/functions/catalog.functions'
import { BookGrid, VerifiedMark, ZambianMark } from '#/components/book'
import { CoverGridShapes, EmptyMessage, PageShapes, Placeholder } from '#/components/placeholder'
import { PhotoFallback } from '#/components/photo-fallback'
import { FollowButton } from '#/components/saved'

export const Route = createFileRoute('/publishers/$slug')({
  pendingComponent: () => (
    <Placeholder
      mode="loading"
      label="Loading publisher"
      shapes={
        <PageShapes>
          <CoverGridShapes />
        </PageShapes>
      }
    />
  ),
  loader: ({ params }) => getPublisher({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [{ title: `${loaderData.name} | Kuwala Books` }, { name: 'description', content: loaderData.bio?.slice(0, 160) ?? `Books published by ${loaderData.name}` }]
      : [],
  }),
  component: PublisherPage,
})

function PublisherPage() {
  const publisher = Route.useLoaderData()
  const inStock = publisher.books.filter((b) => b.offerCount > 0).length
  const facts = [`${publisher.books.length} ${publisher.books.length === 1 ? 'book' : 'books'}`, publisher.years, inStock ? `${inStock} for sale` : null].filter(Boolean)

  return (
    <div className="page py-10">
      <div className="rise flex flex-col gap-6 sm:flex-row sm:items-end">
        <PhotoFallback kind="shop" seed={publisher.slug} className="aspect-square w-24 rounded-md shadow-md sm:w-28" />
        <div className="min-w-0">
          <p className="eyebrow">Publisher</p>
          <h1 className="mt-1 text-4xl sm:text-5xl">{publisher.name}</h1>
          <p className="mt-2 text-sm text-muted">{facts.join(' · ')}</p>
          {(publisher.isZambian || publisher.shop || publisher.website) && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {publisher.isZambian && <ZambianMark label="Zambian publisher" />}
              {publisher.shop && <VerifiedMark label="Verified publisher" />}
              {publisher.website && (
                <a href={publisher.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink">
                  Website <ArrowTopRightOnSquareIcon className="size-3.5" aria-hidden />
                </a>
              )}
            </div>
          )}
          <div className="mt-4">
            <FollowButton kind="publisher" slug={publisher.slug} name={publisher.name} />
          </div>
        </div>
      </div>

      {publisher.bio && <p className="mt-8 max-w-prose leading-relaxed whitespace-pre-line">{publisher.bio}</p>}

      {publisher.shop && (
        <div className="card mt-8 flex max-w-xl flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="font-medium">Buy direct from {publisher.name}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-subtle">
              <MapPinIcon className="size-3.5" aria-hidden />
              {publisher.shop.storeName}, {publisher.shop.town}
            </p>
          </div>
          <Link to="/sellers/$slug" params={{ slug: publisher.shop.slug }} className="btn btn-primary btn-sm">
            Visit shop
          </Link>
        </div>
      )}

      <h2 className="mt-12 mb-6 text-xl">Books</h2>
      {publisher.books.length ? (
        <BookGrid books={publisher.books} />
      ) : (
        <Placeholder mode="empty" label="Books" shapes={<CoverGridShapes count={5} />}>
          <EmptyMessage title="None on Kuwala yet" />
        </Placeholder>
      )}
    </div>
  )
}

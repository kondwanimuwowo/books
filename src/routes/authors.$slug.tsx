import { Link, createFileRoute } from '@tanstack/react-router'
import { MapPinIcon } from '@heroicons/react/16/solid'
import { getAuthor } from '#/functions/catalog.functions'
import { ogMeta } from '#/lib/og'
import { Plaque, PlaqueMark } from '#/components/plaque'
import { ShareOnWhatsApp } from '#/components/share'
import { SHARE_COPY } from '#/data/share'
import { AUTHOR_LINKS, PLAQUE_COPY, topTier } from '#/data/tiers'
import { CLAIM_COPY } from '#/data/claims'
import { BookGrid, Shelf, VerifiedMark, ZambianMark } from '#/components/book'
import { CoverGridShapes, EmptyMessage, PageShapes, Placeholder } from '#/components/placeholder'
import { PhotoFallback } from '#/components/photo-fallback'

export const Route = createFileRoute('/authors/$slug')({
  pendingComponent: () => (
    <Placeholder
      mode="loading"
      label="Loading author"
      shapes={
        <PageShapes>
          <CoverGridShapes />
        </PageShapes>
      }
    />
  ),
  loader: ({ params }) => getAuthor({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.name} | Kuwala Books` },
          { name: 'description', content: loaderData.bio?.slice(0, 160) ?? `Books by ${loaderData.name}` },
          ...ogMeta({ title: loaderData.name, description: loaderData.bio?.slice(0, 160) ?? `Books by ${loaderData.name} on Kuwala Books`, path: `/authors/${loaderData.slug}`, image: loaderData.photoUrl }),
        ]
      : [],
  }),
  component: AuthorPage,
})

function AuthorPage() {
  const author = Route.useLoaderData()
  const inStock = author.books.filter((b) => b.offerCount > 0).length
  const facts = [
    `${author.books.length} ${author.books.length === 1 ? 'book' : 'books'}`,
    author.readers ? `${author.readers.toLocaleString('en')} readers` : null,
    author.years,
    inStock ? `${inStock} for sale` : null,
  ].filter(Boolean)
  const top = topTier(author.milestones.map((m) => m.tier))
  const links = AUTHOR_LINKS.filter((l) => author.links[l.key])

  return (
    <div className="page py-10">
      <div className="rise flex flex-col gap-6 sm:flex-row sm:items-end">
        {/* Portrait-shaped like a cover, not a round avatar: authors here are known by their books. */}
        {author.photoUrl ? (
          <img src={author.photoUrl} alt="" className="aspect-[2/3] w-28 rounded-md object-cover shadow-md sm:w-36" />
        ) : (
          <PhotoFallback kind="person" className="aspect-[2/3] w-28 rounded-md shadow-md sm:w-36" />
        )}
        <div className="min-w-0">
          <h1 className="text-4xl sm:text-5xl">{author.name}</h1>
          <p className="mt-2 text-sm text-muted">{facts.join(' · ')}</p>
          {(author.isZambian || author.shop) && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {author.isZambian && <ZambianMark />}
              {author.shop && <VerifiedMark label="Verified author" />}
              {top && <PlaqueMark tier={top.tier} />}
            </div>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            <ShareOnWhatsApp path={`/authors/${author.slug}`} text={SHARE_COPY.author({ name: author.name, books: author.books.length })} />
            {links.map((l) => (
              <a key={l.key} href={author.links[l.key]} target="_blank" rel="noopener noreferrer nofollow" className="text-sm">
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </div>

      {author.bio && <p className="mt-8 max-w-prose leading-relaxed whitespace-pre-line">{author.bio}</p>}
      {author.sources && (
        <details className="mt-3 max-w-prose text-xs text-subtle">
          <summary className="cursor-pointer">{CLAIM_COPY.unclaimedLabel}</summary>
          <ul className="mt-2 space-y-1">
            {author.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer nofollow" className="break-all">
                  {s.title || s.url}
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      {author.milestones.length > 0 && (
        <section aria-labelledby="plaques" className="mt-10">
          <h2 id="plaques" className="mb-4 text-xl">
            Plaques
          </h2>
          <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
            {[...author.milestones].reverse().map((m) => (
              <Plaque key={m.tier} tier={m.tier} reachedAt={m.reachedAt} />
            ))}
          </div>
        </section>
      )}

      {/* Zambian authors only: they're who Kuwala is for, and it keeps claims on famous names out of the queue. */}
      {!author.shop && author.isZambian && (
        <div className="card mt-8 flex max-w-xl flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="font-medium">{PLAQUE_COPY.claim(author.name)}</p>
            <p className="mt-0.5 text-sm text-subtle">{PLAQUE_COPY.claimLine}</p>
          </div>
          <Link to="/start-selling" search={{ step: 'verify', author: author.id }} className="btn btn-secondary btn-sm">
            Claim this page
          </Link>
        </div>
      )}

      {author.shop && (
        <div className="card mt-8 flex max-w-xl flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
          <div className="min-w-0">
            <p className="font-medium">Buy direct from {author.name.split(' ')[0]}</p>
            <p className="mt-0.5 inline-flex items-center gap-1 text-sm text-subtle">
              <MapPinIcon className="size-3.5" aria-hidden />
              {author.shop.storeName}, {author.shop.town}
            </p>
          </div>
          <Link to="/sellers/$slug" params={{ slug: author.shop.slug }} className="btn btn-primary btn-sm">
            Visit shop
          </Link>
        </div>
      )}

      {author.direct.length > 0 && <Shelf title="From the author" books={author.direct} />}

      <h2 className="mt-12 mb-6 text-xl">All books</h2>
      {author.books.length ? (
        <BookGrid books={author.books} />
      ) : (
        <Placeholder mode="empty" label="Books" shapes={<CoverGridShapes count={5} />}>
          <EmptyMessage title="None for sale right now" />
        </Placeholder>
      )}
    </div>
  )
}

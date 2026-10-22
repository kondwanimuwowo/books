import { Link, createFileRoute } from '@tanstack/react-router'
import { Check, MapPin, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { getBook } from '#/functions/catalog.functions'
import { BookCover, Shelf, VerifiedMark, ZambianMark } from '#/components/book'
import { Price, useBag } from '#/components/providers'
import { conditionLabel, formatLabel } from '#/data/listing-options'
import { languageName } from '#/data/zambia'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/books/$slug')({
  loader: ({ params }) => getBook({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} | Kuwala Books` },
          { name: 'description', content: loaderData.description?.slice(0, 160) ?? `Buy ${loaderData.title} in Zambia` },
          { property: 'og:image', content: loaderData.coverUrl ?? '' },
        ]
      : [],
  }),
  component: BookPage,
})

type Filter = 'all' | 'new' | 'used'

function BookPage() {
  const book = Route.useLoaderData()
  const [filter, setFilter] = useState<Filter>('all')
  const [expanded, setExpanded] = useState(false)
  const offers = book.offers.filter((o) => filter === 'all' || (filter === 'new' ? o.condition === 'new' : o.condition !== 'new'))
  const hasNew = book.offers.some((o) => o.condition === 'new')
  const hasUsed = book.offers.some((o) => o.condition !== 'new')

  const specs = [
    ['ISBN', book.isbn13],
    ['Publisher', book.publisher],
    ['Published', book.publishedYear],
    ['Pages', book.pageCount],
    ['Language', languageName(book.language)],
  ].filter(([, v]) => v)

  return (
    <div className="page py-6 sm:py-10">
      <nav className="mb-6 text-sm text-neutral-600">
        <Link to="/">Home</Link>
        {book.category && (
          <>
            {' / '}
            <Link to="/search" search={{ category: book.category.slug }}>
              {book.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr_360px]">
        <BookCover src={book.coverUrl} title={book.title} className="mx-auto w-48 shadow-lg md:w-full" />

        <div className="min-w-0">
          <h1 className="text-3xl leading-tight">{book.title}</h1>
          {book.subtitle && <p className="mt-1 text-lg text-neutral-700">{book.subtitle}</p>}
          <p className="mt-2 text-neutral-800">
            {book.authors.length ? 'by ' : ''}
            {book.authors.map((a, i) => (
              <span key={a.id}>
                {i > 0 && ', '}
                <Link to="/authors/$slug" params={{ slug: a.slug }} className="font-medium">
                  {a.name}
                </Link>
              </span>
            ))}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            {book.isZambian && <ZambianMark />}
            {book.authors.some((a) => a.verified) && <VerifiedMark label="Verified author on Kuwala" />}
          </div>

          {book.description && (
            <div className="mt-6">
              <p className={cn('leading-relaxed whitespace-pre-line text-neutral-800', !expanded && 'line-clamp-6')}>{book.description}</p>
              {book.description.length > 400 && (
                <button type="button" onClick={() => setExpanded(!expanded)} className="mt-2 text-sm font-medium text-accent-700">
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              )}
            </div>
          )}

          {specs.length > 0 && (
            <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-neutral-200 pt-6 text-sm sm:grid-cols-3">
              {specs.map(([k, v]) => (
                <div key={String(k)}>
                  <dt className="text-neutral-600">{k}</dt>
                  <dd className="font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        <aside className="md:col-span-2 lg:sticky lg:top-28 lg:col-span-1 lg:self-start">
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg">Choose a copy</h2>
              {hasNew && hasUsed && (
                <div className="flex gap-1">
                  {(['all', 'new', 'used'] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFilter(f)}
                      aria-pressed={filter === f}
                      className={cn('pill h-8 px-3 capitalize', filter === f ? 'bg-accent-700 text-white' : 'bg-neutral-100 hover:bg-neutral-200')}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {book.offers.length === 0 ? (
              <div className="py-6 text-center">
                <p className="text-neutral-700">Nobody is selling this book right now.</p>
                <Link to="/sell" className="btn btn-secondary btn-sm mt-4">
                  Sell your copy
                </Link>
              </div>
            ) : (
              <ul className="mt-3 divide-y divide-neutral-200">
                {offers.map((o) => (
                  <OfferRow key={o.id} offer={o} />
                ))}
              </ul>
            )}

            <p className="mt-4 flex gap-2 rounded-lg bg-neutral-100 p-3 text-xs leading-relaxed text-neutral-700">
              <ShieldCheck size={16} className="mt-px shrink-0 text-accent-700" aria-hidden />
              Your payment is held by Kuwala and only released to the seller once you confirm the book has arrived.
            </p>
          </div>
        </aside>
      </div>

      <Shelf title={`More in ${book.category?.name ?? 'this section'}`} books={book.related} />
    </div>
  )
}

type Offer = Awaited<ReturnType<typeof getBook>>['offers'][number]

function OfferRow({ offer }: { offer: Offer }) {
  const { add } = useBag()
  const [added, setAdded] = useState(false)

  return (
    <li className="py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Price ngwee={offer.priceNgwee} className="text-xl font-semibold" />
          <p className="mt-0.5 text-sm">
            <span className="font-medium">{conditionLabel(offer.condition)}</span>
            <span className="text-neutral-600"> · {formatLabel(offer.format)}</span>
          </p>
        </div>
        <button
          type="button"
          className={cn('btn btn-sm shrink-0', added ? 'btn-secondary' : 'btn-primary')}
          onClick={() => {
            add(offer.id)
            setAdded(true)
          }}
        >
          {added ? (
            <>
              <Check size={14} aria-hidden /> In bag
            </>
          ) : (
            'Add to bag'
          )}
        </button>
      </div>
      {offer.notes && <p className="mt-2 text-sm text-neutral-700">{offer.notes}</p>}
      <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-neutral-700">
        <Link to="/sellers/$slug" params={{ slug: offer.seller.slug }} className="font-medium">
          {offer.seller.storeName}
        </Link>
        {offer.seller.verified && <VerifiedMark />}
        <span className="inline-flex items-center gap-1 text-neutral-600">
          <MapPin size={13} aria-hidden />
          {offer.seller.town}
        </span>
        {offer.quantity > 1 && offer.quantity <= 5 && <span className="text-neutral-600">· {offer.quantity} left</span>}
      </p>
    </li>
  )
}

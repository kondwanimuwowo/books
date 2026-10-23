import { Link, createFileRoute } from '@tanstack/react-router'
import { MinusIcon, PlusIcon, TrashIcon } from '@heroicons/react/16/solid'
import { BookCover } from '#/components/book'
import { Alert } from '#/components/form'
import { Price, useBag } from '#/components/providers'
import { useBagQuote } from '#/components/use-bag-quote'
import { conditionLabel } from '#/data/listing-options'

export const Route = createFileRoute('/bag')({
  head: () => ({ meta: [{ title: 'Your bag | Kuwala Books' }] }),
  component: BagPage,
})

type Quote = NonNullable<ReturnType<typeof useBagQuote>>
type Group = Quote['groups'][number]

function BagPage() {
  const quote = useBagQuote(null)

  if (!quote) return <BagSkeleton />

  if (!quote.groups.length) {
    return (
      <div className="page rise py-24 text-center">
        <h1 className="text-3xl">Your bag is empty</h1>
        <Link to="/search" className="btn btn-primary mt-8">
          Find a book
        </Link>
      </div>
    )
  }

  const subtotal = quote.groups.reduce((n, g) => n + g.subtotalNgwee, 0)

  return (
    <div className="page grid gap-8 py-8 pb-28 lg:grid-cols-[1fr_340px] lg:gap-10 lg:pb-8">
      <div className="min-w-0">
        <h1 className="text-3xl sm:text-4xl">Your bag</h1>
        {quote.problems.length > 0 && (
          <div className="mt-4">
            <Alert>{quote.problems.join('. ')}.</Alert>
          </div>
        )}
        <div className="mt-6 space-y-5">
          {quote.groups.map((g, i) => (
            <Parcel key={g.seller.id} group={g} index={i} total={quote.groups.length} />
          ))}
        </div>
      </div>

      <aside className="hidden lg:block lg:pt-16">
        <div className="card sticky top-28 p-5">
          <div className="flex items-baseline justify-between">
            <span className="text-muted">Books</span>
            <Price ngwee={subtotal} className="text-xl font-extrabold tracking-[-0.02em] tabular-nums" />
          </div>
          <p className="mt-1 text-sm text-subtle">Delivery added at checkout.</p>
          <Link to="/checkout" className="btn btn-primary mt-5 w-full">
            Checkout
          </Link>
        </div>
      </aside>

      <div className="glass-bar fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="page flex items-center justify-between gap-4 py-3">
          <div>
            <Price ngwee={subtotal} className="text-lg font-extrabold tracking-[-0.02em] tabular-nums" />
            <p className="text-xs text-subtle">Plus delivery</p>
          </div>
          <Link to="/checkout" className="btn btn-primary">
            Checkout
          </Link>
        </div>
      </div>
    </div>
  )
}

// Each seller ships on their own, so the bag is shown as the parcels that will actually arrive.
function Parcel({ group: g, index, total }: { group: Group; index: number; total: number }) {
  const { setQuantity, remove } = useBag()
  return (
    <section className="card overflow-hidden" aria-label={`Parcel from ${g.seller.storeName}`}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-3">
        <p className="text-sm">
          {total > 1 && <span className="eyebrow mr-2">{`Parcel ${index + 1} of ${total}`}</span>}
          <span className="font-medium">{g.seller.storeName}</span>
        </p>
        <p className="text-xs text-subtle">From {g.seller.town}</p>
      </header>
      <ul className="divide-y divide-line">
        {g.items.map((item) => (
          <li key={item.listingId} className="flex gap-4 p-4">
            <Link to="/books/$slug" params={{ slug: item.book.slug }} className="w-16 shrink-0" tabIndex={-1}>
              <BookCover src={item.book.coverUrl} title={item.book.title} />
            </Link>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-3">
                <Link to="/books/$slug" params={{ slug: item.book.slug }} className="line-clamp-2 font-medium text-ink">
                  {item.book.title}
                </Link>
                <Price ngwee={item.priceNgwee * item.quantity} className="shrink-0 font-medium tabular-nums" />
              </div>
              <p className="text-sm text-subtle">{conditionLabel(item.condition)}</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="inline-flex items-center rounded-full bg-sunken">
                  <button
                    type="button"
                    aria-label={`One less ${item.book.title}`}
                    className="flex size-9 items-center justify-center rounded-full hover:bg-sunken-strong"
                    onClick={() => setQuantity(item.listingId, item.quantity - 1)}
                  >
                    <MinusIcon className="size-3.5" aria-hidden />
                  </button>
                  <span className="w-6 text-center text-sm tabular-nums" aria-live="polite">
                    {item.quantity}
                  </span>
                  <button
                    type="button"
                    aria-label={`One more ${item.book.title}`}
                    disabled={item.quantity >= item.available}
                    className="flex size-9 items-center justify-center rounded-full hover:bg-sunken-strong disabled:opacity-40"
                    onClick={() => setQuantity(item.listingId, item.quantity + 1)}
                  >
                    <PlusIcon className="size-3.5" aria-hidden />
                  </button>
                </div>
                <button
                  type="button"
                  aria-label={`Remove ${item.book.title}`}
                  className="flex size-9 items-center justify-center rounded-full text-subtle hover:bg-sunken hover:text-danger"
                  onClick={() => remove(item.listingId)}
                >
                  <TrashIcon className="size-4" aria-hidden />
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  )
}

function BagSkeleton() {
  return (
    <div className="page py-8" aria-busy="true" aria-label="Loading your bag">
      <div className="h-9 w-40 animate-pulse rounded-md bg-sunken motion-reduce:animate-none" />
      <div className="mt-6 space-y-5">
        {[0, 1].map((i) => (
          <div key={i} className="card flex gap-4 p-4">
            <div className="aspect-[2/3] w-16 animate-pulse rounded-md bg-sunken motion-reduce:animate-none" />
            <div className="flex-1 space-y-2 pt-1">
              <div className="h-4 w-2/3 animate-pulse rounded bg-sunken motion-reduce:animate-none" />
              <div className="h-3 w-1/4 animate-pulse rounded bg-sunken motion-reduce:animate-none" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

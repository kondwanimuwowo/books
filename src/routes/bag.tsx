import { Link, createFileRoute } from '@tanstack/react-router'
import { Minus, Plus, Trash2 } from 'lucide-react'
import { BookCover } from '#/components/book'
import { Alert } from '#/components/form'
import { Price, useBag } from '#/components/providers'
import { useBagQuote } from '#/components/use-bag-quote'
import { conditionLabel } from '#/data/listing-options'

export const Route = createFileRoute('/bag')({
  head: () => ({ meta: [{ title: 'Your bag | Kuwala Books' }] }),
  component: BagPage,
})

function BagPage() {
  const { setQuantity, remove } = useBag()
  const quote = useBagQuote(null)

  if (!quote) return <div className="page py-16 text-neutral-600">Loading your bag&hellip;</div>

  if (!quote.groups.length) {
    return (
      <div className="page py-24 text-center">
        <h1 className="text-2xl">Your bag is empty</h1>
        <p className="mt-2 text-neutral-700">Find something good to read.</p>
        <Link to="/search" className="btn btn-primary mt-6">
          Browse books
        </Link>
      </div>
    )
  }

  const subtotal = quote.groups.reduce((n, g) => n + g.subtotalNgwee, 0)
  const sellerCount = quote.groups.length

  return (
    <div className="page grid gap-8 py-8 lg:grid-cols-[1fr_340px]">
      <div>
        <h1 className="text-3xl">Your bag</h1>
        {quote.problems.length > 0 && (
          <div className="mt-4">
            <Alert>{quote.problems.join('. ')}.</Alert>
          </div>
        )}
        <div className="mt-6 space-y-6">
          {quote.groups.map((g) => (
            <section key={g.seller.id} className="card overflow-hidden">
              <header className="border-b border-neutral-200 bg-neutral-50 px-4 py-3 text-sm">
                Sold by <span className="font-semibold">{g.seller.storeName}</span>
                <span className="text-neutral-600"> · ships from {g.seller.town}</span>
              </header>
              <ul className="divide-y divide-neutral-200">
                {g.items.map((item) => (
                  <li key={item.listingId} className="flex gap-4 p-4">
                    <Link to="/books/$slug" params={{ slug: item.book.slug }} className="w-16 shrink-0">
                      <BookCover src={item.book.coverUrl} title={item.book.title} />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <Link to="/books/$slug" params={{ slug: item.book.slug }} className="line-clamp-2 font-semibold text-ink">
                        {item.book.title}
                      </Link>
                      <p className="text-sm text-neutral-700">{conditionLabel(item.condition)}</p>
                      <div className="mt-3 flex items-center gap-3">
                        <div className="inline-flex items-center rounded-full bg-neutral-100">
                          <button type="button" aria-label="One less" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-200" onClick={() => setQuantity(item.listingId, item.quantity - 1)}>
                            <Minus size={14} />
                          </button>
                          <span className="w-6 text-center text-sm tabular-nums">{item.quantity}</span>
                          <button
                            type="button"
                            aria-label="One more"
                            disabled={item.quantity >= item.available}
                            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-neutral-200 disabled:opacity-40"
                            onClick={() => setQuantity(item.listingId, item.quantity + 1)}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                        <button type="button" aria-label="Remove" className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-600 hover:bg-neutral-100" onClick={() => remove(item.listingId)}>
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                    <Price ngwee={item.priceNgwee * item.quantity} className="font-semibold tabular-nums" />
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>

      <aside className="lg:pt-14">
        <div className="card sticky top-28 p-5">
          <div className="flex justify-between">
            <span>Items</span>
            <Price ngwee={subtotal} className="font-semibold tabular-nums" />
          </div>
          <p className="mt-2 text-sm text-neutral-700">Delivery is worked out for your town at checkout.</p>
          {sellerCount > 1 && <p className="mt-2 text-sm text-neutral-700">Your books come from {sellerCount} sellers, so they may arrive separately.</p>}
          <Link to="/checkout" className="btn btn-primary mt-5 w-full">
            Checkout
          </Link>
        </div>
      </aside>
    </div>
  )
}

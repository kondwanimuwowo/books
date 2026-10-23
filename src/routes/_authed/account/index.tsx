import { Link, createFileRoute } from '@tanstack/react-router'
import { getMyOrders } from '#/functions/orders.functions'
import { BookCover } from '#/components/book'
import { Price } from '#/components/providers'
import { cn, formatDate } from '#/lib/utils'

export const Route = createFileRoute('/_authed/account/')({
  loader: () => getMyOrders(),
  component: Orders,
})

type Order = Awaited<ReturnType<typeof getMyOrders>>[number]

const STATUS: Record<Order['status'], { label: string; tone: string }> = {
  pending_payment: { label: 'Not paid', tone: 'bg-warning-soft text-warning' },
  paid: { label: 'On the way', tone: 'bg-accent-soft text-accent-soft-ink' },
  completed: { label: 'Delivered', tone: 'bg-success-soft text-success' },
  cancelled: { label: 'Cancelled', tone: 'bg-sunken text-muted' },
}

function Orders() {
  const orders = Route.useLoaderData()
  if (!orders.length) {
    return (
      <div className="rise py-12 text-center lg:text-left">
        <p className="text-xl font-medium">No orders yet</p>
        <Link to="/search" className="btn btn-primary mt-6">
          Find a book
        </Link>
      </div>
    )
  }
  return (
    <ul className="space-y-3">
      {orders.map((o) => (
        <li key={o.number}>
          <Link to="/orders/$number" params={{ number: o.number }} className="card lift flex items-center gap-5 p-4 text-ink no-underline hover:text-ink">
            <CoverStack books={o.books} />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 font-medium">
                {o.books[0]?.title ?? o.number}
                {o.itemCount > 1 && <span className="font-normal text-subtle">{` + ${o.itemCount - 1} more`}</span>}
              </p>
              <p className="mt-0.5 text-sm text-subtle">
                {formatDate(o.createdAt)} · <span className="tabular-nums">{o.number}</span>
              </p>
            </div>
            <div className="flex shrink-0 flex-col items-end gap-1.5">
              <Price ngwee={o.totalNgwee} className="font-medium tabular-nums" />
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS[o.status].tone)}>{STATUS[o.status].label}</span>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

/** The order's books fanned like a small stack on a table. */
function CoverStack({ books }: { books: Order['books'] }) {
  const tilt = ['-rotate-6', 'rotate-3', '-rotate-1']
  return (
    <div aria-hidden className="relative h-16 w-14 shrink-0">
      {books
        .slice(0, 3)
        .reverse()
        .map((b, i, all) => (
          <div key={i} className={cn('absolute bottom-0 left-1 w-11', tilt[all.length - 1 - i])}>
            <BookCover src={b.coverUrl} title={b.title} className="shadow-sm" />
          </div>
        ))}
    </div>
  )
}

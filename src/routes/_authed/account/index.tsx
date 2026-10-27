import { Link, createFileRoute } from '@tanstack/react-router'
import { getMyOrders } from '#/functions/orders.functions'
import { getMyStanding } from '#/functions/ratings.functions'
import { RatingMark } from '#/components/reputation'
import { READER_BADGES, REPUTATION_COPY } from '#/data/reputation'
import { CheckBadgeIcon } from '@heroicons/react/16/solid'
import { BookCover } from '#/components/book'
import { Price } from '#/components/providers'
import { cn, formatDate } from '#/lib/utils'
import { EmptyMessage, Placeholder, RowShapes } from '#/components/placeholder'

export const Route = createFileRoute('/_authed/account/')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading orders" shapes={<RowShapes />} />,
  loader: async () => {
    const [orders, standing] = await Promise.all([getMyOrders(), getMyStanding()])
    return { orders, standing }
  },
  component: Orders,
})

type Order = Awaited<ReturnType<typeof getMyOrders>>[number]
type Standing = NonNullable<Awaited<ReturnType<typeof getMyStanding>>>

const STATUS: Record<Order['status'], { label: string; tone: string }> = {
  pending_payment: { label: 'Not paid', tone: 'bg-warning-soft text-warning' },
  paid: { label: 'On the way', tone: 'bg-accent-soft text-accent-soft-ink' },
  completed: { label: 'Delivered', tone: 'bg-success-soft text-success' },
  cancelled: { label: 'Cancelled', tone: 'bg-sunken text-muted' },
}

function Orders() {
  const { orders, standing } = Route.useLoaderData()
  if (!orders.length) {
    return (
      <Placeholder mode="empty" label="Orders" shapes={<RowShapes />}>
        <EmptyMessage
          title="No orders yet"
          action={
            <Link to="/search" className="btn btn-primary">
              Find a book
            </Link>
          }
        />
      </Placeholder>
    )
  }
  return (
    <>
      {standing && standing.books > 0 && <MyStanding standing={standing} />}
      <ul className="space-y-3">
        {orders.map((o) => (
          <li key={o.number}>
            <Link to="/orders/$number" params={{ number: o.number }} className="card lift flex items-center gap-3.5 p-4 text-ink no-underline hover:text-ink sm:gap-5">
              <CoverStack books={o.books} />
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 font-bold tracking-[-0.01em] sm:line-clamp-1">
                  {o.books[0]?.title ?? o.number}
                  {o.itemCount > 1 && <span className="font-normal text-subtle">{` + ${o.itemCount - 1} more`}</span>}
                </p>
                <p className="mt-0.5 text-sm text-subtle">
                  <span className="whitespace-nowrap">{formatDate(o.createdAt)}</span> · <span className="whitespace-nowrap tabular-nums">{o.number}</span>
                </p>
                {/* Phones: the status sits under the details so the title keeps the width. */}
                <OrderStatus status={o.status} className="mt-2 sm:hidden" />
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <Price ngwee={o.totalNgwee} className="font-medium tabular-nums" />
                <OrderStatus status={o.status} className="hidden sm:inline-flex" />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  )
}

function OrderStatus({ status, className }: { status: Order['status']; className?: string }) {
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS[status].tone, className)}>{STATUS[status].label}</span>
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

/** The reader's own standing: shown only here, never to anyone else as a list of what they read. */
function MyStanding({ standing }: { standing: Standing }) {
  const next = READER_BADGES.find((b) => b.books > standing.books)
  return (
    <div className="card rise mb-6 flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {standing.badge ?? 'Reader'}
          {standing.trusted && (
            <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-ink">
              <CheckBadgeIcon className="size-3.5" aria-hidden />
              {REPUTATION_COPY.trusted}
            </span>
          )}
        </p>
        <p className="mt-0.5 text-sm text-subtle">
          {standing.books} {standing.books === 1 ? 'book' : 'books'} received{next && ` · ${next.books - standing.books} more to ${next.label}`}
        </p>
      </div>
      <RatingMark rating={standing.rating} />
    </div>
  )
}

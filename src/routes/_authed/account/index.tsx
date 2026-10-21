import { Link, createFileRoute } from '@tanstack/react-router'
import { getMyOrders } from '#/functions/orders.functions'
import { Price } from '#/components/providers'
import { cn, formatDate } from '#/lib/utils'

export const Route = createFileRoute('/_authed/account/')({
  loader: () => getMyOrders(),
  component: Orders,
})

const STATUS = {
  pending_payment: { label: 'Awaiting payment', tone: 'bg-neutral-100 text-neutral-800' },
  paid: { label: 'In progress', tone: 'bg-accent-100 text-accent-800' },
  completed: { label: 'Completed', tone: 'bg-success-100 text-success-700' },
  cancelled: { label: 'Cancelled', tone: 'bg-neutral-100 text-neutral-700' },
} as const

function Orders() {
  const orders = Route.useLoaderData()
  if (!orders.length) {
    return (
      <div className="py-12 text-center">
        <p className="text-neutral-700">No orders yet.</p>
        <Link to="/search" className="btn btn-primary mt-5">
          Find a book
        </Link>
      </div>
    )
  }
  return (
    <ul className="card divide-y divide-neutral-200">
      {orders.map((o) => (
        <li key={o.number}>
          <Link to="/orders/$number" params={{ number: o.number }} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 text-ink no-underline hover:bg-neutral-50 hover:text-ink">
            <div>
              <p className="font-semibold">{o.number}</p>
              <p className="text-sm text-neutral-600">{formatDate(o.createdAt)}</p>
            </div>
            <div className="flex items-center gap-4">
              <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', STATUS[o.status].tone)}>{STATUS[o.status].label}</span>
              <Price ngwee={o.totalNgwee} className="font-semibold tabular-nums" />
            </div>
          </Link>
        </li>
      ))}
    </ul>
  )
}

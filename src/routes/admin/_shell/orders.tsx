import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { listRecentOrders, retryPayout } from '#/functions/admin.functions'
import { Empty, PageHeader, StatusPill } from '#/components/admin'
import { Alert, useAction } from '#/components/form'
import { Price } from '#/components/providers'
import { PAYOUT_STATUS, SELLER_ORDER_STATUS } from '#/data/statuses'
import { cn, formatDate } from '#/lib/utils'

export const Route = createFileRoute('/admin/_shell/orders')({
  validateSearch: z.object({ unpaid: z.boolean().optional() }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listRecentOrders({ data: deps }),
  component: Orders,
})

type Order = Awaited<ReturnType<typeof listRecentOrders>>[number]

function Orders() {
  const orders = Route.useLoaderData()
  const { unpaid } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <div className="space-y-5">
      <PageHeader title="Orders" description="Latest 50." />
      <div className="flex gap-2">
        {[
          { label: 'Paid', value: false },
          { label: 'Awaiting payment', value: true },
        ].map((f) => (
          <button
            key={f.label}
            type="button"
            aria-pressed={!!unpaid === f.value}
            onClick={() => void navigate({ search: f.value ? { unpaid: true } : {} })}
            className={cn('pill', !!unpaid === f.value ? 'bg-accent text-on-accent' : 'bg-surface shadow-sm hover:bg-sunken')}
          >
            {f.label}
          </button>
        ))}
      </div>
      {orders.length ? (
        <ul className="space-y-3">
          {orders.map((o) => (
            <OrderRow key={o.id} order={o} />
          ))}
        </ul>
      ) : (
        <Empty>No orders here yet.</Empty>
      )}
    </div>
  )
}

function OrderRow({ order: o }: { order: Order }) {
  return (
    <li className="card p-4 sm:p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-medium">
          {o.number} <span className="font-normal text-subtle">· {formatDate(o.createdAt)}</span>
        </p>
        <Price ngwee={o.totalNgwee} className="font-medium" />
      </div>
      <p className="text-sm text-muted">
        {o.buyerName}, {o.shipTown} · {o.buyerEmail}
      </p>
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {o.parts.map((p) => (
          <PartRow key={p.id} part={p} />
        ))}
      </ul>
    </li>
  )
}

function PartRow({ part: p }: { part: Order['parts'][number] }) {
  const router = useRouter()
  const retry = useAction(async () => {
    await retryPayout({ data: { sellerOrderId: p.id } })
    await router.invalidate()
  })
  const status = SELLER_ORDER_STATUS[p.status]
  const payout = PAYOUT_STATUS[p.payoutStatus]

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
      <span className="font-medium">{p.storeName}</span>
      <span className="flex flex-wrap items-center gap-2">
        <StatusPill label={status.label} tone={status.tone} />
        <StatusPill label={payout.label} tone={payout.tone} />
        <Price ngwee={p.payoutNgwee} className="text-muted" />
        {p.payoutStatus === 'failed' && (
          <button type="button" className="btn btn-secondary btn-sm" disabled={retry.pending} onClick={() => void retry.run()}>
            Retry payout
          </button>
        )}
      </span>
      {retry.error && (
        <div className="w-full">
          <Alert>{retry.error}</Alert>
        </div>
      )}
    </li>
  )
}

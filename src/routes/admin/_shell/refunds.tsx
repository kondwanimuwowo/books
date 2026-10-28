import { createFileRoute, useRouter } from '@tanstack/react-router'
import { listRefunds, markRefundDone } from '#/functions/admin.functions'
import { Empty, PageHeader, StatusPill } from '#/components/admin'
import { Alert, useAction } from '#/components/form'
import { Placeholder, RowShapes } from '#/components/placeholder'
import { formatMoney } from '#/lib/money'
import { formatDate } from '#/lib/utils'
import { DELETED_ACCOUNT } from '#/data/admin'
import { FULFILMENT_COPY } from '#/data/fulfilment'

export const Route = createFileRoute('/admin/_shell/refunds')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading refunds" shapes={<RowShapes cover={false} />} />,
  loader: () => listRefunds(),
  component: Refunds,
})

type Refund = Awaited<ReturnType<typeof listRefunds>>[number]

const STATUS: Record<Refund['status'], { label: string; tone: string }> = {
  manual: { label: 'Refund by hand', tone: 'bg-warning-soft text-warning' },
  processing: { label: 'Sending', tone: 'bg-accent-soft text-accent-soft-ink' },
  failed: { label: 'Failed, retrying', tone: 'bg-danger-soft text-danger' },
  paid: { label: 'Sent', tone: 'bg-success-soft text-success' },
  done_manually: { label: 'Refunded by hand', tone: 'bg-success-soft text-success' },
}

const REASON: Record<Refund['reason'], string> = { not_shipped: 'Not shipped in time', dispute: 'Problem report' }

function Refunds() {
  const rows = Route.useLoaderData()
  return (
    <div className="space-y-5">
      <PageHeader
        title="Refunds"
        description="Mobile money refunds go back automatically. Card payments need refunding in the Lenco dashboard; mark them here once done."
      />
      {rows.length ? (
        <ul className="space-y-3">
          {rows.map((r) => (
            <RefundRow key={r.id} refund={r} />
          ))}
        </ul>
      ) : (
        <Empty>No refunds yet.</Empty>
      )}
    </div>
  )
}

function RefundRow({ refund: r }: { refund: Refund }) {
  const router = useRouter()
  const done = useAction(async () => {
    await markRefundDone({ data: { id: r.id } })
    await router.invalidate()
  })
  const status = STATUS[r.status]
  return (
    <li className="card flex flex-wrap items-center justify-between gap-4 p-4">
      <div className="min-w-0 space-y-1 text-sm">
        <p className="flex flex-wrap items-center gap-2 text-base font-medium">
          {formatMoney(r.amountNgwee)} <StatusPill label={status.label} tone={status.tone} />
        </p>
        <p className="text-muted">
          {r.orderNumber} · {r.storeName ?? FULFILMENT_COPY.closedShop} · {REASON[r.reason]} · {formatDate(r.createdAt)}
        </p>
        <p className="text-subtle">
          {r.buyerEmail ?? <em>{DELETED_ACCOUNT}</em>}
          {r.phone && ` · to ${r.phone}`}
          {r.attempts > 1 && ` · ${r.attempts} attempts`}
        </p>
        {r.failureReason && r.status !== 'paid' && <p className="text-danger">{r.failureReason}</p>}
        {done.error && <Alert>{done.error}</Alert>}
      </div>
      {(r.status === 'manual' || r.status === 'failed') && (
        <button type="button" className="btn btn-primary btn-sm" disabled={done.pending} onClick={() => void done.run()}>
          Mark as refunded
        </button>
      )}
    </li>
  )
}

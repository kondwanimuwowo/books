import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getMySales, markShipped, respondToDispute } from '#/functions/orders.functions'
import { getMyBalance, payMeNow } from '#/functions/sell.functions'
import { INSTANT_MIN_NGWEE, PAYOUT_COPY, WEEKLY_MIN_NGWEE } from '#/data/payouts'
import { formatMoney } from '#/lib/money'
import { DocumentUpload } from '#/components/document-upload'
import { DISPUTE_COPY, DISPUTE_REPLY_HOURS, FULFILMENT_COPY, PROOF_REQUIRED, SHIP_FORM, SHIP_FORM_DEFAULT, SHIP_WITHIN_DAYS } from '#/data/fulfilment'
import { Alert, useAction } from '#/components/form'
import { Price } from '#/components/providers'
import { conditionLabel } from '#/data/listing-options'
import { shippingLabel } from '#/data/shipping'
import { SAFETY } from '#/data/safety'
import { PAYOUT_STATUS } from '#/data/statuses'
import { cn, formatDate } from '#/lib/utils'
import { EmptyMessage, Placeholder, RowShapes } from '#/components/placeholder'
import { RateParcel, ReaderStanding } from '#/components/reputation'
import { READER_TAGS, REPUTATION_COPY, withinRatingWindow } from '#/data/reputation'

export const Route = createFileRoute('/_authed/account/sales')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading sales" shapes={<RowShapes cover={false} />} />,
  loader: async () => {
    const [sales, balance] = await Promise.all([getMySales(), getMyBalance()])
    return { sales, balance }
  },
  component: Sales,
})

type Sale = Awaited<ReturnType<typeof getMySales>>[number]

const STATUS: Partial<Record<Sale['status'], { label: string; tone: string }>> = {
  to_ship: { label: 'Ship now', tone: 'bg-warning-soft text-warning' },
  shipped: { label: 'Shipped', tone: 'bg-accent-soft text-accent-soft-ink' },
  delivered: { label: 'Delivered', tone: 'bg-success-soft text-success' },
  disputed: { label: 'Problem reported', tone: 'bg-danger-soft text-danger' },
  refunded: { label: 'Refunded', tone: 'bg-sunken text-muted' },
}

// On its way: still in escrow, or being transferred. The balance (released) has its own card.
const COMING: Sale['payoutStatus'][] = ['held', 'processing']

function Sales() {
  const { sales, balance } = Route.useLoaderData()
  if (!sales.length) {
    return (
      <Placeholder mode="empty" label="Sales" shapes={<RowShapes cover={false} />}>
        <EmptyMessage
          title="No sales yet"
          action={
            <Link to="/sell" className="btn btn-primary">
              List a book
            </Link>
          }
        />
      </Placeholder>
    )
  }

  const paid = sales.filter((s) => s.payoutStatus === 'paid').reduce((n, s) => n + s.payoutNgwee, 0)
  const coming = sales.filter((s) => COMING.includes(s.payoutStatus)).reduce((n, s) => n + s.payoutNgwee, 0)
  // Parcels to ship lead; only the first gets the loud button.
  const ordered = [...sales].sort((a, b) => Number(b.status === 'to_ship') - Number(a.status === 'to_ship'))
  const firstToShip = ordered.find((s) => s.status === 'to_ship')?.id

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end gap-x-10 gap-y-3" aria-label="Earnings">
        <div>
          <p className="eyebrow">Paid to you</p>
          <Price ngwee={paid} className="mt-1 block text-4xl font-bold tracking-[-0.03em] tabular-nums" />
        </div>
        {coming > 0 && (
          <div>
            <p className="eyebrow">On its way</p>
            <Price ngwee={coming} className="mt-1 block text-2xl font-medium text-muted tabular-nums" />
          </div>
        )}
      </section>

      {balance.readyNgwee > 0 && <Balance balance={balance} />}

      <div className="space-y-4">
        {ordered.map((sale) => (
          <SaleCard key={sale.id} sale={sale} primary={sale.id === firstToShip} />
        ))}
      </div>
    </div>
  )
}

function SaleCard({ sale, primary }: { sale: Sale; primary: boolean }) {
  const router = useRouter()
  const [note, setNote] = useState('')
  const [proof, setProof] = useState<string | null>(null)
  const needsProof = PROOF_REQUIRED.includes(sale.shippingMethod)
  const form = SHIP_FORM[sale.shippingMethod] ?? SHIP_FORM_DEFAULT
  const shipBy = sale.order.paidAt ? new Date(new Date(sale.order.paidAt).getTime() + SHIP_WITHIN_DAYS * 86_400_000) : null
  const ship = useAction(async () => {
    await markShipped({ data: { sellerOrderId: sale.id, trackingNote: note, proofKey: proof ?? undefined } })
    await router.invalidate()
  })
  const status = STATUS[sale.status]
  const noteId = `ship-note-${sale.id}`

  return (
    <section className="card p-4 sm:p-5" aria-label={`Sale ${sale.order.number}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <ul className="space-y-0.5">
            {sale.items.map((item) => (
              <li key={item.id} className="font-medium">
                {item.quantity > 1 && <span className="text-subtle tabular-nums">{item.quantity} × </span>}
                {item.title} <span className="text-sm font-normal text-subtle">{conditionLabel(item.condition)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-sm text-subtle">
            <span className="tabular-nums">{sale.order.number}</span> · {formatDate(sale.order.createdAt)} · {shippingLabel(sale.shippingMethod)}
          </p>
          <ReaderStanding standing={sale.buyer} className="mt-1.5" />
        </div>
        {status && <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', status.tone)}>{status.label}</span>}
      </div>

      <p className="mt-3 flex flex-wrap items-baseline gap-x-3 text-sm">
        <Price ngwee={sale.payoutNgwee} className="text-lg font-bold tracking-[-0.02em] tabular-nums" />
        <span className="text-subtle">{PAYOUT_STATUS[sale.payoutStatus].label}</span>
      </p>

      {sale.status === 'to_ship' && (
        <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          {/* Laid out like the label on the parcel itself. */}
          <address className="rounded-lg border-2 border-dashed border-line-strong p-3.5 text-sm not-italic">
            <span className="eyebrow">Ship to</span>
            <span className="mt-1.5 block font-medium">{sale.order.shipName}</span>
            <span className="block text-muted">{sale.order.shipAddress}</span>
            <span className="block text-muted">
              {sale.order.shipTown}, {sale.order.shipProvince}
            </span>
            <a href={`tel:${sale.order.shipPhone}`} className="mt-1 block font-medium tabular-nums">
              {sale.order.shipPhone}
            </a>
            <span className="mt-2 block text-xs text-subtle">{SAFETY.sellerContact}</span>
          </address>
          <div className="flex flex-col gap-2">
            {shipBy && (
              <p className="text-sm font-medium text-warning" suppressHydrationWarning>
                {FULFILMENT_COPY.shipBy(shipBy.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' }))}
              </p>
            )}
            <label htmlFor={noteId} className="field-label mb-0">
              {form.label}
            </label>
            <textarea id={noteId} className="input" rows={2} placeholder={form.placeholder} value={note} onChange={(e) => setNote(e.target.value)} />
            {needsProof && <DocumentUpload label={FULFILMENT_COPY.proofLabel} hint={FULFILMENT_COPY.proofHint} value={proof} onChange={setProof} />}
            {ship.error && <Alert>{ship.error}</Alert>}
            <button
              type="button"
              className={cn('btn self-start', primary ? 'btn-primary' : 'btn-secondary')}
              disabled={ship.pending || note.trim().length < 3 || (needsProof && !proof)}
              onClick={() => void ship.run()}
            >
              {ship.pending ? 'Saving…' : 'Mark as shipped'}
            </button>
          </div>
        </div>
      )}
      {sale.trackingNote && sale.status !== 'to_ship' && <p className="mt-3 text-sm text-muted">{sale.trackingNote}</p>}
      {sale.status === 'disputed' && <DisputeReply sale={sale} />}
      {sale.status === 'delivered' && sale.deliveredAt && (sale.myRating !== null || withinRatingWindow(sale.deliveredAt)) && (
        <div className="mt-4 border-t border-line pt-4">
          <RateParcel sellerOrderId={sale.id} title={REPUTATION_COPY.rateReader} tags={READER_TAGS} current={sale.myRating} />
        </div>
      )}
    </section>
  )
}

type BalanceData = Awaited<ReturnType<typeof getMyBalance>>

/** Delivered money not yet paid out: free on payout day, or now for Lenco's fee. Nothing shows until a sale is delivered. */
function Balance({ balance }: { balance: BalanceData }) {
  const router = useRouter()
  const [paid, setPaid] = useState<string | null>(null)
  const payNow = useAction(async () => {
    const result = await payMeNow()
    setPaid(result.status === 'paid' ? `Sent ${formatMoney(result.amountNgwee)} to your mobile money.` : `Sending ${formatMoney(result.amountNgwee)}. It usually arrives within minutes.`)
    await router.invalidate()
  })
  const day = new Date(balance.nextPayoutDay).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
  const net = balance.readyNgwee - balance.instantFeeNgwee
  const canInstant = balance.hasDestination && balance.readyNgwee >= INSTANT_MIN_NGWEE

  return (
    <section className="card space-y-4 p-4 sm:p-5" aria-label={PAYOUT_COPY.balance}>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{PAYOUT_COPY.balance}</p>
          <Price ngwee={balance.readyNgwee} className="mt-1 block text-3xl font-bold tracking-[-0.03em] tabular-nums" />
          <p className="mt-1 text-sm text-subtle" suppressHydrationWarning>
            {balance.readyNgwee >= WEEKLY_MIN_NGWEE ? PAYOUT_COPY.weekly(day) : PAYOUT_COPY.belowMinimum(formatMoney(WEEKLY_MIN_NGWEE), day)}
          </p>
        </div>
        {canInstant && !paid && (
          <button type="button" className="btn btn-secondary" disabled={payNow.pending} onClick={() => void payNow.run()}>
            {payNow.pending ? 'Sending…' : PAYOUT_COPY.instant}
          </button>
        )}
      </div>
      {canInstant && !paid && <p className="text-xs text-subtle">{PAYOUT_COPY.instantNote(formatMoney(balance.instantFeeNgwee), formatMoney(net))}</p>}
      {!balance.hasDestination && (
        <Alert tone="info">
          {PAYOUT_COPY.noDestination}{' '}
          <Link to="/account/shop" className="font-medium">
            Add it
          </Link>
        </Alert>
      )}
      {payNow.error && <Alert>{payNow.error}</Alert>}
      {paid && <Alert tone="success">{paid}</Alert>}
    </section>
  )
}

/** A buyer reported a problem: their words, and the seller's chance to answer with proof before admin decides. */
function DisputeReply({ sale }: { sale: Sale }) {
  const router = useRouter()
  const [editing, setEditing] = useState(!sale.sellerResponse)
  const [note, setNote] = useState(sale.sellerResponse ?? '')
  const [proof, setProof] = useState<string | null>(sale.sellerResponseKey)
  const reply = useAction(async () => {
    await respondToDispute({ data: { sellerOrderId: sale.id, note, proofKey: proof ?? undefined } })
    setEditing(false)
    await router.invalidate()
  })
  const due = sale.disputedAt ? new Date(new Date(sale.disputedAt).getTime() + DISPUTE_REPLY_HOURS * 3_600_000) : null
  const dueLabel = due?.toLocaleString('en-GB', { weekday: 'long', hour: '2-digit', minute: '2-digit' }) ?? ''

  return (
    <div className="mt-4 space-y-3 rounded-lg bg-danger-soft/50 p-4 text-sm">
      <p className="font-medium text-danger">The buyer reported a problem</p>
      {sale.disputeNote && <p className="whitespace-pre-line">“{sale.disputeNote}”</p>}
      {editing ? (
        <div className="space-y-3 border-t border-line pt-3">
          <p className="font-medium">{DISPUTE_COPY.replyHeading}</p>
          <p className="text-subtle" suppressHydrationWarning>
            {DISPUTE_COPY.replyHint(dueLabel)}
          </p>
          <textarea className="input" rows={3} maxLength={1000} placeholder={DISPUTE_COPY.replyPlaceholder} value={note} onChange={(e) => setNote(e.target.value)} />
          <DocumentUpload label={DISPUTE_COPY.proofLabel} hint={DISPUTE_COPY.proofHint} value={proof} onChange={setProof} />
          {reply.error && <Alert>{reply.error}</Alert>}
          <button type="button" className="btn btn-primary btn-sm" disabled={reply.pending || note.trim().length < 10} onClick={() => void reply.run()}>
            {reply.pending ? 'Sending…' : 'Send your side'}
          </button>
        </div>
      ) : (
        <div className="space-y-2 border-t border-line pt-3">
          <p className="font-medium">{DISPUTE_COPY.replyHeading}</p>
          <p className="whitespace-pre-line text-muted">{sale.sellerResponse}</p>
          <p className="text-success">{DISPUTE_COPY.sent}</p>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
            Change your reply
          </button>
        </div>
      )}
    </div>
  )
}

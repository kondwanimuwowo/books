import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getAdminOverview, listDisputes, resolveDispute } from '#/functions/admin.functions'
import { Empty, PageHeader, StatTile, useStoreUrl } from '#/components/admin'
import { Alert, Field, useAction } from '#/components/form'
import { Price } from '#/components/providers'
import { shippingLabel } from '#/data/shipping'
import { OPERATOR_LABELS } from '#/lib/phone'
import { cn, formatDate } from '#/lib/utils'
import { Placeholder, StatShapes } from '#/components/placeholder'
import { CLAIM_FLAG_AT, CLAIM_WINDOW_DAYS, DISPUTE_REPLY_HOURS } from '#/data/fulfilment'

export const Route = createFileRoute('/admin/_shell/')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading overview" shapes={<StatShapes />} />,
  loader: async () => {
    const [overview, disputes] = await Promise.all([getAdminOverview(), listDisputes()])
    return { overview, disputes }
  },
  component: Overview,
})

type Dispute = Awaited<ReturnType<typeof listDisputes>>[number]

function Overview() {
  const { overview, disputes } = Route.useLoaderData()
  return (
    <div className="space-y-10">
      <PageHeader title="Overview" />
      {/* The one figure that matters most: buyers' money Kuwala is holding. */}
      <section aria-label="Held in escrow">
        <p className="eyebrow">Held in escrow</p>
        <Price ngwee={overview.heldNgwee} className="mt-1 block text-5xl font-bold tracking-[-0.04em] tabular-nums sm:text-6xl" />
      </section>
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatTile label="Disputes" value={overview.disputed} alert={overview.disputed > 0} />
        <StatTile label="Late to ship" value={overview.lateShipments} hint="Paid 3+ days ago" alert={overview.lateShipments > 0} />
        <StatTile label="Failed payouts" value={overview.failedPayouts} alert={overview.failedPayouts > 0} />
        <StatTile label="No payout number" value={overview.awaitingPayoutDetails} />
        <StatTile label="To verify" value={<Link to="/admin/sellers">{overview.unverifiedSellers}</Link>} />
      </section>

      <section>
        <h2 className="text-xl">Disputes</h2>
        <p className="mt-1 text-sm text-subtle">Oldest first.</p>
        <div className="mt-5 space-y-5">
          {disputes.length ? disputes.map((d) => <DisputeCard key={d.id} dispute={d} />) : <Empty>No disputes.</Empty>}
        </div>
      </section>
    </div>
  )
}

function refundDestination(paidWith: Dispute['paidWith']) {
  if (!paidWith) return 'Payment record not found. Check the order in Lenco.'
  if (paidWith.method === 'card') return 'Paid by card. Refund it from the Lenco dashboard.'
  const operator = paidWith.operator ? OPERATOR_LABELS[paidWith.operator] : 'mobile money'
  return `Paid with ${operator} from ${paidWith.phone ?? 'an unknown number'}. Send the refund to that number.`
}

function DisputeCard({ dispute: d }: { dispute: Dispute }) {
  const router = useRouter()
  const storeUrl = useStoreUrl()
  const [outcome, setOutcome] = useState<'release' | 'refund' | null>(null)
  const [note, setNote] = useState('')
  const resolve = useAction(async () => {
    if (!outcome) return
    await resolveDispute({ data: { sellerOrderId: d.id, outcome, note } })
    await router.invalidate()
  })

  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
        <p className="font-medium">
          {d.orderNumber} <span className="font-normal text-subtle">· {d.storeName}</span>
        </p>
        <p className="text-sm text-subtle">Reported {d.disputedAt ? formatDate(d.disputedAt) : 'earlier'}</p>
      </header>

      <div className="grid gap-6 p-5 md:grid-cols-2">
        <div className="space-y-4 text-sm">
          <blockquote className="rounded-lg bg-danger-soft px-4 py-3 text-danger">
            <p className="eyebrow text-danger">Buyer says</p>
            <p className="mt-1 whitespace-pre-line">{d.disputeNote ?? 'No note was saved with this report.'}</p>
          </blockquote>
          <ul className="space-y-0.5">
            {d.items.map((item, i) => (
              <li key={i}>
                {item.quantity} × {item.title}
              </li>
            ))}
          </ul>
          <p className="text-muted">
            {shippingLabel(d.shippingMethod)}
            {d.shippedAt ? `, shipped ${formatDate(d.shippedAt)}` : ', not marked as shipped'}
            {d.trackingNote && (
              <>
                <br />
                Seller's note: {d.trackingNote}
              </>
            )}
          </p>
          {d.proofKey ? (
            <a href={`/admin-files/${d.proofKey}`} target="_blank" rel="noreferrer" className="mt-2 inline-block text-sm font-medium">
              See the courier receipt
            </a>
          ) : (
            d.shippedAt && <p className="mt-2 text-sm text-subtle">No receipt photo.</p>
          )}
          <SellerSide dispute={d} />
          {(d.buyerClaims >= CLAIM_FLAG_AT || d.sellerRefunds >= CLAIM_FLAG_AT) && (
            <div className="rounded-lg bg-warning-soft px-4 py-3 text-warning">
              {d.buyerClaims >= CLAIM_FLAG_AT && <p>This buyer has reported {d.buyerClaims} other parcels in the last {CLAIM_WINDOW_DAYS} days.</p>}
              {d.sellerRefunds >= CLAIM_FLAG_AT && <p>This seller has had {d.sellerRefunds} other parcels refunded in the last {CLAIM_WINDOW_DAYS} days.</p>}
            </div>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="eyebrow">Buyer</dt>
            <dd className="mt-1">
              {d.buyerName}
              <br />
              <a href={`mailto:${d.buyerEmail}`}>{d.buyerEmail}</a>
              <br />
              <a href={`tel:${d.buyerPhone}`}>{d.buyerPhone}</a>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Seller</dt>
            <dd className="mt-1">
              <a href={storeUrl(`/sellers/${d.sellerSlug}`)} target="_blank" rel="noreferrer">
                {d.storeName}
              </a>
              <br />
              <a href={`mailto:${d.sellerEmail}`}>{d.sellerEmail}</a>
              <br />
              <a href={`tel:${d.sellerPhone}`}>{d.sellerPhone}</a>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Refund would be</dt>
            <dd className="mt-1 font-medium">
              <Price ngwee={d.subtotalNgwee + d.shippingNgwee} />
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Seller would get</dt>
            <dd className="mt-1 font-medium">
              <Price ngwee={d.payoutNgwee} />
            </dd>
          </div>
        </dl>
      </div>

      <footer className="space-y-4 border-t border-line bg-sunken p-5">
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Outcome">
          {(
            [
              ['release', 'Release payment to seller'],
              ['refund', 'Refund the buyer'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={outcome === value}
              onClick={() => setOutcome(value)}
              className={cn('pill', outcome === value ? 'bg-accent text-on-accent' : 'bg-surface shadow-sm hover:bg-sunken')}
            >
              {label}
            </button>
          ))}
        </div>

        {outcome === 'refund' && <Alert tone="info">{refundDestination(d.paidWith)} Then record the transaction reference below.</Alert>}

        {outcome && (
          <>
            <Field label="Resolution note" hint="Sent to both the buyer and the seller.">
              <textarea
                className="input"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={outcome === 'refund' ? 'e.g. Book arrived water-damaged. Refunded K185 to 0961234567, ref MP231023.1234.' : 'e.g. Bus company confirmed collection on 20 October.'}
              />
            </Field>
            {resolve.error && <Alert>{resolve.error}</Alert>}
            <button type="button" className="btn btn-primary" disabled={resolve.pending || note.trim().length < 5} onClick={() => void resolve.run()}>
              {outcome === 'refund' ? 'Mark as refunded' : 'Release payment'}
            </button>
          </>
        )}
      </footer>
    </article>
  )
}

/** The seller's answer to the report, or how long they have left to give one. */
function SellerSide({ dispute: d }: { dispute: { sellerResponse: string | null; sellerResponseKey: string | null; sellerRespondedAt: Date | string | null; disputedAt: Date | string | null } }) {
  if (d.sellerResponse) {
    return (
      <blockquote className="rounded-lg bg-sunken px-4 py-3">
        <p className="eyebrow">Seller says{d.sellerRespondedAt ? ` · ${formatDate(d.sellerRespondedAt)}` : ''}</p>
        <p className="mt-1 whitespace-pre-line">{d.sellerResponse}</p>
        {d.sellerResponseKey && (
          <a href={`/admin-files/${d.sellerResponseKey}`} target="_blank" rel="noreferrer" className="mt-2 inline-block font-medium">
            See the seller’s proof
          </a>
        )}
      </blockquote>
    )
  }
  const due = d.disputedAt ? new Date(new Date(d.disputedAt).getTime() + DISPUTE_REPLY_HOURS * 3_600_000) : null
  const late = !!due && due.getTime() < Date.now()
  return (
    <p className={late ? 'font-medium text-danger' : 'text-subtle'} suppressHydrationWarning>
      {late ? `No reply from the seller within ${DISPUTE_REPLY_HOURS} hours.` : `Waiting for the seller’s side until ${due ? formatDate(due) : 'soon'}.`}
    </p>
  )
}

import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getAdminOverview, listDisputes, resolveDispute } from '#/functions/admin.functions'
import { Empty, StatTile } from '#/components/admin'
import { Alert, Field, useAction } from '#/components/form'
import { Price } from '#/components/providers'
import { shippingLabel } from '#/data/shipping'
import { OPERATOR_LABELS } from '#/lib/phone'
import { cn, formatDate } from '#/lib/utils'

export const Route = createFileRoute('/_authed/admin/')({
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
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <StatTile label="Open disputes" value={overview.disputed} alert={overview.disputed > 0} />
        <StatTile
          label="Late shipments"
          value={overview.lateShipments}
          hint="Paid more than 3 days ago, not yet shipped"
          alert={overview.lateShipments > 0}
        />
        <StatTile label="Failed payouts" value={overview.failedPayouts} hint="Retried automatically up to 3 times" alert={overview.failedPayouts > 0} />
        <StatTile label="Waiting on payout details" value={overview.awaitingPayoutDetails} hint="Released, seller has no mobile money number yet" />
        <StatTile label="Awaiting verification" value={<Link to="/admin/sellers">{overview.unverifiedSellers}</Link>} hint="Authors, bookshops and publishers" />
        <StatTile label="Held in escrow" value={<Price ngwee={overview.heldNgwee} />} hint="Paid by buyers, not yet released" />
      </section>

      <section>
        <h2 className="text-xl">Disputes</h2>
        <p className="mt-1 text-sm text-neutral-700">Oldest first. The payment stays held until you resolve each one.</p>
        <div className="mt-5 space-y-5">
          {disputes.length ? disputes.map((d) => <DisputeCard key={d.id} dispute={d} />) : <Empty>No open disputes.</Empty>}
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
  const [outcome, setOutcome] = useState<'release' | 'refund' | null>(null)
  const [note, setNote] = useState('')
  const resolve = useAction(async () => {
    if (!outcome) return
    await resolveDispute({ data: { sellerOrderId: d.id, outcome, note } })
    await router.invalidate()
  })

  return (
    <article className="card overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-neutral-200 px-5 py-4">
        <p className="font-semibold">
          {d.orderNumber} <span className="font-normal text-neutral-600">· {d.storeName}</span>
        </p>
        <p className="text-sm text-neutral-600">Reported {d.disputedAt ? formatDate(d.disputedAt) : 'earlier'}</p>
      </header>

      <div className="grid gap-6 p-5 md:grid-cols-2">
        <div className="space-y-4 text-sm">
          <blockquote className="rounded-lg bg-danger-100 px-4 py-3 text-danger-700">
            <p className="eyebrow text-danger-700">Buyer says</p>
            <p className="mt-1 whitespace-pre-line">{d.disputeNote ?? 'No note was saved with this report.'}</p>
          </blockquote>
          <ul className="space-y-0.5">
            {d.items.map((item, i) => (
              <li key={i}>
                {item.quantity} × {item.title}
              </li>
            ))}
          </ul>
          <p className="text-neutral-700">
            {shippingLabel(d.shippingMethod)}
            {d.shippedAt ? `, shipped ${formatDate(d.shippedAt)}` : ', not marked as shipped'}
            {d.trackingNote && (
              <>
                <br />
                Seller's note: {d.trackingNote}
              </>
            )}
          </p>
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
              <Link to="/sellers/$slug" params={{ slug: d.sellerSlug }}>
                {d.storeName}
              </Link>
              <br />
              <a href={`mailto:${d.sellerEmail}`}>{d.sellerEmail}</a>
              <br />
              <a href={`tel:${d.sellerPhone}`}>{d.sellerPhone}</a>
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Refund would be</dt>
            <dd className="mt-1 font-semibold">
              <Price ngwee={d.subtotalNgwee + d.shippingNgwee} />
            </dd>
          </div>
          <div>
            <dt className="eyebrow">Seller would get</dt>
            <dd className="mt-1 font-semibold">
              <Price ngwee={d.payoutNgwee} />
            </dd>
          </div>
        </dl>
      </div>

      <footer className="space-y-4 border-t border-neutral-200 bg-neutral-50 p-5">
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
              className={cn('pill', outcome === value ? 'bg-accent-700 text-white' : 'bg-white shadow-sm hover:bg-neutral-100')}
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

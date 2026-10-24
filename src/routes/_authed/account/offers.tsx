import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { answerOffer, getMyOffers, withdrawOffer } from '#/functions/offers.functions'
import { BookCover } from '#/components/book'
import { Alert, useAction } from '#/components/form'
import { Price, useBag } from '#/components/providers'
import { MAX_COUNTERS, conditionLabel } from '#/data/listing-options'
import { OFFER_STATUS } from '#/data/statuses'
import { cn } from '#/lib/utils'
import { EmptyMessage, Placeholder, RowShapes } from '#/components/placeholder'

export const Route = createFileRoute('/_authed/account/offers')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading offers" shapes={<RowShapes />} />,
  loader: () => getMyOffers(),
  component: Offers,
})

type Data = Awaited<ReturnType<typeof getMyOffers>>
type Made = Data['made'][number]
type Received = Data['received'][number]
type Side = 'buyer' | 'seller'

const WAITING = 'bg-sunken text-muted'
const YOUR_TURN = 'bg-warning-soft text-warning'

function statusPill(offer: Made | Received, side: Side) {
  if (offer.status === 'pending') {
    if (offer.turn !== side) return { label: side === 'buyer' ? 'Waiting for the seller' : 'Waiting for the buyer', tone: WAITING }
    return { label: side === 'seller' && offer.counters >= MAX_COUNTERS ? 'Final offer' : 'Your turn', tone: YOUR_TURN }
  }
  if (offer.status === 'expired') return { label: offer.agreedNgwee !== null ? 'Not paid in time' : 'No reply', tone: WAITING }
  return { label: OFFER_STATUS[offer.status][side], tone: OFFER_STATUS[offer.status].tone }
}

/** "5h left" while waiting for an answer, "5h to pay" once agreed. */
function deadline(offer: { status: string; expiresAt: Date | string }) {
  const hours = Math.floor((new Date(offer.expiresAt).getTime() - Date.now()) / 3_600_000)
  const time = hours < 1 ? 'under an hour' : `${hours}h`
  return ` · ${time} ${offer.status === 'accepted' ? 'to pay' : 'left'}`
}

function Offers() {
  const { made, received, isSeller } = Route.useLoaderData()
  if (!made.length && !received.length) {
    return (
      <Placeholder mode="empty" label="Offers" shapes={<RowShapes />}>
        <EmptyMessage title="No offers yet" />
      </Placeholder>
    )
  }
  // Offers waiting on this person come first on both sides.
  const yourTurn = (side: Side) => (o: Made | Received) => Number(o.status === 'pending' && o.turn === side)
  const sellerRows = [...received].sort((a, b) => yourTurn('seller')(b) - yourTurn('seller')(a))
  const buyerRows = [...made].sort((a, b) => yourTurn('buyer')(b) - yourTurn('buyer')(a))
  return (
    <div className="space-y-10">
      {isSeller && received.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl">On your books</h2>
          <ul className="space-y-3">
            {sellerRows.map((o) => (
              <OfferRow key={o.id} offer={o} side="seller" who={`From ${o.buyerName}`} />
            ))}
          </ul>
        </section>
      )}
      {made.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl">You made</h2>
          <ul className="space-y-3">
            {buyerRows.map((o) => (
              <OfferRow key={o.id} offer={o} side="buyer" who={o.storeName} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function OfferRow({ offer, side, who }: { offer: Made | Received; side: Side; who: string }) {
  const pill = statusPill(offer, side)
  const open = offer.status === 'pending' || offer.status === 'accepted'
  return (
    <li className="card flex gap-4 p-4">
      <Link to="/books/$slug" params={{ slug: offer.book.slug }} className="w-14 shrink-0" tabIndex={-1}>
        <BookCover src={offer.book.coverUrl} title={offer.book.title} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-3">
          <Link to="/books/$slug" params={{ slug: offer.book.slug }} className="line-clamp-1 font-medium text-ink">
            {offer.book.title}
          </Link>
          <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', pill.tone)}>{pill.label}</span>
        </div>
        <Positions offer={offer} side={side} />
        <p className="text-sm text-subtle">
          {who}
          {open && <span suppressHydrationWarning>{deadline(offer)}</span>}
        </p>
        {offer.message && <p className="mt-2 rounded-lg bg-sunken px-3 py-2 text-sm whitespace-pre-line">{offer.message}</p>}
        {offer.status === 'pending' && offer.turn === side && <Answer offer={offer} side={side} />}
        {/* On the buyer's own turn, Decline does what Withdraw would. */}
        {side === 'buyer' && (offer.status === 'accepted' || (offer.status === 'pending' && offer.turn === 'seller')) && <BuyerActions offer={offer} />}
      </div>
    </li>
  )
}

/** Where each side stands: the buyer's latest offer, the seller's counter, and the listed price. */
function Positions({ offer, side }: { offer: Made | Received; side: Side }) {
  const money = (ngwee: number, strong = false) => <Price ngwee={ngwee} className={cn('tabular-nums', strong && 'font-medium text-ink')} />
  if (offer.agreedNgwee !== null) {
    return (
      <p className="mt-0.5 text-sm text-subtle">
        Agreed {money(offer.agreedNgwee, true)} · listed {money(offer.priceNgwee)} · {conditionLabel(offer.condition)}
      </p>
    )
  }
  const parts: ReactNode[] = [
    <span key="offer">
      {side === 'buyer' ? 'You offered' : 'Offered'} {money(offer.amountNgwee, offer.counterNgwee === null || offer.turn === 'seller')}
    </span>,
  ]
  if (offer.counterNgwee !== null) {
    parts.push(
      <span key="counter">
        {side === 'seller' ? 'you asked' : 'seller asks'} {money(offer.counterNgwee, offer.turn === 'buyer')}
      </span>,
    )
  }
  parts.push(<span key="listed">listed {money(offer.priceNgwee)}</span>)
  return (
    <p className="mt-0.5 text-sm text-subtle">
      {parts.map((p, i) => (
        <span key={i}>
          {i > 0 && ' · '}
          {p}
        </span>
      ))}
    </p>
  )
}

function Answer({ offer, side }: { offer: Made | Received; side: Side }) {
  const router = useRouter()
  const [countering, setCountering] = useState(false)
  const [amount, setAmount] = useState('')
  const act = useAction(async (move: 'accept' | 'decline' | 'counter') => {
    await answerOffer({ data: { offerId: offer.id, move, counterKwacha: move === 'counter' ? Number(amount) : undefined } })
    await router.invalidate()
  })
  // What accepting agrees to, and the range a counter has to land in.
  const accepting = side === 'seller' ? offer.amountNgwee : (offer.counterNgwee ?? offer.amountNgwee)
  const ceiling = side === 'seller' ? offer.priceNgwee : (offer.counterNgwee ?? offer.priceNgwee)
  const canCounter = offer.counters < MAX_COUNTERS

  return (
    <div className="mt-3 space-y-2">
      {act.error && <Alert>{act.error}</Alert>}
      {countering ? (
        <form
          className="rise flex flex-wrap items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void act.run('counter')
          }}
        >
          <label className="text-xs text-subtle">
            {side === 'buyer' ? 'Your final offer (K)' : 'Your counter (K)'}
            <input
              className="input mt-1 h-9 w-28 tabular-nums"
              type="number"
              inputMode="decimal"
              min={offer.amountNgwee / 100 + 0.5}
              max={ceiling / 100 - 0.5}
              step="0.5"
              required
              autoFocus
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
          <button type="submit" className="btn btn-primary btn-sm" disabled={act.pending}>
            Send
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCountering(false)}>
            Cancel
          </button>
          <p className="w-full text-xs text-subtle">
            Between <Price ngwee={offer.amountNgwee} /> and <Price ngwee={ceiling} />.{' '}
            {side === 'buyer' ? 'The seller can only accept or decline it.' : 'The buyer can counter once more.'}
          </p>
        </form>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-primary btn-sm" disabled={act.pending} onClick={() => void act.run('accept')}>
            Accept <Price ngwee={accepting} className="tabular-nums" />
          </button>
          {canCounter && (
            <button type="button" className="btn btn-secondary btn-sm" disabled={act.pending} onClick={() => setCountering(true)}>
              Counter
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" disabled={act.pending} onClick={() => void act.run('decline')}>
            Decline
          </button>
        </div>
      )}
    </div>
  )
}

function BuyerActions({ offer }: { offer: Made | Received }) {
  const router = useRouter()
  const navigate = useNavigate()
  const { add, lines } = useBag()
  const withdraw = useAction(async () => {
    await withdrawOffer({ data: { offerId: offer.id } })
    await router.invalidate()
  })
  // The agreed price is applied at checkout from the server, so the bag only needs the copy.
  const buy = async () => {
    if (!lines.some((l) => l.listingId === offer.listingId)) add(offer.listingId)
    await navigate({ to: '/checkout' })
  }
  return (
    <div className="mt-3 space-y-2">
      {withdraw.error && <Alert>{withdraw.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        {offer.status === 'accepted' && offer.agreedNgwee !== null && (
          <button type="button" className="btn btn-primary btn-sm" onClick={() => void buy()}>
            Buy for <Price ngwee={offer.agreedNgwee} className="tabular-nums" />
          </button>
        )}
        <button type="button" className="btn btn-ghost btn-sm" disabled={withdraw.pending} onClick={() => void withdraw.run()}>
          Withdraw
        </button>
      </div>
    </div>
  )
}

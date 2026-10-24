import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { getMyOffers, respondToOffer, withdrawOffer } from '#/functions/offers.functions'
import { BookCover } from '#/components/book'
import { Alert, useAction } from '#/components/form'
import { Price, useBag } from '#/components/providers'
import { conditionLabel } from '#/data/listing-options'
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

/** "5h left" while waiting for the seller, "5h to pay" once accepted. */
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
  // Anything waiting on the seller comes first; the buyer's side follows.
  const waiting = received.filter((o) => o.status === 'pending')
  const answered = received.filter((o) => o.status !== 'pending')
  return (
    <div className="space-y-10">
      {isSeller && received.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl">On your books</h2>
          <ul className="space-y-3">
            {[...waiting, ...answered].map((o, i) => (
              <ReceivedRow key={o.id} offer={o} primary={i === 0 && o.status === 'pending'} />
            ))}
          </ul>
        </section>
      )}
      {made.length > 0 && (
        <section>
          <h2 className="mb-4 text-2xl">You made</h2>
          <ul className="space-y-3">
            {made.map((o) => (
              <MadeRow key={o.id} offer={o} />
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}

function Row({ offer, children, side }: { offer: Made | Received; children: ReactNode; side: 'buyer' | 'seller' }) {
  const status = OFFER_STATUS[offer.status]
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
          <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium', status.tone)}>{status[side]}</span>
        </div>
        <p className="mt-0.5 text-sm text-subtle">
          <Price ngwee={offer.amountNgwee} className="font-medium text-ink tabular-nums" /> for <Price ngwee={offer.priceNgwee} className="tabular-nums line-through" /> ·{' '}
          {conditionLabel(offer.condition)}
        </p>
        {children}
      </div>
    </li>
  )
}

function ReceivedRow({ offer, primary }: { offer: Received; primary: boolean }) {
  const router = useRouter()
  const answer = useAction(async (accept: boolean) => {
    await respondToOffer({ data: { offerId: offer.id, accept } })
    await router.invalidate()
  })
  return (
    <Row offer={offer} side="seller">
      <p className="text-sm text-subtle">
        From {offer.buyerName}
        {(offer.status === 'pending' || offer.status === 'accepted') && <span suppressHydrationWarning>{deadline(offer)}</span>}
      </p>
      {offer.message && <p className="mt-2 rounded-lg bg-sunken px-3 py-2 text-sm whitespace-pre-line">{offer.message}</p>}
      {answer.error && (
        <div className="mt-2">
          <Alert>{answer.error}</Alert>
        </div>
      )}
      {offer.status === 'pending' && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={cn('btn btn-sm', primary ? 'btn-primary' : 'btn-secondary')} disabled={answer.pending} onClick={() => void answer.run(true)}>
            Accept
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={answer.pending} onClick={() => void answer.run(false)}>
            Decline
          </button>
        </div>
      )}
    </Row>
  )
}

function MadeRow({ offer }: { offer: Made }) {
  const router = useRouter()
  const navigate = useNavigate()
  const { add, lines } = useBag()
  const withdraw = useAction(async () => {
    await withdrawOffer({ data: { offerId: offer.id } })
    await router.invalidate()
  })
  // The accepted price is applied at checkout from the server, so the bag only needs the copy.
  const buy = async () => {
    if (!lines.some((l) => l.listingId === offer.listingId)) add(offer.listingId)
    await navigate({ to: '/checkout' })
  }
  const open = offer.status === 'pending' || offer.status === 'accepted'
  return (
    <Row offer={offer} side="buyer">
      <p className="text-sm text-subtle">
        {offer.storeName}
        {open && <span suppressHydrationWarning>{deadline(offer)}</span>}
      </p>
      {withdraw.error && (
        <div className="mt-2">
          <Alert>{withdraw.error}</Alert>
        </div>
      )}
      {open && (
        <div className="mt-3 flex flex-wrap gap-2">
          {offer.status === 'accepted' && (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => void buy()}>
              Buy for <Price ngwee={offer.amountNgwee} className="tabular-nums" />
            </button>
          )}
          <button type="button" className="btn btn-ghost btn-sm" disabled={withdraw.pending} onClick={() => void withdraw.run()}>
            Withdraw
          </button>
        </div>
      )}
    </Row>
  )
}

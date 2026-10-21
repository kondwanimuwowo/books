import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getMyListings, updateListing } from '#/functions/sell.functions'
import { BookCover } from '#/components/book'
import { Alert, useAction } from '#/components/form'
import { Price } from '#/components/providers'
import { conditionLabel } from '#/data/listing-options'

export const Route = createFileRoute('/_authed/account/listings')({
  loader: () => getMyListings(),
  component: Listings,
})

type Listing = Awaited<ReturnType<typeof getMyListings>>[number]

function Listings() {
  const listings = Route.useLoaderData()
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Link to="/sell" className="btn btn-primary btn-sm">
          List another book
        </Link>
      </div>
      {listings.length ? (
        <ul className="card divide-y divide-neutral-200">
          {listings.map((l) => (
            <ListingRow key={l.id} listing={l} />
          ))}
        </ul>
      ) : (
        <p className="py-12 text-center text-neutral-700">You haven&rsquo;t listed anything yet.</p>
      )}
    </div>
  )
}

function ListingRow({ listing }: { listing: Listing }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [price, setPrice] = useState(String(listing.priceNgwee / 100))
  const [quantity, setQuantity] = useState(String(listing.quantity))
  const save = useAction(async (status: 'active' | 'paused' | 'removed') => {
    await updateListing({ data: { id: listing.id, priceKwacha: Number(price), quantity: Number(quantity), status } })
    setEditing(false)
    await router.invalidate()
  })
  const statusLabel = { active: 'Live', paused: 'Paused', sold_out: 'Sold out', removed: 'Removed' }[listing.status]

  return (
    <li className="flex gap-4 p-4">
      <Link to="/books/$slug" params={{ slug: listing.book.slug }} className="w-12 shrink-0">
        <BookCover src={listing.book.coverUrl} title={listing.book.title} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <Link to="/books/$slug" params={{ slug: listing.book.slug }} className="line-clamp-1 font-semibold text-ink">
              {listing.book.title}
            </Link>
            <p className="text-sm text-neutral-700">
              {conditionLabel(listing.condition)} · {listing.quantity} in stock · <span className="font-medium">{statusLabel}</span>
            </p>
          </div>
          <Price ngwee={listing.priceNgwee} className="font-semibold" />
        </div>
        {editing ? (
          <div className="mt-3 space-y-2">
            {save.error && <Alert>{save.error}</Alert>}
            <div className="flex flex-wrap gap-2">
              <label className="flex items-center gap-2 text-sm">
                K
                <input className="input h-9 w-24" type="number" min={5} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} />
              </label>
              <label className="flex items-center gap-2 text-sm">
                Qty
                <input className="input h-9 w-20" type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
              </label>
              <button type="button" className="btn btn-primary btn-sm" disabled={save.pending} onClick={() => void save.run('active')}>
                Save
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-2 flex flex-wrap gap-1">
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(true)}>
              Edit
            </button>
            {listing.status === 'active' && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={save.pending} onClick={() => void save.run('paused')}>
                Pause
              </button>
            )}
            {listing.status === 'paused' && (
              <button type="button" className="btn btn-ghost btn-sm" disabled={save.pending} onClick={() => void save.run('active')}>
                Resume
              </button>
            )}
            <button type="button" className="btn btn-ghost btn-sm text-danger-700" disabled={save.pending} onClick={() => void save.run('removed')}>
              Remove
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

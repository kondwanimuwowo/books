import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { TrashIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { getMyListings, updateListing } from '#/functions/sell.functions'
import { BookCover } from '#/components/book'
import { Alert, useAction } from '#/components/form'
import { MissingDescription, OfferSettings, offerSettingsData } from '#/components/seller-forms'
import type { OfferSettingsValue } from '#/components/seller-forms'
import { Price } from '#/components/providers'
import { conditionLabel, PHOTOS_COPY } from '#/data/listing-options'
import { cn } from '#/lib/utils'
import { EmptyMessage, Placeholder, RowShapes } from '#/components/placeholder'
import { ListingPhotos } from '#/components/listing-photos'
import type { ListingPhoto } from '#/components/listing-photos'

export const Route = createFileRoute('/_authed/account/listings')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading listings" shapes={<RowShapes />} />,
  loader: () => getMyListings(),
  component: Listings,
})

type Listing = Awaited<ReturnType<typeof getMyListings>>[number]
type Status = 'active' | 'paused' | 'removed'

const STATE: Record<Listing['status'], string> = { active: 'Live', paused: 'Paused', sold_out: 'Sold out', removed: 'Removed' }

function Listings() {
  const listings = Route.useLoaderData()
  return (
    <div>
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-2xl">
          {listings.length} {listings.length === 1 ? 'listing' : 'listings'}
        </h2>
        <Link to="/sell" className="btn btn-primary btn-sm">
          List a book
        </Link>
      </div>
      {listings.length ? (
        <ul className="grid gap-3 lg:grid-cols-4 lg:gap-x-5 lg:gap-y-8">
          {listings.map((l) => (
            <ListingItem key={l.id} listing={l} />
          ))}
        </ul>
      ) : (
        <Placeholder mode="empty" label="Listings" shapes={<RowShapes />}>
          <EmptyMessage title="Nothing listed yet" />
        </Placeholder>
      )}
    </div>
  )
}

/** Phones: a compact row. Desktop: the cover on a shelf with a price sticker. Paused books fade out. */
function ListingItem({ listing }: { listing: Listing }) {
  const router = useRouter()
  const [mode, setMode] = useState<'view' | 'edit' | 'confirm-remove'>('view')
  const [price, setPrice] = useState(String(listing.priceNgwee / 100))
  const [quantity, setQuantity] = useState(String(listing.quantity))
  const [offerSettings, setOfferSettings] = useState<OfferSettingsValue>({
    open: listing.acceptsOffers,
    floor: listing.offerFloorNgwee !== null ? String(listing.offerFloorNgwee / 100) : '',
  })
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState<ListingPhoto[]>(listing.photos.map((url) => ({ key: url.replace('/covers/', ''), url })))
  const [photosBusy, setPhotosBusy] = useState(false)
  const needsPhoto = listing.condition !== 'new' && !listing.photos.length
  const save = useAction(async (status: Status) => {
    await updateListing({
      data: {
        id: listing.id,
        priceKwacha: Number(price),
        quantity: Number(quantity),
        status,
        ...offerSettingsData(offerSettings),
        description: description.trim() || undefined,
        photoKeys: photos.map((p) => p.key),
      },
    })
    setMode('view')
    await router.invalidate()
  })
  const dimmed = listing.status !== 'active'

  return (
    <li className="card flex gap-4 p-3 lg:flex-col lg:gap-3 lg:bg-transparent lg:p-0 lg:shadow-none">
      <Link to="/books/$slug" params={{ slug: listing.book.slug }} className="relative w-14 shrink-0 lg:w-full" tabIndex={-1}>
        <BookCover src={listing.book.coverUrl} title={listing.book.title} className={cn('transition-[filter,opacity] duration-200', dimmed && 'opacity-60 grayscale')} />
        <span className="absolute -top-2 -right-2 hidden rotate-6 rounded-full bg-accent px-2.5 py-1 text-xs font-medium text-on-accent shadow-md lg:block">
          <Price ngwee={listing.priceNgwee} className="tabular-nums" />
        </span>
      </Link>

      <div className="min-w-0 flex-1">
        <Link to="/books/$slug" params={{ slug: listing.book.slug }} className="line-clamp-1 font-medium text-ink">
          {listing.book.title}
        </Link>
        <p className="text-sm text-subtle">
          <Price ngwee={listing.priceNgwee} className="font-medium text-ink tabular-nums lg:hidden" />
          <span className="lg:hidden"> · </span>
          {conditionLabel(listing.condition)} · {listing.quantity} left ·{' '}
          <span className={cn(listing.status === 'active' ? 'text-success' : 'text-subtle')}>{STATE[listing.status]}</span>
          {listing.acceptsOffers && ' · Offers'}
        </p>
        {needsPhoto && mode === 'view' && (
          <button type="button" className="mt-1 text-sm font-medium text-accent-ink" onClick={() => setMode('edit')}>
            Add photos of this copy
          </button>
        )}

        {save.error && (
          <div className="mt-2">
            <Alert>{save.error}</Alert>
          </div>
        )}

        {mode === 'edit' && (
          <div className="rise mt-3 flex flex-wrap items-end gap-2">
            <label className="text-xs text-subtle">
              Price (K)
              <input className="input mt-1 h-9 w-24" type="number" min={5} step="0.5" value={price} onChange={(e) => setPrice(e.target.value)} />
            </label>
            <label className="text-xs text-subtle">
              Copies
              <input className="input mt-1 h-9 w-20" type="number" min={0} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
            </label>
            <div className="w-full">
              <OfferSettings value={offerSettings} onChange={setOfferSettings} />
            </div>
            {!listing.book.hasDescription && (
              <div className="w-full">
                <MissingDescription isbn={listing.book.isbn13} value={description} onChange={setDescription} />
              </div>
            )}
            <div className="w-full">
              <p className="field-label">{PHOTOS_COPY.heading}</p>
              <ListingPhotos value={photos} onChange={setPhotos} onBusy={setPhotosBusy} />
            </div>
            <button type="button" className="btn btn-primary btn-sm" disabled={save.pending || photosBusy} onClick={() => void save.run('active')}>
              Save
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('view')}>
              Cancel
            </button>
          </div>
        )}

        {mode === 'confirm-remove' && (
          <div className="rise mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span>Take it down?</span>
            <button type="button" className="btn btn-sm bg-danger text-on-accent hover:opacity-90" disabled={save.pending} onClick={() => void save.run('removed')}>
              Remove
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMode('view')}>
              Keep
            </button>
          </div>
        )}

        {mode === 'view' && listing.status !== 'removed' && (
          <div className="mt-2 flex items-center gap-1">
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => setMode('edit')}>
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
            {/* An icon, like the bag's, so three actions fit the narrow desktop card. */}
            <button
              type="button"
              aria-label={`Remove ${listing.book.title}`}
              title="Remove"
              className="ml-auto flex size-9 shrink-0 items-center justify-center rounded-full text-subtle hover:bg-sunken hover:text-danger"
              onClick={() => setMode('confirm-remove')}
            >
              <TrashIcon className="size-4" aria-hidden />
            </button>
          </div>
        )}
      </div>
    </li>
  )
}

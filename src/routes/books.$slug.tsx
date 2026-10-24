import { Link, createFileRoute, useLoaderData } from '@tanstack/react-router'
import { CheckIcon, MapPinIcon } from '@heroicons/react/16/solid'
import { ShieldCheckIcon } from '@heroicons/react/20/solid'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { getBook } from '#/functions/catalog.functions'
import { makeOffer } from '#/functions/offers.functions'
import { Alert, useAction } from '#/components/form'
import { BookCover, Shelf, VerifiedMark, ZambianMark } from '#/components/book'
import { Price, useBag } from '#/components/providers'
import { OFFER_REPLY_HOURS, conditionLabel, formatLabel } from '#/data/listing-options'
import { languageName } from '#/data/zambia'
import { SAFETY } from '#/data/safety'
import { cn } from '#/lib/utils'
import { BookPageShapes, CopyShapes, Placeholder } from '#/components/placeholder'

export const Route = createFileRoute('/books/$slug')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading book" shapes={<BookPageShapes />} />,
  loader: ({ params }) => getBook({ data: { slug: params.slug } }),
  head: ({ loaderData }) => ({
    meta: loaderData
      ? [
          { title: `${loaderData.title} | Kuwala Books` },
          { name: 'description', content: (loaderData.summary ?? loaderData.description)?.slice(0, 160) ?? `Buy ${loaderData.title} in Zambia` },
          { property: 'og:image', content: loaderData.coverUrl ?? '' },
        ]
      : [],
  }),
  component: BookPage,
})

type Book = Awaited<ReturnType<typeof getBook>>
type Offer = Book['offers'][number]
type Filter = 'all' | 'new' | 'used'

function BookPage() {
  const book = Route.useLoaderData()
  const { user } = useLoaderData({ from: '__root__' })
  // The page is cached publicly, so who may edit is worked out here rather than on the server.
  const isAuthor = !!user?.sellerSlug && book.authors.some((a) => a.shopSlug === user.sellerSlug)
  const { add, lines } = useBag()
  const [filter, setFilter] = useState<Filter>('all')
  const offers = useMemo(
    () =>
      book.offers
        .filter((o) => filter === 'all' || (filter === 'new' ? o.condition === 'new' : o.condition !== 'new'))
        .sort((a, b) => a.priceNgwee - b.priceNgwee),
    [book.offers, filter],
  )
  const [pickedId, setPickedId] = useState<string | null>(null)
  // Cheapest copy is chosen until the reader picks another.
  const selected = offers.find((o) => o.id === pickedId) ?? offers[0] ?? null
  const inBag = !!selected && lines.some((l) => l.listingId === selected.id)
  const hasNew = book.offers.some((o) => o.condition === 'new')
  const hasUsed = book.offers.some((o) => o.condition !== 'new')

  const action = selected && <AddButton inBag={inBag} onAdd={() => add(selected.id)} />

  return (
    <div className="page py-6 pb-28 sm:py-10 lg:pb-10">
      <nav className="mb-6 text-sm text-subtle" aria-label="Breadcrumb">
        <Link to="/">Home</Link>
        {book.category && (
          <>
            {' / '}
            <Link to="/search" search={{ category: book.category.slug }}>
              {book.category.name}
            </Link>
          </>
        )}
      </nav>

      <div className="grid gap-8 md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr_360px] lg:gap-10">
        <BookCover
          src={book.coverUrl}
          title={book.title}
          author={book.authors.map((a) => a.name).join(', ')}
          className="rise mx-auto w-44 shadow-lg md:w-full"
        />

        <div className="min-w-0">
          <h1 className="text-3xl leading-[1.1] sm:text-4xl">{book.title}</h1>
          {book.subtitle && <p className="mt-2 text-lg text-muted">{book.subtitle}</p>}
          {book.authors.length > 0 && (
            <p className="mt-3">
              {book.authors.map((a, i) => (
                <span key={a.id}>
                  {i > 0 && ', '}
                  <Link to="/authors/$slug" params={{ slug: a.slug }} className="font-medium">
                    {a.name}
                  </Link>
                </span>
              ))}
            </p>
          )}
          {(book.isZambian || book.authors.some((a) => a.verified)) && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {book.isZambian && <ZambianMark />}
              {book.authors.some((a) => a.verified) && <VerifiedMark label="Verified author" />}
              {isAuthor && (
                <Link to="/account/author" search={{ book: book.id }} className="text-sm font-medium text-accent-ink">
                  Edit details
                </Link>
              )}
            </div>
          )}

          {book.summary && <p className="mt-6 max-w-prose text-lg leading-relaxed">{book.summary}</p>}
          {book.description && <Description text={book.description} />}

          <Specs book={book} />
        </div>

        <aside aria-labelledby="copies-heading" className="md:col-span-2 lg:sticky lg:top-28 lg:col-span-1 lg:self-start">
          <div className="card p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 id="copies-heading" className="text-lg">
                {book.offers.length > 1 ? `${book.offers.length} copies` : 'Copies'}
              </h2>
              {hasNew && hasUsed && <ConditionToggle value={filter} onChange={setFilter} />}
            </div>

            {book.offers.length === 0 ? (
              <Placeholder mode="empty" label="Copies" className="mt-4 min-h-44" shapes={<CopyShapes />}>
                <p className="font-medium">No copies for sale</p>
                <Link to="/sell" className="btn btn-secondary btn-sm mt-3">
                  Sell yours
                </Link>
              </Placeholder>
            ) : (
              <>
                <fieldset className="mt-4 space-y-2">
                  <legend className="sr-only">Choose a copy</legend>
                  {offers.map((o) => (
                    <CopyOption key={o.id} offer={o} checked={selected?.id === o.id} onPick={() => setPickedId(o.id)} />
                  ))}
                </fieldset>
                {/* Desktop keeps the action beside the list; phones get the bar pinned under the thumb. */}
                <div className="mt-5 hidden lg:block">{action}</div>
                {selected?.acceptsOffers && selected.seller.slug !== user?.sellerSlug && (
                  <MakeOffer key={selected.id} copy={selected} signedIn={!!user} next={`/books/${book.slug}`} />
                )}
                <p className="mt-4 flex items-center gap-2 text-xs text-subtle">
                  <ShieldCheckIcon className="size-4 shrink-0 text-success" aria-hidden />
                  Seller is paid after you receive it.
                </p>
                {selected && (
                  <Link to="/sellers/$slug" params={{ slug: selected.seller.slug }} className="mt-3 inline-block text-sm font-medium text-accent-ink">
                    View {selected.seller.storeName}&rsquo;s shop
                  </Link>
                )}
              </>
            )}
          </div>
        </aside>
      </div>

      <Shelf title={`More in ${book.category?.name ?? 'this section'}`} books={book.related} />

      {selected && (
        <div className="glass-bar fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="page flex items-center justify-between gap-4 py-3">
            <div className="min-w-0">
              <Price ngwee={selected.priceNgwee} className="text-lg font-bold tracking-[-0.02em]" />
              <p className="truncate text-xs text-subtle">
                {conditionLabel(selected.condition)} · {selected.seller.storeName}
              </p>
            </div>
            <div className="shrink-0">{action}</div>
          </div>
        </div>
      )}
    </div>
  )
}

function AddButton({ inBag, onAdd }: { inBag: boolean; onAdd: () => void }) {
  if (inBag) {
    return (
      <Link to="/bag" className="btn btn-secondary w-full">
        <CheckIcon className="size-4 text-success" aria-hidden /> In your bag
      </Link>
    )
  }
  return (
    <button type="button" className="btn btn-primary w-full" onClick={onAdd}>
      Add to bag
    </button>
  )
}

function Description({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-6">
      <p className={cn('max-w-prose leading-relaxed whitespace-pre-line', !open && 'line-clamp-6')}>{text}</p>
      {text.length > 400 && (
        <button type="button" onClick={() => setOpen(!open)} className="mt-2 text-sm font-medium text-accent-ink" aria-expanded={open}>
          {open ? 'Less' : 'More'}
        </button>
      )}
    </div>
  )
}

function Specs({ book }: { book: Book }) {
  const specs = [
    ['ISBN', book.isbn13],
    [
      'Publisher',
      book.publisher && book.publisherSlug ? (
        <Link to="/publishers/$slug" params={{ slug: book.publisherSlug }} className="text-accent-ink hover:underline">
          {book.publisher}
        </Link>
      ) : (
        book.publisher
      ),
    ],
    ['Published', book.publishedYear],
    ['Pages', book.pageCount],
    ['Language', languageName(book.language)],
  ].filter(([, v]) => v) as [string, ReactNode][]
  if (!specs.length) return null
  return (
    <dl className="mt-8 grid grid-cols-2 gap-x-6 gap-y-4 border-t border-line pt-6 text-sm sm:grid-cols-3">
      {specs.map(([k, v]) => (
        <div key={String(k)}>
          <dt className="eyebrow">{k}</dt>
          <dd className="mt-1 font-medium tabular-nums">{v}</dd>
        </div>
      ))}
    </dl>
  )
}

function ConditionToggle({ value, onChange }: { value: Filter; onChange: (f: Filter) => void }) {
  return (
    <div className="inline-flex rounded-full bg-sunken p-0.5 text-xs font-medium" role="group" aria-label="Condition">
      {(['all', 'new', 'used'] as const).map((f) => (
        <button
          key={f}
          type="button"
          onClick={() => onChange(f)}
          aria-pressed={value === f}
          className={cn('h-7 rounded-full px-3 capitalize transition-colors', value === f ? 'bg-surface text-ink shadow-sm' : 'text-subtle hover:text-ink')}
        >
          {f}
        </button>
      ))}
    </div>
  )
}

function CopyOption({ offer, checked, onPick }: { offer: Offer; checked: boolean; onPick: () => void }) {
  return (
    <label
      className={cn(
        'block cursor-pointer rounded-lg p-3.5 transition-shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink',
        checked
          ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent-ink)]'
          : 'shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
      )}
    >
      <input type="radio" name="copy" className="sr-only" checked={checked} onChange={onPick} />
      <span className="flex items-baseline justify-between gap-3">
        <span className="text-sm">
          <span className="font-medium">{conditionLabel(offer.condition)}</span>
          <span className="text-subtle"> · {formatLabel(offer.format)}</span>
        </span>
        <Price ngwee={offer.priceNgwee} className="text-lg font-bold tracking-[-0.02em] tabular-nums" />
      </span>
      {offer.notes && <span className="mt-1 block text-sm text-muted">{offer.notes}</span>}
      <span className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-subtle">
        <span className="font-medium text-muted">{offer.seller.storeName}</span>
        {offer.fromAuthor ? <VerifiedMark label="From the author" /> : offer.seller.verified && <VerifiedMark />}
        <span className="inline-flex items-center gap-0.5">
          <MapPinIcon className="size-3.5" aria-hidden />
          {offer.seller.town}
        </span>
        {offer.quantity > 1 && offer.quantity <= 5 && <span>· {offer.quantity} left</span>}
        {offer.acceptsOffers && <span>· Open to offers</span>}
      </span>
    </label>
  )
}

function MakeOffer({ copy, signedIn, next }: { copy: Offer; signedIn: boolean; next: string }) {
  const [open, setOpen] = useState(false)
  const [amount, setAmount] = useState('')
  const [message, setMessage] = useState('')
  const [result, setResult] = useState<'pending' | 'declined' | null>(null)
  const send = useAction(async () => {
    const { status } = await makeOffer({ data: { listingId: copy.id, amountKwacha: Number(amount), message: message.trim() || undefined } })
    setResult(status)
  })

  if (!signedIn) {
    return (
      <Link to="/login" search={{ next }} className="btn btn-secondary mt-3 w-full">
        Make an offer
      </Link>
    )
  }
  if (result === 'pending') {
    return (
      <div className="mt-4">
        <Alert tone="success">
          Offer sent. {copy.seller.storeName} has {OFFER_REPLY_HOURS} hours to answer.{' '}
          <Link to="/account/offers" className="font-medium">
            Your offers
          </Link>
        </Alert>
      </div>
    )
  }
  if (!open) {
    return (
      <button type="button" className="btn btn-secondary mt-3 w-full" onClick={() => setOpen(true)}>
        Make an offer
      </button>
    )
  }
  return (
    <form
      className="rise mt-4 space-y-3 border-t border-line pt-4"
      onSubmit={(e) => {
        e.preventDefault()
        void send.run()
      }}
    >
      {send.error && <Alert>{send.error}</Alert>}
      {result === 'declined' && !send.error && <Alert tone="info">That’s below what the seller will take.</Alert>}
      <label className="block">
        <span className="field-label">Your offer</span>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle">K</span>
          <input
            className="input pl-7 tabular-nums"
            type="number"
            inputMode="decimal"
            min={5}
            max={copy.priceNgwee / 100 - 0.5}
            step="0.5"
            required
            autoFocus
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>
      </label>
      <label className="block">
        <span className="field-label">Note to the seller (optional)</span>
        <textarea className="input" rows={2} maxLength={300} value={message} onChange={(e) => setMessage(e.target.value)} />
        <span className="mt-1 block text-xs text-subtle">{SAFETY.offer}</span>
      </label>
      <div className="flex gap-2">
        <button type="submit" className="btn btn-secondary flex-1" disabled={send.pending}>
          {send.pending ? 'Sending…' : 'Send offer'}
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
          Cancel
        </button>
      </div>
    </form>
  )
}

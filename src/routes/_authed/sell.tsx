import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, MagnifyingGlassIcon } from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getCategories } from '#/functions/catalog.functions'
import { createListing, findBookForSale, getMySeller, getPriceGuide } from '#/functions/sell.functions'
import { BookCover } from '#/components/book'
import { Alert, Field, useAction } from '#/components/form'
import { SellerProfileForm } from '#/components/seller-forms'
import { COMMISSION_RATE, CONDITIONS, FORMATS, conditionLabel } from '#/data/listing-options'
import type { Condition, Format } from '#/data/listing-options'
import { LANGUAGES } from '#/data/zambia'
import { formatMoney } from '#/lib/money'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_authed/sell')({
  loader: async () => {
    const [mine, categories] = await Promise.all([getMySeller(), getCategories()])
    return { ...mine, categories }
  },
  head: () => ({ meta: [{ title: 'Sell a book | Kuwala Books' }] }),
  component: SellPage,
})

type Found = Awaited<ReturnType<typeof findBookForSale>>
type Candidate = Found['external'][number]

type Selection =
  | { kind: 'existing'; id: string; title: string; authorNames: string | null; coverUrl: string | null }
  | { kind: 'external'; candidate: Candidate }
  | { kind: 'manual' }

const optionCard = (selected: boolean) =>
  cn(
    'cursor-pointer rounded-lg p-3 transition-shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink',
    selected ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
  )

function SellPage() {
  const { seller, profile } = Route.useLoaderData()
  const [selection, setSelection] = useState<Selection | null>(null)

  if (!seller) {
    return (
      <div className="page rise max-w-2xl py-10 lg:py-14">
        <h1 className="text-4xl sm:text-5xl">Open your shop</h1>
        <p className="mt-2 text-muted">Once, then list as many books as you like.</p>
        <div className="mt-8">
          <SellerProfileForm
            submitLabel="Open shop"
            onSaved={() => undefined}
            defaults={{ storeName: profile?.displayName ?? '', kind: 'individual', bio: null, phone: profile?.phone ?? null, town: profile?.town ?? null, province: profile?.province ?? null }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('page py-10 lg:py-14', selection ? 'max-w-5xl' : 'max-w-3xl')}>
      <p className="eyebrow">{seller.storeName}</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">Sell a book</h1>
      <div className="mt-8">{selection ? <DetailsStep selection={selection} onBack={() => setSelection(null)} /> : <FindStep onSelect={setSelection} />}</div>
    </div>
  )
}

function FindStep({ onSelect }: { onSelect: (s: Selection) => void }) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found | null>(null)
  const search = useAction(async () => setFound(await findBookForSale({ data: { query } })))

  return (
    <div className="rise">
      <h2 className="text-xl">Which book?</h2>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim().length >= 2) void search.run()
        }}
      >
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ISBN, title or author" aria-label="ISBN, title or author" autoFocus />
        </div>
        <button type="submit" className="btn btn-primary" disabled={search.pending}>
          {search.pending ? 'Searching…' : 'Search'}
        </button>
      </form>
      <p className="mt-2 text-xs text-subtle">The ISBN is printed by the barcode.</p>

      {search.error && (
        <div className="mt-4">
          <Alert>{search.error}</Alert>
        </div>
      )}

      {found && (
        <div className="rise mt-8 space-y-6">
          {found.catalogue.length > 0 && (
            <ResultList title="On Kuwala">
              {found.catalogue.map((b) => (
                <ResultRow
                  key={b.id}
                  title={b.title}
                  meta={[b.authorNames, b.publishedYear].filter(Boolean).join(' · ')}
                  coverUrl={b.coverUrl}
                  onClick={() => onSelect({ kind: 'existing', id: b.id, title: b.title, authorNames: b.authorNames, coverUrl: b.coverUrl })}
                />
              ))}
            </ResultList>
          )}
          {found.external.length > 0 && (
            <ResultList title={found.catalogue.length ? 'Other editions' : 'Found'}>
              {found.external.map((b) => (
                <ResultRow
                  key={b.isbn13 ?? b.title}
                  title={b.title}
                  meta={[b.authors.join(', '), b.publishedYear, b.isbn13].filter(Boolean).join(' · ')}
                  coverUrl={b.coverUrl}
                  onClick={() => onSelect({ kind: 'external', candidate: b })}
                />
              ))}
            </ResultList>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-sunken p-4">
            <p className="font-medium">{!found.catalogue.length && !found.external.length ? 'Not found online' : 'Not here?'}</p>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onSelect({ kind: 'manual' })}>
              Add it yourself
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultList({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="eyebrow mb-2">{title}</h3>
      <ul className="card divide-y divide-line overflow-hidden">{children}</ul>
    </section>
  )
}

function ResultRow({ title, meta, coverUrl, onClick }: { title: string; meta: string; coverUrl: string | null; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="group flex w-full items-center gap-4 p-3 text-left transition-colors hover:bg-sunken">
        <div className="w-11 shrink-0">
          <BookCover src={coverUrl} title={title} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 font-medium">{title}</p>
          <p className="line-clamp-1 text-sm text-subtle">{meta}</p>
        </div>
        <span className="text-sm font-medium text-accent-ink transition-transform group-hover:translate-x-0.5">Sell this</span>
      </button>
    </li>
  )
}

const emptyManual = { title: '', subtitle: '', authors: '', isbn: '', publisher: '', year: '', pages: '', language: 'en', description: '', coverUrl: '' }

function DetailsStep({ selection, onBack }: { selection: Selection; onBack: () => void }) {
  const { categories } = Route.useLoaderData()
  const navigate = useNavigate()
  const [manual, setManual] = useState(emptyManual)
  const [categorySlug, setCategorySlug] = useState('')
  const [zambianAuthor, setZambianAuthor] = useState(false)
  const [format, setFormat] = useState<Format>('paperback')
  const [condition, setCondition] = useState<Condition>('new')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState('')
  const [guide, setGuide] = useState<Awaited<ReturnType<typeof getPriceGuide>> | null>(null)

  useEffect(() => {
    if (selection.kind === 'existing') void getPriceGuide({ data: { bookId: selection.id } }).then(setGuide)
  }, [selection])

  const submit = useAction(async () => {
    const book =
      selection.kind === 'existing'
        ? { kind: 'existing' as const, bookId: selection.id }
        : selection.kind === 'external'
          ? { kind: 'external' as const, source: selection.candidate.source, candidate: selection.candidate }
          : {
              kind: 'manual' as const,
              candidate: {
                title: manual.title.trim(),
                subtitle: manual.subtitle.trim() || null,
                authors: manual.authors
                  .split(',')
                  .map((a) => a.trim())
                  .filter(Boolean),
                isbn13: manual.isbn.trim() || null,
                isbn10: null,
                publisher: manual.publisher.trim() || null,
                publishedYear: manual.year ? Number(manual.year) : null,
                pageCount: manual.pages ? Number(manual.pages) : null,
                language: manual.language,
                description: manual.description.trim() || null,
                coverUrl: manual.coverUrl.trim() || null,
              },
            }
    const { slug } = await createListing({
      data: { book, categorySlug: categorySlug || undefined, zambianAuthor, format, condition, priceKwacha: Number(price), quantity: Number(quantity), notes: notes || undefined },
    })
    await navigate({ to: '/books/$slug', params: { slug } })
  })

  const priceNgwee = Math.round(Number(price) * 100) || 0
  const isNewToCatalogue = selection.kind !== 'existing'
  const setM = (key: keyof typeof manual) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setManual({ ...manual, [key]: e.target.value })
  const heading =
    selection.kind === 'existing'
      ? selection
      : selection.kind === 'external'
        ? { title: selection.candidate.title, authorNames: selection.candidate.authors.join(', '), coverUrl: selection.candidate.coverUrl }
        : { title: manual.title || 'Your book', authorNames: manual.authors || null, coverUrl: manual.coverUrl || null }
  const guideHint =
    guide && guide.count > 0
      ? [guide.newMin !== null && `New from ${formatMoney(guide.newMin)}`, guide.usedMin !== null && `used from ${formatMoney(guide.usedMin)}`].filter(Boolean).join(', ')
      : undefined

  const publish = (
    <button type="submit" className="btn btn-primary w-full" disabled={submit.pending}>
      {submit.pending ? 'Publishing…' : 'Publish'}
    </button>
  )

  return (
    <form
      className="grid gap-10 pb-32 lg:grid-cols-[1fr_300px] lg:pb-0"
      onSubmit={(e) => {
        e.preventDefault()
        void submit.run()
      }}
    >
      <div className="min-w-0 space-y-10">
        <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-accent-ink">
          <ArrowLeftIcon className="size-3.5" aria-hidden /> Another book
        </button>

        {selection.kind === 'manual' && (
          <section className="space-y-4" aria-labelledby="book-heading">
            <h2 id="book-heading" className="text-xl">
              The book
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <input className="input" required value={manual.title} onChange={setM('title')} />
              </Field>
              <Field label="Author" hint="Separate several with commas">
                <input className="input" required value={manual.authors} onChange={setM('authors')} />
              </Field>
              <Field label="ISBN (optional)">
                <input className="input" inputMode="numeric" value={manual.isbn} onChange={setM('isbn')} />
              </Field>
              <Field label="Publisher (optional)">
                <input className="input" value={manual.publisher} onChange={setM('publisher')} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Year">
                  <input className="input" type="number" min={1450} max={2100} value={manual.year} onChange={setM('year')} />
                </Field>
                <Field label="Pages">
                  <input className="input" type="number" min={1} value={manual.pages} onChange={setM('pages')} />
                </Field>
              </div>
              <Field label="Language">
                <select className="input" value={manual.language} onChange={setM('language')}>
                  {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Cover image link (optional)">
                <input className="input" type="url" value={manual.coverUrl} onChange={setM('coverUrl')} />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <textarea className="input" rows={4} value={manual.description} onChange={setM('description')} />
              </Field>
            </div>
          </section>
        )}

        {isNewToCatalogue && (
          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Section">
              <select className="input" value={categorySlug} onChange={(e) => setCategorySlug(e.target.value)}>
                <option value="">Choose</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
            <label className={cn(optionCard(zambianAuthor), 'flex items-center gap-3 self-end text-sm', zambianAuthor && 'bg-zambia-soft shadow-[inset_0_0_0_1.5px_var(--color-zambia)]')}>
              <input type="checkbox" className="size-4 accent-zambia" checked={zambianAuthor} onChange={(e) => setZambianAuthor(e.target.checked)} />
              <span className={cn('font-medium', zambianAuthor && 'text-zambia')}>Zambian author</span>
            </label>
          </section>
        )}

        <section className="space-y-4" aria-labelledby="copy-heading">
          <h2 id="copy-heading" className="text-xl">
            Your copy
          </h2>
          <fieldset>
            <legend className="field-label">Format</legend>
            <div className="flex flex-wrap gap-2">
              {FORMATS.map((f) => (
                <label key={f.value} className={cn(optionCard(format === f.value), 'px-4 py-2 text-sm font-medium')}>
                  <input type="radio" className="sr-only" name="format" checked={format === f.value} onChange={() => setFormat(f.value)} />
                  {f.label}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="field-label">Condition</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {CONDITIONS.map((c) => (
                <label key={c.value} className={optionCard(condition === c.value)}>
                  <input type="radio" className="sr-only" name="condition" checked={condition === c.value} onChange={() => setCondition(c.value)} />
                  <span className="block font-medium">{c.label}</span>
                  <span className="block text-sm text-subtle">{c.note}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Price" hint={guideHint}>
            <div className="relative">
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle">K</span>
              <input className="input pl-7 tabular-nums" type="number" inputMode="decimal" min={5} step="0.5" required value={price} onChange={(e) => setPrice(e.target.value)} />
            </div>
          </Field>
          <Field label="Copies">
            <input className="input tabular-nums" type="number" min={1} required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          </Field>
          <Field label="Note for buyers (optional)" className="sm:col-span-2">
            <textarea className="input" rows={2} maxLength={500} placeholder="Signed, highlighted, edition" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </Field>
        </section>

        {submit.error && <Alert>{submit.error}</Alert>}
      </div>

      {/* Desktop: the listing as buyers will see it, and what you take home. */}
      <aside className="hidden lg:block">
        <div className="sticky top-28 space-y-5">
          <div className="mx-auto w-40">
            <BookCover src={heading.coverUrl} title={heading.title} author={heading.authorNames} className="shadow-lg" />
          </div>
          <div className="text-center">
            <p className="line-clamp-2 font-medium">{heading.title}</p>
            <p className="text-sm text-subtle">
              {conditionLabel(condition)}
              {priceNgwee > 0 && ` · ${formatMoney(priceNgwee)}`}
            </p>
          </div>
          <PayoutReceipt priceNgwee={priceNgwee} />
          {publish}
        </div>
      </aside>

      <div className="glass-bar fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="page flex items-center justify-between gap-4 py-3">
          <div>
            <p className="text-xs text-subtle">You get</p>
            <p className="text-lg font-bold tracking-[-0.02em] tabular-nums">{formatMoney(priceNgwee - Math.round(priceNgwee * COMMISSION_RATE))}</p>
          </div>
          <div className="w-40">{publish}</div>
        </div>
      </div>
    </form>
  )
}

/** A till receipt for the seller: the fee is shown, not buried in a sentence. */
function PayoutReceipt({ priceNgwee }: { priceNgwee: number }) {
  const fee = Math.round(priceNgwee * COMMISSION_RATE)
  return (
    <dl className="card space-y-1.5 p-4 text-sm tabular-nums">
      <div className="flex justify-between">
        <dt className="text-muted">Price</dt>
        <dd>{formatMoney(priceNgwee)}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-muted">Kuwala fee ({Math.round(COMMISSION_RATE * 100)}%)</dt>
        <dd className="text-muted">&minus;{formatMoney(fee)}</dd>
      </div>
      <div className="flex items-baseline justify-between border-t border-dashed border-line-strong pt-2">
        <dt className="font-medium">You get</dt>
        <dd className="text-xl font-bold tracking-[-0.02em]">{formatMoney(priceNgwee - fee)}</dd>
      </div>
      <p className="pt-1 text-xs text-subtle">Plus delivery, paid by the buyer.</p>
    </dl>
  )
}

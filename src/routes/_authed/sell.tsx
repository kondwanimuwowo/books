import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import { getCategories } from '#/functions/catalog.functions'
import { createListing, findBookForSale, getMySeller, getPriceGuide } from '#/functions/sell.functions'
import { BookCover } from '#/components/book'
import { Alert, Field, useAction } from '#/components/form'
import { SellerProfileForm } from '#/components/seller-forms'
import { COMMISSION_RATE, CONDITIONS, FORMATS } from '#/data/listing-options'
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

function SellPage() {
  const { seller, profile } = Route.useLoaderData()
  const [selection, setSelection] = useState<Selection | null>(null)

  if (!seller) {
    return (
      <div className="page max-w-2xl py-10">
        <h1 className="text-3xl">Start selling on Kuwala</h1>
        <p className="mt-2 text-neutral-700">Tell buyers who you are and where you ship from. It takes a minute, and you only do it once.</p>
        <div className="mt-8">
          <SellerProfileForm
            submitLabel="Create my shop"
            onSaved={() => undefined}
            defaults={{ storeName: profile?.displayName ?? '', kind: 'individual', bio: null, phone: profile?.phone ?? null, town: profile?.town ?? null, province: profile?.province ?? null }}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="page max-w-3xl py-10">
      <p className="text-sm text-neutral-600">Selling as {seller.storeName}</p>
      <h1 className="mt-1 text-3xl">Sell a book</h1>
      <div className="mt-8">{selection ? <DetailsStep selection={selection} onBack={() => setSelection(null)} /> : <FindStep onSelect={setSelection} />}</div>
    </div>
  )
}

function FindStep({ onSelect }: { onSelect: (s: Selection) => void }) {
  const [query, setQuery] = useState('')
  const [found, setFound] = useState<Found | null>(null)
  const search = useAction(async () => setFound(await findBookForSale({ data: { query } })))

  return (
    <div>
      <h2 className="text-lg">Which book are you selling?</h2>
      <p className="mt-1 text-sm text-neutral-700">The ISBN is the barcode number on the back cover. Searching by it fills in everything for you.</p>
      <form
        className="mt-4 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          if (query.trim().length >= 2) void search.run()
        }}
      >
        <div className="relative flex-1">
          <Search size={18} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600" aria-hidden />
          <input className="input pl-10" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ISBN, title or author" autoFocus />
        </div>
        <button type="submit" className="btn btn-primary" disabled={search.pending}>
          {search.pending ? 'Searching…' : 'Search'}
        </button>
      </form>

      {search.error && (
        <div className="mt-4">
          <Alert>{search.error}</Alert>
        </div>
      )}

      {found && (
        <div className="mt-6 space-y-6">
          {found.catalogue.length > 0 && (
            <ResultList title="Already on Kuwala">
              {found.catalogue.map((b) => (
                <ResultRow key={b.id} title={b.title} meta={[b.authorNames, b.publishedYear].filter(Boolean).join(' · ')} coverUrl={b.coverUrl} onClick={() => onSelect({ kind: 'existing', id: b.id, title: b.title, authorNames: b.authorNames, coverUrl: b.coverUrl })} />
              ))}
            </ResultList>
          )}
          {found.external.length > 0 && (
            <ResultList title={found.catalogue.length ? 'Other editions' : 'Found'}>
              {found.external.map((b) => (
                <ResultRow
                  key={b.isbn13 ?? b.title}
                  title={b.title}
                  meta={[b.authors.join(', '), b.publishedYear, b.isbn13 && `ISBN ${b.isbn13}`].filter(Boolean).join(' · ')}
                  coverUrl={b.coverUrl}
                  onClick={() => onSelect({ kind: 'external', candidate: b })}
                />
              ))}
            </ResultList>
          )}
          {!found.catalogue.length && !found.external.length && <p className="text-neutral-700">No matches. Many Zambian books aren&rsquo;t in online databases yet, so add it yourself below.</p>}
          <div className="rounded-xl bg-neutral-100 p-4">
            <p className="font-medium">Can&rsquo;t find your book?</p>
            <p className="mt-1 text-sm text-neutral-700">Add its details yourself. Self-published and local titles are very welcome.</p>
            <button type="button" className="btn btn-secondary btn-sm mt-3 bg-white" onClick={() => onSelect({ kind: 'manual' })}>
              Add book details
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ResultList({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 text-sm font-semibold text-neutral-700">{title}</h3>
      <ul className="card divide-y divide-neutral-200">{children}</ul>
    </section>
  )
}

function ResultRow({ title, meta, coverUrl, onClick }: { title: string; meta: string; coverUrl: string | null; onClick: () => void }) {
  return (
    <li>
      <button type="button" onClick={onClick} className="flex w-full items-center gap-4 p-3 text-left transition-colors hover:bg-neutral-50">
        <div className="w-11 shrink-0">
          <BookCover src={coverUrl} title={title} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-1 font-medium">{title}</p>
          <p className="line-clamp-1 text-sm text-neutral-600">{meta}</p>
        </div>
        <span className="text-sm font-medium text-accent-700">Sell this</span>
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
                authors: manual.authors.split(',').map((a) => a.trim()).filter(Boolean),
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
  const payout = priceNgwee - Math.round(priceNgwee * COMMISSION_RATE)
  const isNewToCatalogue = selection.kind !== 'existing'
  const setM = (key: keyof typeof manual) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setManual({ ...manual, [key]: e.target.value })
  const heading = selection.kind === 'existing' ? selection : selection.kind === 'external' ? { title: selection.candidate.title, authorNames: selection.candidate.authors.join(', '), coverUrl: selection.candidate.coverUrl } : null

  return (
    <form
      className="space-y-8"
      onSubmit={(e) => {
        e.preventDefault()
        void submit.run()
      }}
    >
      <button type="button" onClick={onBack} className="inline-flex items-center gap-1 text-sm font-medium text-accent-700">
        <ArrowLeft size={14} aria-hidden /> Choose a different book
      </button>

      {heading ? (
        <div className="flex items-center gap-4">
          <div className="w-16 shrink-0">
            <BookCover src={heading.coverUrl} title={heading.title} />
          </div>
          <div>
            <p className="text-lg font-semibold">{heading.title}</p>
            {heading.authorNames && <p className="text-neutral-700">{heading.authorNames}</p>}
          </div>
        </div>
      ) : (
        <section className="space-y-4">
          <h2 className="text-lg">Book details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Title" className="sm:col-span-2">
              <input className="input" required value={manual.title} onChange={setM('title')} />
            </Field>
            <Field label="Author(s)" hint="Separate several authors with commas">
              <input className="input" required value={manual.authors} onChange={setM('authors')} />
            </Field>
            <Field label="ISBN (optional)" hint="Leave blank if the book has none">
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
            <Field label="Cover image link (optional)" hint="Photo uploads are coming soon">
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
              <option value="">Choose a section&hellip;</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-start gap-3 self-end rounded-lg bg-copper-100 p-3 text-sm">
            <input type="checkbox" className="mt-0.5 accent-copper-600" checked={zambianAuthor} onChange={(e) => setZambianAuthor(e.target.checked)} />
            <span>
              <span className="font-medium text-copper-700">Written by a Zambian author</span>
              <span className="block text-neutral-700">Zambian books are featured across the shop.</span>
            </span>
          </label>
        </section>
      )}

      <section className="space-y-4">
        <h2 className="text-lg">Your copy</h2>
        <div className="flex gap-2">
          {FORMATS.map((f) => (
            <button key={f.value} type="button" aria-pressed={format === f.value} onClick={() => setFormat(f.value)} className={cn('pill', format === f.value ? 'bg-accent-700 text-white' : 'bg-neutral-100 hover:bg-neutral-200')}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {CONDITIONS.map((c) => (
            <label key={c.value} className={cn('cursor-pointer rounded-lg border p-3 transition-colors', condition === c.value ? 'border-accent-700 bg-accent-100' : 'border-neutral-300 hover:border-neutral-400')}>
              <input type="radio" className="sr-only" name="condition" checked={condition === c.value} onChange={() => setCondition(c.value)} />
              <span className="block font-medium">{c.label}</span>
              <span className="block text-sm text-neutral-600">{c.note}</span>
            </label>
          ))}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-[1fr_140px]">
        <Field
          label="Price (kwacha)"
          hint={
            guide && guide.count > 0
              ? [guide.newMin !== null && `New copies from ${formatMoney(guide.newMin)}`, guide.usedMin !== null && `used from ${formatMoney(guide.usedMin)}`].filter(Boolean).join(', ')
              : undefined
          }
        >
          <div className="relative">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600">K</span>
            <input className="input pl-7" type="number" inputMode="decimal" min={5} step="0.5" required value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
        </Field>
        <Field label="Copies">
          <input className="input" type="number" min={1} required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
        </Field>
        {priceNgwee > 0 && (
          <p className="text-sm text-neutral-700 sm:col-span-2">
            You receive <strong>{formatMoney(payout)}</strong> per copy after the 10% Kuwala fee. The buyer pays delivery, and it&rsquo;s added to your payout.
          </p>
        )}
        <Field label="Notes for buyers (optional)" className="sm:col-span-2" hint="Signed copy, highlighting, edition details&hellip;">
          <textarea className="input" rows={2} maxLength={500} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </section>

      {submit.error && <Alert>{submit.error}</Alert>}
      <button type="submit" className="btn btn-primary w-full sm:w-auto" disabled={submit.pending}>
        {submit.pending ? 'Publishing…' : 'Publish listing'}
      </button>
    </form>
  )
}

import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { ArrowLeftIcon, CameraIcon, MagnifyingGlassIcon, SparklesIcon } from '@heroicons/react/16/solid'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getCategories } from '#/functions/catalog.functions'
import { browseCatalogue, createListing, findBookForSale, getMySeller, getPriceGuide, suggestTitles } from '#/functions/sell.functions'
import { BookCover } from '#/components/book'
import { CoverUpload } from '#/components/cover-upload'
import { SuggestInput, loadAuthors, loadPublishers } from '#/components/suggest-input'
import { PhotoReader } from '#/components/photo-reader'
import { LoadingLine, Spinner } from '#/components/loading-line'
import { OptionShapes } from '#/components/placeholder'
import { Select } from '#/components/select'
import { SLOW_AFTER_MS } from '#/data/loading'
import { suggestTidyName } from '#/functions/ai.functions'
import type { PhotoPrefill, PhotoResult } from '#/functions/ai.functions'
import { PHOTO_COPY, TITLE_NOISE } from '#/data/ai'
import { Alert, Field, errorMessage, useAction } from '#/components/form'
import { MissingDescription, OfferSettings, offerSettingsData } from '#/components/seller-forms'
import type { OfferSettingsValue } from '#/components/seller-forms'
import { COMMISSION_RATE, CONDITIONS, FORMATS, conditionLabel } from '#/data/listing-options'
import type { Condition, Format } from '#/data/listing-options'
import { LANGUAGES } from '#/data/zambia'
import { formatMoney } from '#/lib/money'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_authed/sell')({
  loader: async () => {
    const [mine, categories] = await Promise.all([getMySeller(), getCategories()])
    if (!mine.seller) throw redirect({ to: '/start-selling' })
    return { seller: mine.seller, categories }
  },
  head: () => ({ meta: [{ title: 'Sell a book | Kuwala Books' }] }),
  component: SellPage,
})

type Found = Awaited<ReturnType<typeof findBookForSale>>
type Candidate = Found['external'][number]

// What Claude read from the seller's photos, applied to the form as suggestions.
type PhotoSuggestions = Omit<PhotoResult, 'book'>

type Selection = (
  | { kind: 'existing'; id: string; title: string; authorNames: string | null; coverUrl: string | null; isbn13: string | null; hasDescription: boolean }
  | { kind: 'external'; candidate: Candidate }
  | { kind: 'manual'; prefill?: PhotoPrefill }
) & { photos?: PhotoSuggestions }

function fromPhotos({ book, ...photos }: PhotoResult): Selection {
  if (book.kind === 'existing') {
    const b = book.book
    return { kind: 'existing', id: b.id, title: b.title, authorNames: b.authorNames, coverUrl: b.coverUrl, isbn13: b.isbn13, hasDescription: b.hasDescription, photos }
  }
  return book.kind === 'external' ? { kind: 'external', candidate: book.candidate, photos } : { kind: 'manual', prefill: book.prefill, photos }
}

const optionCard = (selected: boolean) =>
  cn(
    'cursor-pointer rounded-lg p-3 transition-shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink',
    selected ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
  )

function SellPage() {
  const { seller } = Route.useLoaderData()
  const [selection, setSelection] = useState<Selection | null>(null)

  return (
    <div className={cn('page py-10 lg:py-14', selection ? 'max-w-5xl' : 'max-w-3xl')}>
      <p className="eyebrow">{seller.storeName}</p>
      <h1 className="mt-2 text-4xl sm:text-5xl">Sell a book</h1>
      <div className="mt-8">{selection ? <DetailsStep key={selection.kind === 'existing' ? selection.id : selection.kind} selection={selection} onBack={() => setSelection(null)} onSwitch={setSelection} /> : <FindStep onSelect={setSelection} />}</div>
    </div>
  )
}

type CatalogueBook = Found['catalogue'][number]
type Option = { id: string; title: string; meta: string; coverUrl: string | null; pick: Selection }

const SEARCH_DELAY_MS = 350

function existingOption(b: CatalogueBook): Option {
  return {
    id: `k-${b.id}`,
    title: b.title,
    meta: [b.authorNames, b.publishedYear].filter(Boolean).join(' · '),
    coverUrl: b.coverUrl,
    pick: { kind: 'existing', id: b.id, title: b.title, authorNames: b.authorNames, coverUrl: b.coverUrl, isbn13: b.isbn13, hasDescription: b.hasDescription },
  }
}

function externalOption(b: Candidate): Option {
  return {
    id: `x-${b.isbn13 ?? b.title}`,
    title: b.title,
    meta: [b.authors.join(', '), b.publishedYear, b.isbn13].filter(Boolean).join(' · '),
    coverUrl: b.coverUrl,
    pick: { kind: 'external', candidate: b },
  }
}

/** A combobox: focus shows what's already on Kuwala A–Z; typing searches Kuwala and the web as you go. */
function FindStep({ onSelect }: { onSelect: (s: Selection) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [all, setAll] = useState<CatalogueBook[] | null>(null)
  const [found, setFound] = useState<{ query: string; result: Found } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [photos, setPhotos] = useState(false)
  const term = query.trim()
  const searching = term.length >= 2

  useEffect(() => {
    if (!open || all) return
    void browseCatalogue()
      .then(setAll)
      .catch(() => setAll([]))
  }, [open, all])

  useEffect(() => {
    if (!searching) return
    let cancelled = false
    const timer = setTimeout(() => {
      findBookForSale({ data: { query: term } })
        .then((result) => !cancelled && (setFound({ query: term, result }), setError(null)))
        .catch((e: unknown) => !cancelled && setError(errorMessage(e)))
    }, SEARCH_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term, searching])

  const current = searching && found?.query === term ? found.result : null
  const loading = searching ? !current && !error : open && !all
  const slow = useSlow(loading)
  // The last answer stays, dimmed and out of reach, until the next one lands: no blank flash between keys.
  const stale = searching && loading && found ? found.result : null
  const shown = current ?? stale
  const kuwala = (searching ? (shown?.catalogue ?? []) : (all ?? [])).map(existingOption)
  const online = (shown?.external ?? []).map(externalOption)
  const options = [...kuwala, ...online]
  const choose = (o: Option) => onSelect(o.pick)

  return (
    <div className="rise">
      <h2 className="text-xl">Which book?</h2>
      <div
        className="relative mt-4"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
        }}
      >
        {loading ? (
          <Spinner className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-accent-ink" />
        ) : (
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
        )}
        <input
          className="input pl-10"
          role="combobox"
          aria-label="ISBN, title or author"
          aria-expanded={open}
          aria-controls="book-options"
          aria-autocomplete="list"
          aria-activedescendant={open && options[active] ? options[active].id : undefined}
          placeholder="ISBN, title or author"
          autoComplete="off"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
            setOpen(true)
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              setOpen(true)
              setActive((i) => Math.min(i + 1, options.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setActive((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter' && open && !stale && options[active]) {
              e.preventDefault()
              choose(options[active])
            } else if (e.key === 'Escape') {
              setOpen(false)
            }
          }}
        />

        {open && (
          <div className="card drop-in absolute inset-x-0 top-full z-20 mt-2 max-h-[min(60vh,28rem)] overflow-y-auto">
            <ul id="book-options" role="listbox" aria-label="Books" aria-busy={!!stale} className={cn('transition-opacity duration-200', stale && 'pointer-events-none opacity-50')}>
              {kuwala.length > 0 && <GroupLabel>{searching ? 'On Kuwala' : 'On Kuwala, A–Z'}</GroupLabel>}
              {kuwala.map((o, i) => (
                <OptionRow key={o.id} option={o} active={i === active} onHover={() => setActive(i)} onPick={() => choose(o)} />
              ))}
              {online.length > 0 && <GroupLabel>{current?.catalogue.length ? 'Other editions online' : 'Found online'}</GroupLabel>}
              {online.map((o, i) => (
                <OptionRow key={o.id} option={o} active={kuwala.length + i === active} onHover={() => setActive(kuwala.length + i)} onPick={() => choose(o)} />
              ))}
            </ul>
            {loading && !options.length && (
              <div aria-hidden className="is-loading">
                <OptionShapes />
              </div>
            )}
            {error && <p className="px-4 py-3 text-sm text-danger">{error}</p>}
            {!loading && !options.length && !error && (
              <p className="px-4 py-3 text-sm text-subtle">{searching ? 'Nothing found. Try the ISBN by the barcode.' : 'Type a title, author or ISBN'}</p>
            )}
            {/* The wait is told down here, so the list above doesn't shift as the line comes and goes. */}
            <div className="sticky bottom-0 flex min-h-[3.75rem] items-center justify-between gap-3 border-t border-line bg-surface px-4 py-3">
              {/* Offered once the search has answered, so nobody gives up on a book that was about to turn up;
                  on a slow network it comes early, for sellers who already know it isn't here. */}
              {loading ? <LoadingLine kind="find" className="flex-1" /> : <p className="rise text-sm text-muted">Not here?</p>}
              {(!loading || slow) && (
                <button type="button" className="rise btn btn-secondary btn-sm shrink-0" onClick={() => onSelect({ kind: 'manual' })}>
                  Add it yourself
                </button>
              )}
            </div>
          </div>
        )}
      </div>
      <p className="mt-2 text-xs text-subtle">The ISBN is printed by the barcode.</p>

      <div className="mt-8 border-t border-line pt-6">
        {photos ? (
          <PhotoReader onRead={(result) => onSelect(fromPhotos(result))} />
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setPhotos(true)}>
            <CameraIcon className="size-4" aria-hidden />
            {PHOTO_COPY.open}
          </button>
        )}
      </div>
    </div>
  )
}

/** True once `waiting` has stayed true for SLOW_AFTER_MS. */
function useSlow(waiting: boolean) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    if (!waiting) return setSlow(false)
    const timer = setTimeout(() => setSlow(true), SLOW_AFTER_MS)
    return () => clearTimeout(timer)
  }, [waiting])
  return slow
}

function GroupLabel({ children }: { children: ReactNode }) {
  return (
    <li role="presentation" className="eyebrow px-4 pt-3 pb-1">
      {children}
    </li>
  )
}

function OptionRow({ option, active, onHover, onPick }: { option: Option; active: boolean; onHover: () => void; onPick: () => void }) {
  return (
    <li
      id={option.id}
      role="option"
      aria-selected={active}
      // Keeps focus in the input so the list doesn't close before the click lands.
      onMouseDown={(e) => e.preventDefault()}
      onMouseEnter={onHover}
      onClick={onPick}
      className={cn('flex cursor-pointer items-center gap-3 px-4 py-2', active && 'bg-sunken')}
    >
      <div className="w-9 shrink-0">
        <BookCover src={option.coverUrl} title={option.title} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-[15px] font-medium">{option.title}</p>
        <p className="line-clamp-1 text-sm text-subtle">{option.meta}</p>
      </div>
    </li>
  )
}

const loadTitles = async (query: string) =>
  (await suggestTitles({ data: { query } })).map((b) => ({ ...b, key: b.id, label: b.title, meta: ['Already on Kuwala', b.authorNames, b.publishedYear].filter(Boolean).join(' · ') }))

const emptyManual = { title: '', subtitle: '', authors: '', isbn: '', publisher: '', year: '', pages: '', language: 'en', description: '' }

function DetailsStep({ selection, onBack, onSwitch }: { selection: Selection; onBack: () => void; onSwitch: (s: Selection) => void }) {
  const { categories } = Route.useLoaderData()
  const navigate = useNavigate()
  const photos = selection.photos
  const [manual, setManual] = useState(selection.kind === 'manual' && selection.prefill ? { ...emptyManual, ...selection.prefill } : emptyManual)
  const [categorySlug, setCategorySlug] = useState('')
  const [zambianAuthor, setZambianAuthor] = useState(false)
  const [format, setFormat] = useState<Format>('paperback')
  const [condition, setCondition] = useState<Condition>(photos?.condition ?? 'new')
  const [price, setPrice] = useState('')
  const [quantity, setQuantity] = useState('1')
  const [notes, setNotes] = useState(photos?.conditionNotes ?? '')
  const [offerSettings, setOfferSettings] = useState<OfferSettingsValue>({ open: false, floor: '' })
  const [description, setDescription] = useState(photos?.description ?? '')
  // Books saved without a description (or found online without one) get a chance to gain one here.
  const missingDescription =
    selection.kind === 'existing' ? (selection.hasDescription ? null : selection.isbn13) : selection.kind === 'external' && !selection.candidate.description ? selection.candidate.isbn13 : undefined
  const [guide, setGuide] = useState<Awaited<ReturnType<typeof getPriceGuide>> | null>(null)
  const [cover, setCover] = useState<{ key: string; preview: string } | null>(photos?.cover ? { key: photos.cover.key, preview: photos.cover.url } : null)
  const [coverBusy, setCoverBusy] = useState(false)

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
                coverUrl: null,
              },
            }
    const { slug } = await createListing({
      data: {
        book,
        categorySlug: categorySlug || undefined,
        zambianAuthor,
        format,
        condition,
        priceKwacha: Number(price),
        quantity: Number(quantity),
        notes: notes || undefined,
        ...offerSettingsData(offerSettings),
        description: missingDescription !== undefined ? description.trim() || undefined : undefined,
        summary: photos?.summary ?? undefined,
        coverKey: cover?.key,
      },
    })
    await navigate({ to: '/books/$slug', params: { slug } })
  })

  const priceNgwee = Math.round(Number(price) * 100) || 0
  const isNewToCatalogue = selection.kind !== 'existing'
  const setM = (key: keyof typeof manual) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setManual({ ...manual, [key]: e.target.value })
  const setValue = (key: keyof typeof manual) => (value: string) => setManual((m) => ({ ...m, [key]: value }))
  const heading =
    selection.kind === 'existing'
      ? selection
      : selection.kind === 'external'
        ? { title: selection.candidate.title, authorNames: selection.candidate.authors.join(', '), coverUrl: selection.candidate.coverUrl }
        : { title: manual.title || 'Your book', authorNames: manual.authors || null, coverUrl: null }
  const guideHint =
    guide && guide.count > 0
      ? [guide.newMin !== null && `New from ${formatMoney(guide.newMin)}`, guide.usedMin !== null && `used from ${formatMoney(guide.usedMin)}`].filter(Boolean).join(', ')
      : undefined

  const publish = (
    <button type="submit" className="btn btn-primary w-full" disabled={submit.pending || coverBusy}>
      {submit.pending ? 'Publishing…' : coverBusy ? 'Uploading photo…' : 'Publish'}
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

        {photos && <Alert tone="info">{PHOTO_COPY.filled}</Alert>}

        {selection.kind === 'manual' && (
          <section className="space-y-4" aria-labelledby="book-heading">
            <h2 id="book-heading" className="text-xl">
              The book
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Title" className="sm:col-span-2">
                <SuggestInput
                  required
                  value={manual.title}
                  onChange={setValue('title')}
                  load={loadTitles}
                  heading="Already on Kuwala: list it instead"
                  onPick={(b) => onSwitch({ kind: 'existing', id: b.id, title: b.title, authorNames: b.authorNames, coverUrl: b.coverUrl, isbn13: b.isbn13, hasDescription: b.hasDescription })}
                />
              </Field>
              <Field label="Author" hint="Separate several with commas">
                <SuggestInput required commaList value={manual.authors} onChange={setValue('authors')} load={loadAuthors} />
              </Field>
              <TidySuggestion
                title={manual.title}
                authors={manual.authors}
                onApply={(tidy) => setManual((m) => ({ ...m, title: tidy.title, subtitle: m.subtitle || tidy.subtitle || '', authors: tidy.authors }))}
              />
              <Field label="ISBN (optional)">
                <input className="input" inputMode="numeric" value={manual.isbn} onChange={setM('isbn')} />
              </Field>
              <Field label="Publisher (optional)">
                <SuggestInput value={manual.publisher} onChange={setValue('publisher')} load={loadPublishers} />
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
                <Select value={manual.language} options={LANGUAGES.map((l) => ({ value: l.code, label: l.name }))} onChange={(language) => setManual((m) => ({ ...m, language }))} />
              </Field>
              <Field label="Description" className="sm:col-span-2">
                <textarea className="input" rows={4} value={manual.description} onChange={setM('description')} />
              </Field>
            </div>
          </section>
        )}

        {missingDescription !== undefined && <MissingDescription isbn={missingDescription} value={description} onChange={setDescription} />}

        {!heading.coverUrl && (
          <section aria-labelledby="cover-heading">
            <h2 id="cover-heading" className="text-xl">
              Cover
            </h2>
            <p className="mt-1 mb-4 text-sm text-subtle">{photos?.cover ? 'Your front cover photo. Tap to change it.' : 'No cover online. A clear photo of the front sells faster.'}</p>
            <CoverUpload onChange={setCover} onBusy={setCoverBusy} current={photos?.cover?.url} />
          </section>
        )}

        {isNewToCatalogue && (
          <section className="grid gap-4 sm:grid-cols-2">
            <Field label="Section">
              <Select value={categorySlug} options={categories.map((c) => ({ value: c.slug, label: c.name }))} onChange={setCategorySlug} />
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
          <div className="sm:col-span-2">
            <OfferSettings value={offerSettings} onChange={setOfferSettings} />
          </div>
        </section>

        {submit.error && <Alert>{submit.error}</Alert>}
      </div>

      {/* Desktop: the listing as buyers will see it, and what you take home. */}
      <aside className="hidden lg:block">
        <div className="sticky top-28 space-y-5">
          <div className="mx-auto w-40">
            <BookCover src={heading.coverUrl ?? cover?.preview ?? null} title={heading.title} author={heading.authorNames} className="shadow-lg" />
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

const TIDY_DELAY_MS = 900

// Shouting capitals, or format and author words typed into the title.
function looksUntidy(title: string, authors: string) {
  const letters = (value: string) => value.replace(/[^a-zA-Z]/g, '')
  const shouting = (value: string) => letters(value).length >= 4 && value === value.toUpperCase()
  return shouting(title) || shouting(authors) || TITLE_NOISE.test(title)
}

type Tidy = NonNullable<Awaited<ReturnType<typeof suggestTidyName>>>

/** Offers a cleaned-up title and author line; the seller decides. */
function TidySuggestion({ title, authors, onApply }: { title: string; authors: string; onApply: (tidy: Tidy) => void }) {
  const [tidy, setTidy] = useState<{ for: string; value: Tidy } | null>(null)
  const typed = `${title.trim()}
${authors.trim()}`
  const untidy = title.trim().length >= 2 && looksUntidy(title, authors)

  useEffect(() => {
    if (!untidy) return
    let cancelled = false
    const timer = setTimeout(() => {
      suggestTidyName({ data: { title: title.trim(), authors: authors.trim() } })
        .then((value) => !cancelled && value && setTidy({ for: typed, value }))
        .catch(() => undefined)
    }, TIDY_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
    // typed captures title and authors.
  }, [typed, untidy])

  if (!untidy || tidy?.for !== typed) return null
  const { value } = tidy
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-sunken px-4 py-3 text-sm sm:col-span-2">
      <p className="flex min-w-0 items-center gap-2">
        <SparklesIcon className="size-4 shrink-0 text-accent-ink" aria-hidden />
        <span className="min-w-0">
          <span className="font-medium">{value.title}</span>
          {value.subtitle && `: ${value.subtitle}`}
          {value.authors && <span className="text-muted"> by {value.authors}</span>}
        </span>
      </p>
      <button type="button" className="btn btn-secondary btn-sm" onClick={() => onApply(value)}>
        Use this
      </button>
    </div>
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

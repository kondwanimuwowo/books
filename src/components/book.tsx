import { Link } from '@tanstack/react-router'
import { CheckBadgeIcon } from '@heroicons/react/16/solid'
import { useEffect, useRef, useState } from 'react'
import { ZAMBIA_FLAG } from '#/data/brand'
import { cn } from '#/lib/utils'
import { Price } from './providers'
import { ScrollRow } from './scroll-row'
import { SaveHeart } from './saved'

// The shadow and spine are physical, not decoration: they make a cover read as a book you could pick up.
export function BookCover({ src, title, author, className }: { src: string | null; title: string; author?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false)
  const img = useRef<HTMLImageElement>(null)
  // An image that failed before the page hydrated never reports it to React; catch it once mounted.
  useEffect(() => {
    if (img.current?.complete && img.current.naturalWidth === 0) setFailed(true)
  }, [src])
  return (
    <div className={cn('book-cover relative aspect-[2/3] overflow-hidden rounded-[4px] bg-sunken-strong', className)}>
      {src && !failed ? (
        <img ref={img} src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <TypeCover title={title} author={author} />
      )}
    </div>
  )
}

/** Many Zambian books have no cover online, so they get a typeset one rather than a grey box. */
function TypeCover({ title, author }: { title: string; author?: string | null }) {
  return (
    <div className="band relative flex h-full flex-col justify-between py-[9%] pr-[9%] pl-[14%] @container">
      <span aria-hidden className="absolute inset-y-0 left-[7%] w-px bg-on-deep-muted/30" />
      <span />
      <div>
        <p className="line-clamp-5 font-display text-[clamp(0.85rem,12cqw,1.2rem)] leading-[1.12] font-bold tracking-[-0.02em] text-on-accent">{title}</p>
        {author && <p className="mt-2 line-clamp-2 text-[clamp(0.6rem,7cqw,0.75rem)] tracking-[0.08em] text-on-deep-muted uppercase">{author}</p>}
      </div>
    </div>
  )
}

export function ZambianMark({ className, label = 'Zambian author' }: { className?: string; label?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-zambia-soft px-2 py-0.5 text-xs font-medium text-zambia', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-zambia" aria-hidden />
      {label}
    </span>
  )
}

export function VerifiedMark({ label = 'Verified' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-ink">
      <CheckBadgeIcon className="size-4" aria-hidden />
      {label}
    </span>
  )
}

export interface BookCardData {
  slug: string
  title: string
  coverUrl: string | null
  isZambian: boolean
  authorNames: string | null
  fromPriceNgwee: number | null
  offerCount: number
}

export function BookCard({ book, rank }: { book: BookCardData; rank?: number }) {
  // The heart sits beside the link, not inside it: a button can't live inside a link.
  return (
    <div className="group relative">
      <Link to="/books/$slug" params={{ slug: book.slug }} className="block text-ink no-underline hover:text-ink">
        <div className="lift-cover relative transition-transform duration-200 ease-out group-hover:-translate-y-1">
          <BookCover src={book.coverUrl} title={book.title} author={book.authorNames} />
          {/* Zambian authors: the flag in the cover's corner, in place of a label. */}
          {book.isZambian && (
            <img
              src={ZAMBIA_FLAG.src}
              alt={ZAMBIA_FLAG.label}
              title={ZAMBIA_FLAG.label}
              width={48}
              height={48}
              className="absolute right-1.5 bottom-1.5 aspect-square w-[clamp(1rem,13%,1.375rem)] rounded-full"
            />
          )}
        </div>
        {rank !== undefined && (
          <span className="absolute -top-2 -left-2 flex size-8 items-center justify-center rounded-full bg-accent text-sm font-bold text-on-accent tabular-nums">
            {rank}
          </span>
        )}
        <div className="mt-3 space-y-0.5">
          <p className="line-clamp-2 font-display text-[16px] leading-snug font-bold tracking-[-0.01em]">{book.title}</p>
          {book.authorNames && <p className="line-clamp-1 text-sm text-muted">{book.authorNames}</p>}
          <p className="pt-1 text-sm">
            {book.fromPriceNgwee !== null ? (
              <>
                <span className="text-muted">{book.offerCount > 1 ? 'From ' : ''}</span>
                <Price ngwee={book.fromPriceNgwee} className="text-[15px] font-bold text-ink tabular-nums" />
              </>
            ) : (
              <span className="text-muted">No copies listed yet</span>
            )}
          </p>
        </div>
      </Link>
      <SaveHeart slug={book.slug} title={book.title} className="absolute top-1.5 right-1.5 size-8 duration-200 group-hover:-translate-y-1" />
    </div>
  )
}

const GRID_COLUMNS = {
  full: 'lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7',
  // Beside a filter panel: one column fewer at each size, so covers stay the same width.
  beside: 'lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6',
}

export function BookGrid({ books, layout = 'full' }: { books: BookCardData[]; layout?: keyof typeof GRID_COLUMNS }) {
  return (
    <div className={cn('grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4', GRID_COLUMNS[layout])}>
      {books.map((b) => (
        <BookCard key={b.slug} book={b} />
      ))}
    </div>
  )
}

/** `ranked` numbers the covers in order, for the chart. */
export function Shelf({ title, books, more, ranked = false }: { title: string; books: BookCardData[]; more?: React.ReactNode; ranked?: boolean }) {
  if (!books.length) return null
  return (
    <section className="py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-xl sm:text-2xl">{title}</h2>
        {more}
      </div>
      {/* Vertical padding keeps the hover lift from being clipped by the scroller. */}
      <ScrollRow arrows className="-mx-4 -my-3 flex snap-x scroll-px-4 gap-5 px-4 py-3 sm:-mx-6 sm:scroll-px-6 sm:px-6">
        {books.map((b, i) => (
          <div key={b.slug} className="w-[136px] shrink-0 snap-start sm:w-[156px]">
            <BookCard book={b} rank={ranked ? i + 1 : undefined} />
          </div>
        ))}
      </ScrollRow>
    </section>
  )
}

export interface SectionCardData {
  slug: string
  name: string
  count: number
}

// Spine proportions and tones cycle so the shelf looks hand-stacked rather than gridded.
const SPINE_HEIGHTS = ['h-52', 'h-46', 'h-56', 'h-48', 'h-54', 'h-44', 'h-50']
const SPINE_WIDTHS = ['w-16', 'w-14', 'w-[4.5rem]', 'w-[3.75rem]', 'w-[4.25rem]']
const SPINE_TONES = [
  'bg-deep text-on-accent',
  'bg-surface text-ink shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
  'bg-accent-soft text-accent-soft-ink',
  'bg-sunken-strong text-ink',
  'bg-accent text-on-accent',
  'bg-sunken text-ink shadow-[inset_0_0_0_1px_var(--color-line)]',
]

/** Sections as book spines on a shelf. Hovering pulls one out, the way you would choose a book. */
export function SectionShelf({ sections }: { sections: SectionCardData[] }) {
  return (
    <ScrollRow className="-mx-4 px-4 pt-3 sm:-mx-6 sm:px-6 lg:overflow-visible">
      <ul className="flex w-max items-end gap-1.5 border-b-[6px] border-line-strong lg:w-full lg:justify-between lg:gap-1">
        {sections.map((section, i) => (
          <li key={section.slug} className="snap-start">
            <Link
              to="/search"
              search={{ category: section.slug }}
              aria-label={section.count ? `${section.name}, ${section.count} ${section.count === 1 ? 'title' : 'titles'}` : section.name}
              className={cn(
                'lift-cover flex flex-col items-center justify-between rounded-t-md px-1 pt-3 pb-2 no-underline transition-transform duration-200 ease-out hover:-translate-y-2 focus-visible:-translate-y-2',
                SPINE_HEIGHTS[i % SPINE_HEIGHTS.length],
                SPINE_WIDTHS[i % SPINE_WIDTHS.length],
                SPINE_TONES[i % SPINE_TONES.length],
              )}
            >
              <span className="text-[13px] leading-tight font-medium [writing-mode:vertical-rl]">{section.name}</span>
              <span className="text-[11px] tabular-nums opacity-75">{section.count || ''}</span>
            </Link>
          </li>
        ))}
      </ul>
    </ScrollRow>
  )
}

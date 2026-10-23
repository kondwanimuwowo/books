import { Link } from '@tanstack/react-router'
import { CheckBadgeIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { cn } from '#/lib/utils'
import { Price } from './providers'

// Shadow here is physical, not decoration: it makes a cover read as an object you could pick up.
export function BookCover({ src, title, author, className }: { src: string | null; title: string; author?: string | null; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={cn('relative aspect-[2/3] overflow-hidden rounded-md bg-sunken-strong shadow-md', className)}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
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
        <p className="line-clamp-5 text-[clamp(0.8rem,11cqw,1.15rem)] leading-[1.15] font-medium tracking-[-0.02em] text-on-accent">{title}</p>
        {author && <p className="mt-2 line-clamp-2 text-[clamp(0.6rem,7cqw,0.75rem)] tracking-[0.08em] text-on-deep-muted uppercase">{author}</p>}
      </div>
    </div>
  )
}

export function ZambianMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-zambia-soft px-2 py-0.5 text-xs font-medium text-zambia', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-zambia" aria-hidden />
      Zambian author
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

export function BookCard({ book }: { book: BookCardData }) {
  return (
    <Link to="/books/$slug" params={{ slug: book.slug }} className="group block text-ink no-underline hover:text-ink">
      <BookCover
        src={book.coverUrl}
        title={book.title}
        author={book.authorNames}
        className="lift-cover transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-lg"
      />
      <div className="mt-3 space-y-0.5">
        <p className="line-clamp-2 text-[15px] leading-snug font-medium">{book.title}</p>
        {book.authorNames && <p className="line-clamp-1 text-sm text-muted">{book.authorNames}</p>}
        {book.isZambian && <ZambianMark className="mt-1" />}
        <p className="pt-1 text-sm">
          {book.fromPriceNgwee !== null ? (
            <>
              <span className="text-subtle">{book.offerCount > 1 ? 'From ' : ''}</span>
              <Price ngwee={book.fromPriceNgwee} className="font-medium text-ink" />
            </>
          ) : (
            <span className="text-subtle">No copies listed yet</span>
          )}
        </p>
      </div>
    </Link>
  )
}

export function BookGrid({ books }: { books: BookCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {books.map((b) => (
        <BookCard key={b.slug} book={b} />
      ))}
    </div>
  )
}

export function Shelf({ title, books, more }: { title: string; books: BookCardData[]; more?: React.ReactNode }) {
  if (!books.length) return null
  return (
    <section className="py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <h2 className="text-xl sm:text-2xl">{title}</h2>
        {more}
      </div>
      {/* Vertical padding keeps the cover shadows and hover lift from being clipped by the scroller. */}
      <div className="no-scrollbar -mx-4 -my-3 flex snap-x gap-5 overflow-x-auto px-4 py-3 sm:-mx-6 sm:px-6">
        {books.map((b) => (
          <div key={b.slug} className="w-[136px] shrink-0 snap-start sm:w-[156px]">
            <BookCard book={b} />
          </div>
        ))}
      </div>
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
    <div className="no-scrollbar -mx-4 overflow-x-auto px-4 pt-3 sm:-mx-6 sm:px-6 lg:overflow-visible">
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
    </div>
  )
}

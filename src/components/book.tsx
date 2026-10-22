import { Link } from '@tanstack/react-router'
import { BadgeCheck } from 'lucide-react'
import { useState } from 'react'
import { cn } from '#/lib/utils'
import { Price } from './providers'

export function BookCover({ src, title, className }: { src: string | null; title: string; className?: string }) {
  const [failed, setFailed] = useState(false)
  return (
    <div className={cn('relative aspect-[2/3] overflow-hidden rounded-lg bg-neutral-200 shadow-md', className)}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full items-end bg-accent-800 p-3">
          <span className="line-clamp-4 text-sm leading-snug font-semibold text-white">{title}</span>
        </div>
      )}
    </div>
  )
}

export function ZambianMark({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full bg-copper-100 px-2 py-0.5 text-xs font-medium text-copper-700', className)}>
      <span className="h-1.5 w-1.5 rounded-full bg-copper-600" aria-hidden />
      Zambian author
    </span>
  )
}

export function VerifiedMark({ label = 'Verified' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-accent-700">
      <BadgeCheck size={14} strokeWidth={2} aria-hidden />
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
        className="lift-cover transition-[transform,box-shadow] duration-300 ease-out group-hover:-translate-y-1 group-hover:shadow-lg"
      />
      <div className="mt-3 space-y-0.5">
        <p className="line-clamp-2 text-[15px] leading-snug font-semibold">{book.title}</p>
        {book.authorNames && <p className="line-clamp-1 text-sm text-neutral-700">{book.authorNames}</p>}
        {book.isZambian && <ZambianMark className="mt-1" />}
        <p className="pt-1 text-sm">
          {book.fromPriceNgwee !== null ? (
            <>
              <span className="text-neutral-600">{book.offerCount > 1 ? 'From ' : ''}</span>
              <Price ngwee={book.fromPriceNgwee} className="font-semibold" />
            </>
          ) : (
            <span className="text-neutral-600">No sellers yet</span>
          )}
        </p>
      </div>
    </Link>
  )
}

export function BookGrid({ books }: { books: BookCardData[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
      {books.map((b) => (
        <BookCard key={b.slug} book={b} />
      ))}
    </div>
  )
}

export function Shelf({ title, note, books, more }: { title: string; note?: string; books: BookCardData[]; more?: React.ReactNode }) {
  if (!books.length) return null
  return (
    <section className="py-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="text-xl sm:text-2xl">{title}</h2>
          {note && <p className="mt-1 text-sm text-neutral-700">{note}</p>}
        </div>
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

export function SectionCard({ section }: { section: SectionCardData }) {
  return (
    <Link
      to="/search"
      search={{ category: section.slug }}
      className="card lift flex min-h-16 items-center justify-between gap-2 px-5 py-4 text-ink no-underline hover:text-ink"
    >
      <span className="font-semibold">{section.name}</span>
      {section.count > 0 && <span className="text-[13px] whitespace-nowrap text-neutral-700 tabular-nums">{section.count}</span>}
    </Link>
  )
}

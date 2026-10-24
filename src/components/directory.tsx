import { Link, useNavigate } from '@tanstack/react-router'
import { CheckBadgeIcon, MagnifyingGlassIcon } from '@heroicons/react/16/solid'
import { useMemo, useState } from 'react'
import { DIRECTORY } from '#/data/directory'
import type { DirectoryKind } from '#/data/directory'
import { cn } from '#/lib/utils'
import { EmptyMessage, Placeholder, RowShapes } from './placeholder'

export interface DirectoryEntry {
  slug: string
  name: string
  isZambian: boolean
  verified: boolean
  bookCount: number
}

function initial(name: string) {
  const letter = name.normalize('NFKD').charAt(0).toUpperCase()
  return /[A-Z]/.test(letter) ? letter : '#'
}

/** Authors or publishers A–Z. The whole list is loaded, so the name filter is instant. */
export function DirectoryPage({ kind, entries, zambian }: { kind: DirectoryKind; entries: DirectoryEntry[]; zambian: boolean }) {
  const copy = DIRECTORY[kind]
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')
  const groups = useMemo(() => {
    const term = filter.trim().toLowerCase()
    const byLetter = new Map<string, DirectoryEntry[]>()
    for (const entry of entries) {
      if (term && !entry.name.toLowerCase().includes(term)) continue
      const letter = initial(entry.name)
      byLetter.set(letter, [...(byLetter.get(letter) ?? []), entry])
    }
    return [...byLetter.entries()]
  }, [entries, filter])

  return (
    <div className="page py-10">
      <header className="rise">
        <h1 className="text-4xl sm:text-5xl">{copy.title}</h1>
        <p className="mt-2 max-w-prose text-muted">{copy.description}</p>
      </header>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <div className="relative w-full sm:w-80">
          <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle" aria-hidden />
          <input className="input pl-10" aria-label={copy.filterLabel} placeholder={copy.filterLabel} value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <button
          type="button"
          aria-pressed={zambian}
          onClick={() => void navigate({ to: '.', search: zambian ? {} : { zambian: true }, replace: true })}
          className={cn('btn btn-sm', zambian ? 'btn-primary' : 'btn-secondary')}
        >
          {copy.zambianFilter}
        </button>
      </div>

      {groups.length > 1 && (
        <nav aria-label="Jump to letter" className="mt-6 flex flex-wrap gap-1">
          {groups.map(([letter]) => (
            <a key={letter} href={`#letter-${letter}`} className="grid size-8 place-items-center rounded-md text-sm font-medium text-muted hover:bg-sunken hover:text-ink">
              {letter}
            </a>
          ))}
        </nav>
      )}

      {groups.length ? (
        <div className="mt-8 space-y-10">
          {groups.map(([letter, items]) => (
            <section key={letter} id={`letter-${letter}`} aria-labelledby={`heading-${letter}`} className="scroll-mt-24">
              <h2 id={`heading-${letter}`} className="eyebrow border-b border-line pb-2">
                {letter}
              </h2>
              <ul className="mt-2 grid gap-x-8 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((entry) => (
                  <li key={entry.slug}>
                    <Link to={copy.to} params={{ slug: entry.slug }} className="flex items-center justify-between gap-3 rounded-md py-2.5 hover:text-accent-ink">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="truncate font-medium">{entry.name}</span>
                        {entry.isZambian && <span className="size-1.5 shrink-0 rounded-full bg-zambia" title={copy.zambianLabel} aria-label={copy.zambianLabel} />}
                        {entry.verified && <CheckBadgeIcon className="size-4 shrink-0 text-accent-ink" role="img" aria-label="Verified" />}
                      </span>
                      <span className="shrink-0 text-sm text-subtle tabular-nums">{entry.bookCount}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : (
        <Placeholder mode="empty" label={copy.title} className="mt-8" shapes={<RowShapes count={4} cover={false} />}>
          <EmptyMessage title={copy.empty} />
        </Placeholder>
      )}
    </div>
  )
}

import { XMarkIcon } from '@heroicons/react/20/solid'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { LANGUAGES } from '#/data/zambia'
import { cn } from '#/lib/utils'

export interface FilterState {
  category?: string
  language?: string
  condition?: 'new' | 'used'
  zambian?: boolean
  min?: number
  max?: number
}

type Section = { slug: string; name: string; count: number }

const CONDITIONS = [
  { value: 'new', label: 'New' },
  { value: 'used', label: 'Used' },
] as const

const split = (value: string | undefined) => (value ? value.split(',').filter(Boolean) : [])

/** Adds or removes one value from a comma-separated list; an empty list clears the filter. */
function toggleIn(value: string | undefined, item: string) {
  const items = split(value)
  const next = items.includes(item) ? items.filter((i) => i !== item) : [...items, item]
  return next.length ? next.join(',') : undefined
}

export function activeFilterCount(f: FilterState) {
  return split(f.category).length + split(f.language).length + (f.condition ? 1 : 0) + (f.zambian ? 1 : 0) + (f.min !== undefined || f.max !== undefined ? 1 : 0)
}

export const NO_FILTERS: FilterState = { category: undefined, language: undefined, condition: undefined, zambian: undefined, min: undefined, max: undefined }

/** eBay-style: bold group headings, a checkbox per option, applied as soon as it's ticked. */
export function FilterPanel({ filters, sections, onChange }: { filters: FilterState; sections: Section[]; onChange: (patch: FilterState) => void }) {
  const categories = split(filters.category)
  const languages = split(filters.language)
  return (
    <div className="space-y-7">
      {activeFilterCount(filters) > 0 && (
        <button type="button" className="text-sm font-medium text-accent-ink" onClick={() => onChange(NO_FILTERS)}>
          Clear all filters
        </button>
      )}
      <Group title="Condition">
        {CONDITIONS.map((c) => (
          // One at a time: unticked means any condition.
          <Check key={c.value} checked={filters.condition === c.value} onChange={() => onChange({ condition: filters.condition === c.value ? undefined : c.value })}>
            {c.label}
          </Check>
        ))}
      </Group>
      <Group title="Authors">
        <Check checked={!!filters.zambian} onChange={() => onChange({ zambian: filters.zambian ? undefined : true })}>
          Zambian authors
        </Check>
      </Group>
      <Group title="Section">
        {sections.map((s) => (
          <Check key={s.slug} checked={categories.includes(s.slug)} count={s.count} onChange={() => onChange({ category: toggleIn(filters.category, s.slug) })}>
            {s.name}
          </Check>
        ))}
      </Group>
      <Group title="Language">
        {LANGUAGES.map((l) => (
          <Check key={l.code} checked={languages.includes(l.code)} onChange={() => onChange({ language: toggleIn(filters.language, l.code) })}>
            {l.name}
          </Check>
        ))}
      </Group>
      <PriceRange min={filters.min} max={filters.max} onChange={(min, max) => onChange({ min, max })} />
    </div>
  )
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset>
      <legend className="mb-2 text-[15px] font-bold tracking-[-0.01em]">{title}</legend>
      <div className="space-y-0.5">{children}</div>
    </fieldset>
  )
}

function Check({ checked, onChange, count, children }: { checked: boolean; onChange: () => void; count?: number; children: ReactNode }) {
  return (
    <label className="flex items-center gap-2.5 rounded-md py-1.5 text-sm text-ink">
      <input type="checkbox" className="size-4 shrink-0 accent-[var(--color-accent)]" checked={checked} onChange={onChange} />
      <span className={cn('min-w-0 flex-1 truncate', checked && 'font-medium')}>{children}</span>
      {count !== undefined && <span className="text-xs text-subtle tabular-nums">{count}</span>}
    </label>
  )
}

const toKwacha = (value: string) => (value.trim() === '' || Number.isNaN(Number(value)) ? undefined : Math.max(0, Number(value)))

function PriceRange({ min, max, onChange }: { min?: number; max?: number; onChange: (min?: number, max?: number) => void }) {
  const [from, setFrom] = useState(min?.toString() ?? '')
  const [to, setTo] = useState(max?.toString() ?? '')
  useEffect(() => {
    setFrom(min?.toString() ?? '')
    setTo(max?.toString() ?? '')
  }, [min, max])

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        onChange(toKwacha(from), toKwacha(to))
      }}
    >
      <fieldset>
        <legend className="mb-2 text-[15px] font-bold tracking-[-0.01em]">Price</legend>
        <div className="flex items-center gap-2">
          <input className="input h-9 px-3 text-sm" type="number" inputMode="decimal" min={0} placeholder="K min" aria-label="Lowest price" value={from} onChange={(e) => setFrom(e.target.value)} />
          <span className="text-subtle" aria-hidden>
            –
          </span>
          <input className="input h-9 px-3 text-sm" type="number" inputMode="decimal" min={0} placeholder="K max" aria-label="Highest price" value={to} onChange={(e) => setTo(e.target.value)} />
          <button type="submit" className="btn btn-secondary btn-sm shrink-0 px-3">
            Go
          </button>
        </div>
      </fieldset>
    </form>
  )
}

/** Phones: the same panel in a sheet that rises from the bottom; results update behind it as boxes are ticked. */
export function FilterSheet({ open, onClose, total, children }: { open: boolean; onClose: () => void; total: number; children: ReactNode }) {
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previous
      window.removeEventListener('keydown', onKey)
    }
  }, [open, onClose])

  return (
    <div role="dialog" aria-modal="true" aria-label="Filters" data-open={open} className="sheet fixed inset-0 z-50 flex flex-col bg-canvas lg:hidden">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <p className="text-lg font-bold">Filters</p>
        <button type="button" className="btn btn-ghost btn-sm px-2" aria-label="Close filters" onClick={onClose}>
          <XMarkIcon className="size-5" aria-hidden />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-5">{children}</div>
      <div className="border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <button type="button" className="btn btn-primary w-full" onClick={onClose}>
          Show {total} {total === 1 ? 'book' : 'books'}
        </button>
      </div>
    </div>
  )
}

import { useEffect, useId, useState } from 'react'
import type { InputHTMLAttributes } from 'react'
import { suggestBookNames } from '#/functions/sell.functions'
import { cn } from '#/lib/utils'
import { Spinner } from './loading-line'

export interface Suggestion {
  key: string
  label: string
  meta?: string | null
}

const SUGGEST_DELAY_MS = 300

const nameLoader = (kind: 'authors' | 'publishers') => async (query: string) =>
  (await suggestBookNames({ data: { kind, query } })).map((n) => ({
    key: n.name,
    label: n.name,
    meta: `${n.bookCount} ${n.bookCount === 1 ? 'book' : 'books'} on Kuwala`,
  }))
export const loadAuthors = nameLoader('authors')
export const loadPublishers = nameLoader('publishers')

/**
 * A text input that offers what's already on Kuwala as the seller types. With `commaList`, the value is
 * comma-separated and suggestions apply to the name being typed after the last comma.
 */
export function SuggestInput<T extends Suggestion>({
  value,
  onChange,
  load,
  onPick,
  commaList = false,
  minLength = 2,
  heading,
  ...props
}: {
  value: string
  onChange: (value: string) => void
  load: (term: string) => Promise<T[]>
  /** Called instead of filling the input, e.g. to switch to a book that's already listed. */
  onPick?: (item: T) => void
  commaList?: boolean
  minLength?: number
  heading?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const [found, setFound] = useState<{ term: string; items: T[] } | null>(null)
  const parts = commaList ? value.split(',') : [value]
  const term = parts[parts.length - 1].trim()
  const searching = open && term.length >= minLength

  useEffect(() => {
    if (!searching) return
    let cancelled = false
    const timer = setTimeout(() => {
      load(term)
        .then((items) => !cancelled && setFound({ term, items }))
        .catch(() => !cancelled && setFound({ term, items: [] }))
    }, SUGGEST_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term, searching, load])

  // Hide a suggestion that's exactly what's typed already.
  const items = searching && found?.term === term ? found.items.filter((i) => onPick || i.label.toLowerCase() !== term.toLowerCase()) : []
  const showing = open && items.length > 0
  const loading = searching && found?.term !== term

  const choose = (item: T) => {
    setOpen(false)
    if (onPick) return onPick(item)
    onChange(commaList ? [...parts.slice(0, -1).map((p) => p.trim()), item.label].join(', ') : item.label)
  }

  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <input
        {...props}
        className={cn('input pr-10', props.className)}
        role="combobox"
        aria-expanded={showing}
        aria-controls={`${id}-list`}
        aria-autocomplete="list"
        aria-activedescendant={showing && items[active] ? `${id}-${active}` : undefined}
        autoComplete="off"
        value={value}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onChange(e.target.value)
          setActive(0)
          setOpen(true)
        }}
        onKeyDown={(e) => {
          if (!showing) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, items.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
          } else if (e.key === 'Enter' && items[active]) {
            e.preventDefault()
            choose(items[active])
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
      />
      {loading && <Spinner className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-subtle" />}
      {showing && (
        <div className="card drop-in absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto py-1">
          {heading && <p className="eyebrow px-3 pt-2 pb-1">{heading}</p>}
          <ul id={`${id}-list`} role="listbox">
            {items.map((item, i) => (
              <li
                key={item.key}
                id={`${id}-${i}`}
                role="option"
                aria-selected={i === active}
                // Keeps focus in the input so the list doesn't close before the click lands.
                onMouseDown={(e) => e.preventDefault()}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(item)}
                className={cn('cursor-pointer px-3 py-2', i === active && 'bg-sunken')}
              >
                <p className="line-clamp-1 text-[15px] font-medium">{item.label}</p>
                {item.meta && <p className="line-clamp-1 text-sm text-subtle">{item.meta}</p>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

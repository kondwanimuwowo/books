import { cn } from '#/lib/utils'

const TONES = {
  // On the burgundy header.
  band: { track: 'bg-on-accent/10', thumb: 'bg-on-accent', on: 'text-deep', off: 'text-on-deep-muted hover:text-on-accent' },
  // On the page.
  page: { track: 'bg-sunken', thumb: 'bg-surface shadow-[0_0_0_1px_var(--color-line)]', on: 'text-ink', off: 'text-muted hover:text-ink' },
  // A form's choice: the picked option is filled with the accent.
  accent: { track: 'bg-sunken', thumb: 'bg-accent', on: 'text-on-accent', off: 'text-muted hover:text-ink' },
} as const

// sm: toolbar toggles, fully round. md: form controls and tabs, with the fields' 10px corners.
const SIZES = {
  sm: { track: 'rounded-full p-0.5 text-[11px]', thumb: 'inset-y-0.5 left-0.5 rounded-full', inset: 4, option: 'h-6 rounded-full px-2.5' },
  md: { track: 'rounded-control p-1 text-sm', thumb: 'inset-y-1 left-1 rounded-[7px]', inset: 8, option: 'h-10 rounded-[7px] px-3' },
} as const

/**
 * A small choice between a few options. One thumb slides under the picked option (equal-width segments, so it moves
 * by its own width), and only its transform animates; the labels' colour fades alongside.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  tone = 'page',
  size = 'sm',
  className,
  title,
}: {
  options: readonly { value: T; label: string; note?: string }[]
  value: T
  onChange: (value: T) => void
  label: string
  tone?: keyof typeof TONES
  size?: keyof typeof SIZES
  className?: string
  title?: string
}) {
  const t = TONES[tone]
  const s = SIZES[size]
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div role="group" aria-label={label} title={title} className={cn('relative inline-grid auto-cols-fr grid-flow-col font-medium', s.track, t.track, className)}>
      <span
        aria-hidden
        className={cn('segmented-thumb absolute', s.thumb, t.thumb)}
        style={{ width: `calc((100% - ${s.inset}px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={cn('segmented-option relative inline-flex items-center justify-center gap-1.5 whitespace-nowrap', s.option, o.value === value ? t.on : t.off)}
        >
          {o.label}
          {o.note && <span className={cn('text-[11px] font-normal', o.value === value ? 'opacity-80' : 'text-subtle')}>{o.note}</span>}
        </button>
      ))}
    </div>
  )
}

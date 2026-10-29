import { cn } from '#/lib/utils'

const TONES = {
  // On the burgundy header.
  band: { track: 'bg-on-accent/10', thumb: 'bg-on-accent', on: 'text-deep', off: 'text-on-deep-muted hover:text-on-accent' },
  // On the page.
  page: { track: 'bg-sunken', thumb: 'bg-surface shadow-[0_0_0_1px_var(--color-line)]', on: 'text-ink', off: 'text-muted hover:text-ink' },
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
  className,
  title,
}: {
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  label: string
  tone?: keyof typeof TONES
  className?: string
  title?: string
}) {
  const t = TONES[tone]
  const index = Math.max(0, options.findIndex((o) => o.value === value))
  return (
    <div role="group" aria-label={label} title={title} className={cn('relative inline-grid auto-cols-fr grid-flow-col rounded-full p-0.5 text-[11px] font-medium', t.track, className)}>
      <span
        aria-hidden
        className={cn('segmented-thumb absolute inset-y-0.5 left-0.5 rounded-full', t.thumb)}
        style={{ width: `calc((100% - 4px) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={o.value === value}
          className={cn('segmented-option relative h-6 rounded-full px-2.5 whitespace-nowrap', o.value === value ? t.on : t.off)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

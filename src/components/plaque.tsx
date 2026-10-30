import { TrophyIcon } from '@heroicons/react/16/solid'
import { tierInfo } from '#/data/tiers'
import type { Tier } from '#/data/tiers'
import { cn, formatDate } from '#/lib/utils'

// The plate: deep tier colour, white lettering, and a hairline engraved 3px inside the edge.
const PLATES: Record<Tier, string> = {
  copper: 'bg-plaque-copper text-plaque-copper shadow-[inset_0_0_0_3px_var(--color-plaque-copper),inset_0_0_0_4px_rgb(255_255_255/0.28)]',
  emerald: 'bg-plaque-emerald text-plaque-emerald shadow-[inset_0_0_0_3px_var(--color-plaque-emerald),inset_0_0_0_4px_rgb(255_255_255/0.28)]',
  gold: 'bg-plaque-gold text-plaque-gold shadow-[inset_0_0_0_3px_var(--color-plaque-gold),inset_0_0_0_4px_rgb(255_255_255/0.28)]',
}

/** A dark plate with the trophy in a white medal; the plate's text colour tints the trophy. */
function Plate({ tier, title, line, large = false, className, style }: { tier: Tier; title: string; line: string; large?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={cn('plaque-shine flex items-center gap-4 rounded-xl', large ? 'p-5' : 'p-4', PLATES[tier], className)} style={style}>
      <span className={cn('grid shrink-0 place-items-center rounded-full bg-on-accent', large ? 'size-12' : 'size-11')} aria-hidden>
        <TrophyIcon className={large ? 'size-6' : 'size-5'} />
      </span>
      <span className="min-w-0">
        <span className={cn('block font-bold text-on-accent', large && 'text-lg')}>{title}</span>
        <span className="block text-sm text-on-accent/80">{line}</span>
      </span>
    </div>
  )
}

const TONES: Record<Tier, { soft: string; ink: string; ring: string }> = {
  copper: { soft: 'bg-copper-soft', ink: 'text-copper', ring: 'shadow-[inset_0_0_0_1px_var(--color-copper)]' },
  emerald: { soft: 'bg-emerald-soft', ink: 'text-emerald', ring: 'shadow-[inset_0_0_0_1px_var(--color-emerald)]' },
  gold: { soft: 'bg-gold-soft', ink: 'text-gold', ring: 'shadow-[inset_0_0_0_1px_var(--color-gold)]' },
}

/** The small badge beside an author's name. */
export function PlaqueMark({ tier, className }: { tier: Tier; className?: string }) {
  const tone = TONES[tier]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', tone.soft, tone.ink, className)}>
      <TrophyIcon className="size-3.5" aria-hidden />
      {tierInfo(tier).label} author
    </span>
  )
}

/** The plaque itself: tier, what it took, and the day it was reached. */
export function Plaque({ tier, reachedAt, className }: { tier: Tier; reachedAt: Date | string; className?: string }) {
  const info = tierInfo(tier)
  return <Plate tier={tier} title={info.label} line={`${info.line} · ${formatDate(reachedAt)}`} className={className} />
}

/** A plaque as an example, before it's earned: the tier and what it takes. `delay` staggers the glint across a row. */
export function PlaqueExample({ tier, line, delay = 0, className }: { tier: Tier; line: string; delay?: number; className?: string }) {
  return <Plate tier={tier} title={tierInfo(tier).label} line={line} large className={className} style={{ '--shine-delay': `${delay}ms` } as React.CSSProperties} />
}

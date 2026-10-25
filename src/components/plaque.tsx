import { TrophyIcon } from '@heroicons/react/16/solid'
import { tierInfo } from '#/data/tiers'
import type { Tier } from '#/data/tiers'
import { cn, formatDate } from '#/lib/utils'

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
  const tone = TONES[tier]
  const info = tierInfo(tier)
  return (
    <div className={cn('flex items-center gap-4 rounded-xl p-4', tone.soft, tone.ring, className)}>
      <span className={cn('grid size-11 shrink-0 place-items-center rounded-full bg-surface', tone.ink)} aria-hidden>
        <TrophyIcon className="size-5" />
      </span>
      <span className="min-w-0">
        <span className={cn('block font-bold', tone.ink)}>{info.label}</span>
        <span className="block text-sm text-muted">
          {info.line} · {formatDate(reachedAt)}
        </span>
      </span>
    </div>
  )
}

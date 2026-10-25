import { TrophyIcon } from '@heroicons/react/24/solid'
import { MotionConfig, motion } from 'motion/react'
import { useEffect } from 'react'
import { markPlaquesSeen } from '#/functions/author.functions'
import { PLAQUE_COPY, tierInfo } from '#/data/tiers'
import type { Tier } from '#/data/tiers'
import { cn, formatDate } from '#/lib/utils'

const TONES: Record<Tier, string> = {
  copper: 'bg-copper-soft text-copper',
  emerald: 'bg-emerald-soft text-emerald',
  gold: 'bg-gold-soft text-gold',
}

// The only bounce on Kuwala: it happens once per plaque, the first time the author sees it.
const ARRIVE = { type: 'spring', duration: 0.7, bounce: 0.2 } as const
const EASE_OUT = [0.23, 1, 0.32, 1] as const

export function PlaqueMoment({ authorId, tier, reachedAt }: { authorId: string; tier: Tier; reachedAt: Date | string }) {
  const info = tierInfo(tier)
  useEffect(() => {
    void markPlaquesSeen({ data: { authorId } }).catch(() => undefined)
  }, [authorId])

  return (
    <MotionConfig reducedMotion="user">
      <motion.div
        role="status"
        initial={{ opacity: 0, transform: 'translateY(12px) scale(0.97)' }}
        animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
        transition={ARRIVE}
        className={cn('mb-6 flex items-center gap-5 rounded-2xl p-5 sm:p-6', TONES[tier])}
      >
        <motion.span
          initial={{ transform: 'scale(0.6) rotate(-12deg)', opacity: 0 }}
          animate={{ transform: 'scale(1) rotate(0deg)', opacity: 1 }}
          transition={{ ...ARRIVE, delay: 0.15 }}
          className="grid size-16 shrink-0 place-items-center rounded-full bg-surface shadow-md"
          aria-hidden
        >
          <TrophyIcon className="size-8" />
        </motion.span>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4, ease: EASE_OUT, delay: 0.3 }} className="min-w-0">
          <p className="text-2xl font-bold">{PLAQUE_COPY.reached(info.label)}</p>
          <p className="mt-1 text-sm text-ink">
            {info.line}. Reached {formatDate(reachedAt)}, and it’s on your author page now.
          </p>
        </motion.div>
      </motion.div>
    </MotionConfig>
  )
}

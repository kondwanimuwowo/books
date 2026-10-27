import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { LOADING_LABEL, LOADING_LINES, LOADING_LINE_MS } from '#/data/loading'
import type { LoadingKind } from '#/data/loading'
import { cn } from '#/lib/utils'

export function Spinner({ className }: { className?: string }) {
  return <span aria-hidden className={cn('block size-4 shrink-0 animate-[spin_750ms_linear_infinite] rounded-full border-2 border-current/25 border-t-current', className)} />
}

/** Picks a line for how long this has been running; a new one every LOADING_LINE_MS. */
function useLoadingLine(kind: LoadingKind) {
  const [tick, setTick] = useState(0)
  // Random start, so the same search doesn't always open with the same joke. Set after mount to keep SSR stable.
  const [seed, setSeed] = useState(0)
  useEffect(() => {
    setSeed(Math.floor(Math.random() * 60))
    const timer = setInterval(() => setTick((t) => t + 1), LOADING_LINE_MS)
    return () => clearInterval(timer)
  }, [])
  const elapsed = tick * LOADING_LINE_MS
  const groups = LOADING_LINES[kind]
  const { lines } = [...groups].reverse().find((g) => g.after <= elapsed) ?? groups[0]
  return lines[(seed + tick) % lines.length]
}

const ROLL = { duration: 0.45, ease: [0.23, 1, 0.32, 1] } as const

/**
 * A spinner and a line that rolls over every few seconds, so a slow search still looks alive.
 * Phones stack the spinner over the line, both centred; `stacked` keeps that on wider screens too.
 */
export function LoadingLine({ kind, stacked = false, className }: { kind: LoadingKind; stacked?: boolean; className?: string }) {
  const line = useLoadingLine(kind)
  return (
    <div
      role="status"
      className={cn('rise flex min-w-0 flex-col items-center gap-2.5 text-center text-sm text-muted', !stacked && 'sm:flex-row sm:text-left', className)}
    >
      <Spinner className={cn('text-accent-ink', stacked && 'size-5')} />
      <span className="sr-only">{LOADING_LABEL[kind]}</span>
      <MotionConfig reducedMotion="user">
        <span aria-hidden className={cn('relative w-full min-w-0 overflow-hidden', !stacked && 'sm:w-auto sm:flex-1')}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.span
              key={line}
              className="block"
              initial={{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(2px)' }}
              animate={{ opacity: 1, transform: 'translateY(0px)', filter: 'blur(0px)' }}
              exit={{ opacity: 0, transform: 'translateY(-8px)', filter: 'blur(2px)' }}
              transition={ROLL}
            >
              {line}
            </motion.span>
          </AnimatePresence>
        </span>
      </MotionConfig>
    </div>
  )
}

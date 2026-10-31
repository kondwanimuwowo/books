import { cn } from '#/lib/utils'

/** Where a person is in a flow: one segment per step, filled up to the current one. */
export function StepProgress({ step, total, className }: { step: number; total: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-4', className)}>
      <div className="flex flex-1 gap-1.5" aria-hidden>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={cn('h-1 flex-1 rounded-full transition-colors duration-300', i <= step ? 'bg-accent' : 'bg-sunken-strong')} />
        ))}
      </div>
      <span className="text-xs text-subtle tabular-nums">
        Step {step + 1} of {total}
      </span>
    </div>
  )
}

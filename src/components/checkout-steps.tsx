import { cn } from '#/lib/utils'

const STEPS = ['Address', 'Delivery', 'Pay'] as const

/** Where the buyer is between bag and paid. Pay happens on the order page. */
export function CheckoutSteps({ current }: { current: 0 | 1 | 2 }) {
  return (
    <ol className="grid grid-cols-3 gap-2" aria-label="Checkout progress">
      {STEPS.map((label, i) => {
        const state = i < current ? 'done' : i === current ? 'current' : 'next'
        return (
          <li key={label} aria-current={state === 'current' ? 'step' : undefined}>
            <span className={cn('block h-1 rounded-full transition-colors duration-200', state === 'next' ? 'bg-line' : 'bg-accent')} />
            <span className={cn('mt-2 flex items-baseline gap-2 text-sm', state === 'next' ? 'text-subtle' : 'text-ink')}>
              <span className="text-xl font-bold tabular-nums">{i + 1}</span>
              <span className={cn(state === 'current' && 'font-medium')}>{label}</span>
            </span>
          </li>
        )
      })}
    </ol>
  )
}

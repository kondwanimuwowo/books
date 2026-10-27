import { NETWORKS } from '#/data/payments'
import type { Operator } from '#/lib/phone'
import { cn } from '#/lib/utils'

const SIZES = {
  sm: 'h-6 rounded px-1.5 text-[10px]',
  md: 'h-8 rounded-md px-2.5 text-xs',
} as const

/** A network's official logo when we have the file, otherwise its name on its brand colour. */
export function NetworkMark({ network, size = 'md', className }: { network: Operator; size?: keyof typeof SIZES; className?: string }) {
  const n = NETWORKS.find((x) => x.key === network)
  if (!n) return null
  if (n.logo) {
    return <img src={n.logo} alt={n.name} className={cn(size === 'sm' ? 'h-6' : 'h-8', 'w-auto rounded', className)} />
  }
  return (
    <span
      className={cn('inline-flex shrink-0 items-center font-bold tracking-[-0.01em] whitespace-nowrap', SIZES[size], className)}
      style={{ backgroundColor: n.bg, color: n.fg }}
    >
      {n.name}
    </span>
  )
}

/** Every network we take, in a row: checkout, the pay step and the footer. */
export function PaymentMarks({ size = 'md', className }: { size?: keyof typeof SIZES; className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-1.5', className)} aria-label={`We accept ${NETWORKS.map((n) => n.name).join(', ')}`}>
      {NETWORKS.map((n) => (
        <li key={n.key} aria-hidden>
          <NetworkMark network={n.key} size={size} />
        </li>
      ))}
    </ul>
  )
}

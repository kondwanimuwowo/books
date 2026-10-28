import { NETWORKS } from '#/data/payments'
import type { Operator } from '#/lib/phone'
import { cn } from '#/lib/utils'

const SIZES = { sm: 'size-7 rounded-md', md: 'size-10 rounded-lg', lg: 'size-14 rounded-xl' } as const

/** A network's official logo, as a square tile. */
export function NetworkMark({ network, size = 'md', className }: { network: Operator; size?: keyof typeof SIZES; className?: string }) {
  const n = NETWORKS.find((x) => x.key === network)
  if (!n) return null
  return <img src={n.logo} alt={n.name} width={192} height={192} loading="lazy" className={cn('block shrink-0 object-cover', SIZES[size], className)} />
}

/** Every network we take, in a row: checkout and the footer. */
export function PaymentMarks({ size = 'sm', className, monochrome = false, sharpCorners = false }: { size?: keyof typeof SIZES; className?: string; monochrome?: boolean; sharpCorners?: boolean }) {
  return (
    <ul className={cn('flex items-center gap-2', className)} aria-label={`We accept ${NETWORKS.map((n) => n.name).join(', ')}`}>
      {NETWORKS.map((n) => (
        <li key={n.key}>
          <NetworkMark
            network={n.key}
            size={size}
            className={cn(monochrome && 'grayscale opacity-70', sharpCorners && 'rounded-none')}
          />
        </li>
      ))}
    </ul>
  )
}

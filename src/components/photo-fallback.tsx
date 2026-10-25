import { UserIcon } from '@heroicons/react/24/solid'
import { shopFallback } from '#/data/brand'
import { cn } from '#/lib/utils'

/**
 * Stands in for a missing photo: a person icon for authors and readers, a photo of books for shops and
 * publishers (picked by `seed`, so a shop keeps the same one). Size and shape come from className.
 */
export function PhotoFallback({ kind, seed = '', className }: { kind: 'person' | 'shop'; seed?: string; className?: string }) {
  if (kind === 'shop') return <img src={shopFallback(seed)} alt="" loading="lazy" className={cn('shrink-0 bg-sunken object-cover', className)} />
  return (
    <span className={cn('band flex shrink-0 items-center justify-center overflow-hidden', className)} aria-hidden>
      <UserIcon className="size-1/2 opacity-60" />
    </span>
  )
}

import { BuildingStorefrontIcon, UserIcon } from '@heroicons/react/24/solid'
import { cn } from '#/lib/utils'

const ICONS = { person: UserIcon, shop: BuildingStorefrontIcon } as const

/** Stands in for a missing photo: a person for authors and readers, a shopfront for shops and publishers. Size and shape come from className. */
export function PhotoFallback({ kind, className }: { kind: keyof typeof ICONS; className?: string }) {
  const Icon = ICONS[kind]
  return (
    <span className={cn('band flex shrink-0 items-center justify-center overflow-hidden', className)} aria-hidden>
      <Icon className="size-1/2 opacity-60" />
    </span>
  )
}

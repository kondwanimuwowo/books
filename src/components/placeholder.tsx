import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

/**
 * One component for loading and empty. `shapes` sketches the real content.
 * loading: the shapes shimmer. empty: the shimmer stops, the shapes fade into the page and
 * `children` (a short line and the one action) rises over them. Staying mounted across the
 * switch is what makes loading-to-empty a fade instead of a jump.
 */
export function Placeholder({
  mode,
  label,
  shapes,
  children,
  className,
}: {
  mode: 'loading' | 'empty'
  label: string
  shapes: ReactNode
  children?: ReactNode
  className?: string
}) {
  const empty = mode === 'empty'
  return (
    <div className={cn('relative', className)} aria-busy={!empty} aria-label={empty ? undefined : label} role={empty ? undefined : 'status'}>
      <div aria-hidden className={cn('pointer-events-none select-none', !empty && 'is-loading')}>
        {shapes}
      </div>
      <div aria-hidden className="placeholder-fade pointer-events-none absolute inset-0" data-on={empty} />
      {empty && <div className="rise absolute inset-x-0 bottom-0 flex flex-col items-center px-4 pb-6 text-center">{children}</div>}
    </div>
  )
}

/** The short line and single action shown over a faded placeholder. */
export function EmptyMessage({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <>
      <p className="text-xl font-bold tracking-[-0.02em]">{title}</p>
      {action && <div className="mt-5">{action}</div>}
    </>
  )
}

function Bone({ className }: { className?: string }) {
  return <div className={cn('bone rounded-md', className)} />
}

/* Shape sets: each mirrors the real layout it stands in for. */

export function CoverGridShapes({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <div key={i}>
          <Bone className="aspect-[2/3] w-full" />
          <Bone className="mt-3 h-3.5 w-4/5" />
          <Bone className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function ShelfShapes() {
  return (
    <div className="flex gap-5 overflow-hidden">
      {Array.from({ length: 7 }, (_, i) => (
        <div key={i} className="w-[136px] shrink-0 sm:w-[156px]">
          <Bone className="aspect-[2/3] w-full" />
          <Bone className="mt-3 h-3.5 w-4/5" />
          <Bone className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function RowShapes({ count = 3, cover = true }: { count?: number; cover?: boolean }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="card flex items-center gap-5 p-4">
          {cover && <Bone className="aspect-[2/3] w-11 shrink-0" />}
          <div className="flex-1 space-y-2">
            <Bone className="h-4 w-3/5" />
            <Bone className="h-3 w-2/5" />
          </div>
          <Bone className="h-4 w-16" />
        </div>
      ))}
    </div>
  )
}

/** Rows in a dropdown of books: a small cover, a title, a byline. */
export function OptionShapes({ count = 3 }: { count?: number }) {
  return (
    <div className="py-1">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-2">
          <Bone className="aspect-[2/3] w-9 shrink-0" />
          <div className="flex-1 space-y-2">
            <Bone className="h-3.5 w-3/5" />
            <Bone className="h-3 w-2/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ParcelShapes() {
  return (
    <div className="card overflow-hidden">
      <div className="flex justify-between border-b border-line px-4 py-3">
        <Bone className="h-3.5 w-40" />
        <Bone className="h-3 w-20" />
      </div>
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-4 border-b border-line p-4 last:border-0">
          <Bone className="aspect-[2/3] w-16 shrink-0" />
          <div className="flex-1 space-y-2 pt-1">
            <Bone className="h-4 w-2/3" />
            <Bone className="h-3 w-1/4" />
            <Bone className="mt-3 h-9 w-28 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function CopyShapes() {
  return (
    <div className="space-y-2">
      {[0, 1].map((i) => (
        <div key={i} className="rounded-lg p-3.5 shadow-[inset_0_0_0_1px_var(--color-line)]">
          <div className="flex justify-between">
            <Bone className="h-4 w-28" />
            <Bone className="h-5 w-14" />
          </div>
          <Bone className="mt-2 h-3 w-36" />
        </div>
      ))}
    </div>
  )
}

export function PageShapes({ children }: { children: ReactNode }) {
  return (
    <div className="page py-8 lg:py-10">
      <Bone className="h-9 w-56" />
      <Bone className="mt-2 h-3.5 w-24" />
      <div className="mt-8">{children}</div>
    </div>
  )
}

export function BookPageShapes() {
  return (
    <div className="page py-6 sm:py-10">
      <Bone className="mb-6 h-3.5 w-32" />
      <div className="grid gap-8 md:grid-cols-[220px_1fr] lg:grid-cols-[260px_1fr_360px] lg:gap-10">
        <Bone className="mx-auto aspect-[2/3] w-44 md:w-full" />
        <div className="space-y-3">
          <Bone className="h-9 w-4/5" />
          <Bone className="h-4 w-1/3" />
          <div className="space-y-2 pt-6">
            {['w-full', 'w-[96%]', 'w-[92%]', 'w-[98%]', 'w-3/5'].map((w) => (
              <Bone key={w} className={cn('h-3.5', w)} />
            ))}
          </div>
        </div>
        <div className="card p-5">
          <Bone className="h-5 w-24" />
          <div className="mt-4">
            <CopyShapes />
          </div>
          <Bone className="mt-5 h-11 w-full rounded-full" />
        </div>
      </div>
    </div>
  )
}

export function StatShapes() {
  return (
    <div className="space-y-6">
      <Bone className="h-12 w-48" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="card p-5">
            <Bone className="h-3 w-20" />
            <Bone className="mt-3 h-7 w-10" />
          </div>
        ))}
      </div>
    </div>
  )
}

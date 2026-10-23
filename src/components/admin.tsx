import { useRouteContext } from '@tanstack/react-router'
import { MagnifyingGlassIcon } from '@heroicons/react/20/solid'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'
import { Placeholder, RowShapes } from './placeholder'

export function StatTile({ label, value, hint, alert = false }: { label: string; value: ReactNode; hint?: string; alert?: boolean }) {
  return (
    <div className="card p-5">
      <p className="eyebrow">{label}</p>
      <p className={cn('mt-2 text-3xl font-bold tracking-[-0.03em] tabular-nums', alert && 'text-danger')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-subtle">{hint}</p>}
    </div>
  )
}

export function StatusPill({ label, tone }: { label: string; tone: string }) {
  return <span className={cn('inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap', tone)}>{label}</span>
}

export function AdminSearch({ value, placeholder, onSearch }: { value: string; placeholder: string; onSearch: (q: string) => void }) {
  const [q, setQ] = useState(value)
  useEffect(() => setQ(value), [value])
  return (
    <form
      role="search"
      className="relative max-w-md"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(q.trim())
      }}
    >
      <MagnifyingGlassIcon className="pointer-events-none size-4 absolute top-1/2 left-4 -translate-y-1/2 text-subtle" aria-hidden />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input rounded-full pl-10" />
    </form>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <Placeholder mode="empty" label="Empty" shapes={<RowShapes cover={false} />}>
      <p className="text-lg font-bold tracking-[-0.02em]">{children}</p>
    </Placeholder>
  )
}

export function PageHeader({ title, description }: { title: string; description?: ReactNode }) {
  return (
    <header className="mb-8">
      <h1 className="text-2xl sm:text-3xl">{title}</h1>
      {description && <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p>}
    </header>
  )
}

/** Admin runs on its own host, so public pages are linked by absolute URL. */
export function useStoreUrl() {
  const { admin } = useRouteContext({ from: '/admin' })
  return (path: string) => `${admin.appOrigin}${path}`
}

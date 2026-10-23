import { Search } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

export function StatTile({ label, value, hint, alert = false }: { label: string; value: ReactNode; hint?: string; alert?: boolean }) {
  return (
    <div className="card p-5">
      <p className="eyebrow">{label}</p>
      <p className={cn('mt-2 text-3xl font-semibold tabular-nums', alert && 'text-danger-700')}>{value}</p>
      {hint && <p className="mt-1 text-xs text-neutral-600">{hint}</p>}
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
      <Search size={16} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-neutral-600" aria-hidden />
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className="input rounded-full pl-10" />
    </form>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="card p-8 text-center text-neutral-700">{children}</p>
}

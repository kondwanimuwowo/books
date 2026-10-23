import type { ReactNode } from 'react'
import { NAME_ENTRY } from '#/data/brand'

/** Phones: just the form. Desktop: the form beside the name, set like a dictionary entry. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="lg:grid lg:min-h-[calc(100dvh-5rem)] lg:grid-cols-[1fr_1.1fr]">
      <aside aria-hidden className="band hidden flex-col justify-end p-14 lg:flex">
        <p className="text-7xl leading-none font-extrabold tracking-[-0.05em]">{NAME_ENTRY.word}</p>
        <p className="mt-4 text-sm tracking-[0.08em] text-on-deep-muted uppercase">{NAME_ENTRY.grammar}</p>
        <p className="mt-3 max-w-xs text-2xl leading-snug">{NAME_ENTRY.meaning}</p>
      </aside>
      <div className="page flex items-start justify-center py-12 sm:py-20 lg:items-center">
        <div className="rise w-full max-w-sm">
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-subtle">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

import type { ReactNode } from 'react'

export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="page flex justify-center py-12 sm:py-20">
      <div className="rise w-full max-w-sm">
        <h1 className="text-3xl">{title}</h1>
        {subtitle && <p className="mt-2 text-neutral-700">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6 text-sm text-neutral-700">{footer}</div>}
      </div>
    </div>
  )
}

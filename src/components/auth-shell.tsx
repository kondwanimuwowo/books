import { useCanGoBack, useRouter } from '@tanstack/react-router'
import { ArrowLeftIcon } from '@heroicons/react/20/solid'
import type { ReactNode } from 'react'
import { NAME_ENTRY } from '#/data/brand'
import { Logo } from './site-header'

/** These pages have no store header: Back returns where they came from, the logo leads home. Desktop sets the name beside the form like a dictionary entry. */
export function AuthShell({ title, subtitle, children, footer }: { title: string; subtitle?: string; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1fr_1.1fr]">
      <aside aria-hidden className="band hidden flex-col justify-end p-14 lg:flex">
        <p className="text-7xl leading-none font-bold tracking-[-0.05em]">{NAME_ENTRY.word}</p>
        <p className="mt-4 max-w-xs text-2xl leading-snug text-on-deep-muted">{NAME_ENTRY.meaning}</p>
      </aside>
      <div className="page flex flex-col py-8 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <BackButton />
          <Logo />
        </div>
        <div className="rise mx-auto my-auto w-full max-w-sm py-12">
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-subtle">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

/** The page they came from on this site, or home when they arrived here directly (a link in an email). */
function BackButton() {
  const router = useRouter()
  const canGoBack = useCanGoBack()
  return (
    <button
      type="button"
      onClick={() => (canGoBack ? router.history.back() : void router.navigate({ to: '/' }))}
      className="btn btn-ghost btn-sm -ml-3 gap-1.5 text-muted"
    >
      <ArrowLeftIcon className="size-4" aria-hidden />
      Back
    </button>
  )
}

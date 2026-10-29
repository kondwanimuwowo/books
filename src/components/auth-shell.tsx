import { Link, useCanGoBack, useRouter } from '@tanstack/react-router'
import { ArrowLeftIcon } from '@heroicons/react/20/solid'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { getCoverWall } from '#/functions/catalog.functions'
import { CoverWallBackdrop, useCoverReveal } from './cover-wall'
import { NAME_ENTRY } from '#/data/brand'
import { AUTH_COPY } from '#/data/auth'
import { cn } from '#/lib/utils'
import { Logo } from './site-header'

/** These pages have no store header: Back returns where they came from, the logo leads home. Desktop sets the name beside the form like a dictionary entry. */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
  mode,
  next,
}: {
  title: string
  subtitle?: string
  children: ReactNode
  footer?: ReactNode
  /** Sign in and Create account side by side, so landing on the wrong one costs one tap. */
  mode?: 'signin' | 'signup'
  next?: string
}) {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[1fr_1.1fr]">
      <NameEntry />
      <div className="page flex flex-col py-8 sm:py-10">
        <div className="flex items-center justify-between gap-4">
          <BackButton />
          <Logo />
        </div>
        <div className="rise mx-auto my-auto w-full max-w-sm py-12">
          {mode && <ModeSwitch mode={mode} next={next} />}
          <h1 className="text-3xl sm:text-4xl">{title}</h1>
          {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 text-sm text-subtle">{footer}</div>}
        </div>
      </div>
    </div>
  )
}

/** Desktop only: the name like a dictionary entry, over the cover wall from the home page. */
function NameEntry() {
  const [tiles, setTiles] = useState<string[]>([])
  const { reveal, onPointerMove, onPointerLeave } = useCoverReveal()
  // Decorative, so it loads after the form is usable, and only where the panel shows.
  useEffect(() => {
    if (!window.matchMedia('(min-width: 64rem)').matches) return
    void getCoverWall().then(setTiles, () => {})
  }, [])

  return (
    <aside
      aria-hidden
      className="band relative hidden flex-col justify-end overflow-hidden p-14 lg:flex"
      onPointerMove={tiles.length ? onPointerMove : undefined}
      onPointerLeave={tiles.length ? onPointerLeave : undefined}
    >
      {tiles.length > 0 && (
        <div className="rise absolute inset-0">
          <CoverWallBackdrop tiles={tiles} reveal={reveal} />
        </div>
      )}
      <div className={cn('relative', tiles.length > 0 && 'frost w-fit rounded-xl px-8 py-7')}>
        <p className="text-7xl leading-none font-bold tracking-[-0.05em]">{NAME_ENTRY.word}</p>
        <p className="mt-4 max-w-xs text-2xl leading-snug text-on-deep-muted">{NAME_ENTRY.meaning}</p>
      </div>
    </aside>
  )
}

function ModeSwitch({ mode, next }: { mode: 'signin' | 'signup'; next?: string }) {
  const tab = (active: boolean) =>
    cn(
      'flex h-8 items-center justify-center rounded-full text-[13px] font-medium no-underline transition-colors',
      active ? 'bg-surface text-ink shadow-[0_0_0_1px_var(--color-line)]' : 'text-muted hover:text-ink',
    )
  return (
    <nav aria-label="Account" className="mb-8 grid grid-cols-2 rounded-full bg-sunken p-0.5">
      <Link to="/login" search={{ next }} replace aria-current={mode === 'signin' ? 'page' : undefined} className={tab(mode === 'signin')}>
        {AUTH_COPY.signIn}
      </Link>
      <Link to="/signup" search={{ next }} replace aria-current={mode === 'signup' ? 'page' : undefined} className={tab(mode === 'signup')}>
        {AUTH_COPY.createAccount}
      </Link>
    </nav>
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

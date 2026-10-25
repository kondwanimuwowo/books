import { Link } from '@tanstack/react-router'
import { ArrowRightStartOnRectangleIcon, ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid'
import type { ReactNode } from 'react'
import { signOut } from '#/functions/auth.functions'
import { ADMIN_NAV } from '#/data/admin'
import { Wordmark } from './wordmark'

function AdminMark() {
  return (
    <Link to="/admin" className="flex items-center gap-2 text-ink no-underline hover:text-ink">
      <Wordmark className="h-5" />
      <span className="eyebrow">Admin</span>
    </Link>
  )
}

function useSignOut() {
  return async () => {
    await signOut()
    // A fresh page load, so nothing from the signed-in session survives.
    window.location.assign('/admin/login')
  }
}

const sideItem = 'flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-medium no-underline transition-colors'

export function AdminShell({ email, storeUrl, children }: { email: string; storeUrl: string; children: ReactNode }) {
  const signOutAndLeave = useSignOut()

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="glass-bar sticky top-0 hidden h-dvh flex-col px-4 py-6 lg:flex">
        <div className="px-3">
          <AdminMark />
        </div>
        <nav className="mt-8 space-y-1" aria-label="Admin">
          {ADMIN_NAV.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact }}
              className={sideItem}
              activeProps={{ className: 'bg-accent-soft text-accent-soft-ink hover:text-accent-soft-ink' }}
              inactiveProps={{ className: 'text-ink hover:bg-sunken hover:text-ink' }}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-line pt-4">
          <a href={storeUrl} target="_blank" rel="noreferrer" className={`${sideItem} text-ink hover:bg-sunken hover:text-ink`}>
            <ArrowTopRightOnSquareIcon className="size-5" aria-hidden />
            View store
          </a>
          <p className="truncate px-3 pt-3 text-xs text-subtle" title={email}>
            {email}
          </p>
          <button type="button" onClick={() => void signOutAndLeave()} className={`${sideItem} w-full text-ink hover:bg-sunken`}>
            <ArrowRightStartOnRectangleIcon className="size-5" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="glass-bar sticky top-0 z-30 lg:hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <AdminMark />
            <button type="button" onClick={() => void signOutAndLeave()} className="btn btn-ghost btn-sm" aria-label="Sign out">
              <ArrowRightStartOnRectangleIcon className="size-5" aria-hidden />
            </button>
          </div>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Admin">
            {ADMIN_NAV.map(({ to, label, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                className="pill h-8 shrink-0 px-3 no-underline"
                activeProps={{ className: 'bg-accent-soft text-accent-soft-ink hover:text-accent-soft-ink' }}
                inactiveProps={{ className: 'text-ink hover:bg-sunken hover:text-ink' }}
              >
                {label}
              </Link>
            ))}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-8 lg:py-10">{children}</main>
      </div>
    </div>
  )
}

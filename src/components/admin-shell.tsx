import { Link, useNavigate, useRouter } from '@tanstack/react-router'
import { ExternalLink, LogOut } from 'lucide-react'
import type { ReactNode } from 'react'
import { signOut } from '#/functions/auth.functions'
import { ADMIN_NAV } from '#/data/admin'

function Wordmark() {
  return (
    <Link to="/admin" className="flex items-baseline gap-2 text-ink no-underline hover:text-ink">
      <span className="text-xl leading-none font-extrabold tracking-[-0.03em]">
        kuwala<span className="font-light text-accent-700">books</span>
      </span>
      <span className="eyebrow">Admin</span>
    </Link>
  )
}

function useSignOut() {
  const router = useRouter()
  const navigate = useNavigate()
  return async () => {
    await signOut()
    await router.invalidate()
    await navigate({ to: '/admin/login' })
  }
}

const sideItem = 'flex items-center gap-3 rounded-lg px-3 py-2 text-[15px] font-medium no-underline transition-colors'

export function AdminShell({ email, storeUrl, children }: { email: string; storeUrl: string; children: ReactNode }) {
  const signOutAndLeave = useSignOut()

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh flex-col bg-white px-4 py-6 shadow-sm lg:flex">
        <div className="px-3">
          <Wordmark />
        </div>
        <nav className="mt-8 space-y-1" aria-label="Admin">
          {ADMIN_NAV.map(({ to, label, icon: Icon, exact }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact }}
              className={sideItem}
              activeProps={{ className: 'bg-accent-100 text-accent-800 hover:text-accent-800' }}
              inactiveProps={{ className: 'text-neutral-800 hover:bg-neutral-100 hover:text-ink' }}
            >
              <Icon size={18} strokeWidth={1.75} aria-hidden />
              {label}
            </Link>
          ))}
        </nav>
        <div className="mt-auto space-y-1 border-t border-neutral-200 pt-4">
          <a href={storeUrl} target="_blank" rel="noreferrer" className={`${sideItem} text-neutral-800 hover:bg-neutral-100 hover:text-ink`}>
            <ExternalLink size={18} strokeWidth={1.75} aria-hidden />
            View store
          </a>
          <p className="truncate px-3 pt-3 text-xs text-neutral-600" title={email}>
            {email}
          </p>
          <button type="button" onClick={() => void signOutAndLeave()} className={`${sideItem} w-full text-neutral-800 hover:bg-neutral-100`}>
            <LogOut size={18} strokeWidth={1.75} aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 bg-white shadow-sm lg:hidden">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <Wordmark />
            <button type="button" onClick={() => void signOutAndLeave()} className="btn btn-ghost btn-sm" aria-label="Sign out">
              <LogOut size={16} aria-hidden />
            </button>
          </div>
          <nav className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-2" aria-label="Admin">
            {ADMIN_NAV.map(({ to, label, exact }) => (
              <Link
                key={to}
                to={to}
                activeOptions={{ exact }}
                className="pill h-8 shrink-0 px-3 no-underline"
                activeProps={{ className: 'bg-accent-100 text-accent-800 hover:text-accent-800' }}
                inactiveProps={{ className: 'text-neutral-800 hover:bg-neutral-100 hover:text-ink' }}
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

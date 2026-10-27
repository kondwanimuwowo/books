import { Link, Outlet, createFileRoute, useLoaderData } from '@tanstack/react-router'
import { signOut } from '#/functions/auth.functions'
import { activeTab, inactiveTab, tabClass } from '#/components/tabs'
import { SIGN_OUT_ICON, accountNav } from '#/data/navigation'
import { cn } from '#/lib/utils'
import { ScrollRow } from '#/components/scroll-row'
import { CheckBadgeIcon } from '@heroicons/react/16/solid'
import { KIND_COPY, VERIFICATION_LABELS } from '#/data/onboarding'
import type { SellerKind } from '#/data/listing-options'

export const Route = createFileRoute('/_authed/account')({
  head: () => ({ meta: [{ title: 'Your account | Kuwala Books' }] }),
  component: AccountLayout,
})

function RoleChip({ role }: { role: { kind: SellerKind | null; verified: boolean; pending: boolean } }) {
  const label = role.kind ? KIND_COPY[role.kind].label : KIND_COPY.individual.label
  const status = role.verified ? VERIFICATION_LABELS.approved : role.pending ? VERIFICATION_LABELS.pending : null
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-medium text-accent-soft-ink">
      {role.verified && <CheckBadgeIcon className="size-3.5" aria-hidden />}
      {status ? `${label} · ${status}` : label}
    </span>
  )
}

const sideItem = 'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[15px] no-underline transition-colors'

function AccountLayout() {
  const { user } = useLoaderData({ from: '__root__' })
  const nav = accountNav(!!user?.sellerSlug, !!user?.isAuthor)
  const leave = async () => {
    await signOut()
    // A fresh page load, so nothing from the signed-in session (the header's name, cached account data) survives.
    window.location.assign('/')
  }

  return (
    <div className="page max-w-6xl py-8 lg:py-12">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="truncate text-4xl sm:text-5xl">{user?.displayName.split(' ')[0] ?? 'Account'}</h1>
          <p className="mt-2 flex min-w-0 items-center gap-2.5 text-sm text-subtle">
            {user && <RoleChip role={user.role} />}
            <span className="truncate">{user?.email}</span>
          </p>
        </div>
        <button type="button" className="btn btn-ghost btn-sm -mr-2 shrink-0 gap-1.5 text-subtle lg:hidden" onClick={() => void leave()}>
          <SIGN_OUT_ICON className="size-4" aria-hidden />
          Sign out
        </button>
      </header>

      {/* Phones: a row of tabs. Desktop: a menu beside the page. */}
      <ScrollRow className="-mx-4 mt-6 sm:-mx-6 lg:hidden">
        <nav aria-label="Account" className="flex w-max gap-2 px-4 py-1 sm:px-6">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              activeOptions={{ exact: item.exact }}
              className={cn(tabClass, 'gap-1.5 pl-3.5')}
              activeProps={activeTab}
              inactiveProps={inactiveTab}
            >
              <item.icon className="size-4 opacity-80" aria-hidden />
              {item.label}
            </Link>
          ))}
        </nav>
      </ScrollRow>

      <div className="mt-8 lg:mt-10 lg:grid lg:grid-cols-[13rem_1fr] lg:gap-12">
        <nav aria-label="Account" className="hidden lg:block">
          <ul className="space-y-0.5">
            {nav.map((item) => (
              <li key={item.to}>
                <Link
                  to={item.to}
                  activeOptions={{ exact: item.exact }}
                  className={sideItem}
                  activeProps={{ className: 'bg-accent-soft font-medium text-accent-soft-ink hover:text-accent-soft-ink' }}
                  inactiveProps={{ className: 'text-muted hover:bg-sunken hover:text-ink' }}
                >
                  <item.icon className="size-4 shrink-0 opacity-80" aria-hidden />
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
          <button type="button" className={cn(sideItem, 'mt-6 w-full text-left text-subtle hover:bg-sunken hover:text-ink')} onClick={() => void leave()}>
            <SIGN_OUT_ICON className="size-4 shrink-0 opacity-80" aria-hidden />
            Sign out
          </button>
        </nav>
        <div className="min-w-0">
          <Outlet />
        </div>
      </div>
    </div>
  )
}

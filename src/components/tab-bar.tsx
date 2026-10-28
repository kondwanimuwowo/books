import { Link, useRouterState } from '@tanstack/react-router'
import { TABS } from '#/data/navigation'
import { cn } from '#/lib/utils'
import { useBag } from './providers'

/** Phones only: the five places people go most, always one tap away. */
export function TabBar({ signedIn }: { signedIn: boolean }) {
  const path = useRouterState({ select: (s) => s.location.pathname })
  const { count, ready } = useBag()
  const items = ready ? count : 0
  return (
    <nav aria-label="Tabs" className="tab-bar fixed inset-x-0 bottom-0 z-30 sm:hidden">
      <ul className="grid grid-cols-5">
        {TABS.map((tab) => {
          const active = tab.match(path)
          const Icon = tab.icon
          const to = tab.key === 'account' && !signedIn ? '/welcome' : tab.to
          return (
            <li key={tab.key}>
              <Link
                to={to}
                aria-current={active ? 'page' : undefined}
                aria-label={tab.key === 'bag' && items ? `Bag, ${items} ${items === 1 ? 'book' : 'books'}` : undefined}
                className={cn(
                  'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium no-underline transition-colors',
                  active ? 'text-accent-ink' : 'text-subtle hover:text-ink',
                )}
              >
                <span className="relative">
                  <Icon className="size-6" aria-hidden />
                  {tab.key === 'bag' && items > 0 && (
                    <span
                      key={items}
                      className="rise absolute -top-1.5 -right-2.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[10px] leading-none text-on-accent tabular-nums"
                    >
                      {items}
                    </span>
                  )}
                </span>
                {tab.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

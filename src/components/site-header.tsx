import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { MagnifyingGlassIcon, ShoppingBagIcon } from '@heroicons/react/20/solid'
import { useEffect, useState } from 'react'
import { FOOTER_NAV } from '#/data/navigation'
import { useHideOnScroll } from './use-hide-on-scroll'
import { cn } from '#/lib/utils'
import { useBag, useCurrency } from './providers'

interface HeaderUser {
  displayName: string
  sellerSlug: string | null
  adminUrl: string | null
}

export function Logo({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'inverse' }) {
  const inverse = tone === 'inverse'
  return (
    <Link
      to="/"
      className={cn(
        'text-2xl leading-none font-bold tracking-[-0.04em] no-underline',
        inverse ? 'text-on-accent hover:text-on-accent' : 'text-ink hover:text-ink',
        className,
      )}
    >
      kuwala<span className={cn('font-normal', inverse ? 'text-on-deep-muted' : 'text-accent-ink')}>books</span>
    </Link>
  )
}

function CurrencySwitch() {
  const { currency, rate, setCurrency } = useCurrency()
  if (!rate) return null
  return (
    <div className="inline-flex rounded-full bg-on-accent/10 p-0.5 text-xs font-medium" role="group" aria-label="Show prices in">
      {(['ZMW', 'USD'] as const).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setCurrency(c)}
          aria-pressed={currency === c}
          className={cn('h-7 rounded-full px-2.5 transition-colors', currency === c ? 'bg-on-accent text-deep' : 'text-on-deep-muted hover:text-on-accent')}
        >
          {c}
        </button>
      ))}
    </div>
  )
}

function SearchBox() {
  const navigate = useNavigate()
  const current = useRouterState({ select: (s) => (s.location.pathname === '/search' ? ((s.location.search as { q?: string }).q ?? '') : '') })
  const [q, setQ] = useState(current)
  useEffect(() => setQ(current), [current])

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault()
        void navigate({ to: '/search', search: q.trim() ? { q: q.trim() } : {} })
      }}
    >
      <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-on-deep-muted" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="A title, an author, or an ISBN"
        aria-label="Search books"
        className="h-11 w-full rounded-full bg-on-accent/10 pr-4 pl-11 text-[15px] text-on-accent transition-colors placeholder:text-on-deep-muted focus:bg-on-accent/15 focus:shadow-[inset_0_0_0_1.5px_var(--color-on-deep-muted)] focus:outline-none md:h-12"
      />
    </form>
  )
}

const navLink = 'btn btn-sm text-on-deep-muted hover:bg-on-accent/10 hover:text-on-accent'

export function SiteHeader({ user }: { user: HeaderUser | null }) {
  const { count, ready } = useBag()
  const items = ready ? count : 0
  // Tucks away while reading down the page, returns the moment you scroll up or tab into it.
  const { ref, hidden, reveal } = useHideOnScroll<HTMLElement>()
  return (
    <header ref={ref} data-hidden={hidden} onFocus={reveal} className="header-bar sticky top-0 z-30">
      <div className="page flex flex-wrap items-center gap-x-6 gap-y-3 py-3 md:flex-nowrap md:py-4">
        <Logo tone="inverse" />
        <div className="order-last w-full md:order-none md:flex-1">
          <SearchBox />
        </div>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2" aria-label="Main">
          <Link to="/search" className={cn(navLink, 'hidden sm:inline-flex')}>
            Browse
          </Link>
          <Link to="/sell" className={navLink}>
            Sell
          </Link>
          {user?.adminUrl && (
            <a href={user.adminUrl} className={cn(navLink, 'hidden sm:inline-flex')}>
              Admin
            </a>
          )}
          <Link to={user ? '/account' : '/login'} className={cn(navLink, 'max-w-[140px]')}>
            <span className="truncate">{user ? user.displayName.split(' ')[0] : 'Sign in'}</span>
          </Link>
          <CurrencySwitch />
          {/* Outlined, not filled: the bag is always here, so it must never outshout a page's own primary action. */}
          <Link
            to="/bag"
            className="btn btn-sm ml-1 gap-1.5 px-3 text-on-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-on-accent)_30%,transparent)] hover:bg-on-accent/10 hover:text-on-accent"
            aria-label={items ? `Your bag, ${items} ${items === 1 ? 'book' : 'books'}` : 'Your bag is empty'}
          >
            <ShoppingBagIcon className="size-4" aria-hidden />
            {items > 0 && (
              <span
                key={items}
                className="rise inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-on-accent px-1.5 text-xs text-deep tabular-nums"
              >
                {items}
              </span>
            )}
          </Link>
        </nav>
      </div>
    </header>
  )
}

const footerLink = 'text-on-deep-muted no-underline hover:text-on-accent'

export function SiteFooter() {
  return (
    <footer className="band mt-20">
      <div className="page grid gap-10 py-12 text-sm sm:grid-cols-[1.4fr_1fr_1fr]">
        <Logo tone="inverse" className="text-xl" />
        {FOOTER_NAV.map((group) => (
          <nav key={group.title} aria-label={group.title} className="space-y-3">
            <p className="eyebrow text-on-deep-muted">{group.title}</p>
            <ul className="space-y-2">
              {group.links.map((link) => (
                <li key={link.label}>
                  <Link to={link.to} search={'search' in link ? link.search : undefined} className={footerLink}>
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="page flex flex-wrap items-center justify-between gap-3 border-t border-on-deep-muted/20 py-5 text-xs text-on-deep-muted">
        <p>&copy; {new Date().getFullYear()} Kuwala Books</p>
        <nav aria-label="Legal" className="flex gap-5">
          <Link to="/terms" className={footerLink}>
            Terms
          </Link>
          <Link to="/privacy" className={footerLink}>
            Privacy
          </Link>
        </nav>
      </div>
    </footer>
  )
}

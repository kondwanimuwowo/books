import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Bars3Icon, MagnifyingGlassIcon, ShoppingBagIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { useEffect, useRef, useState } from 'react'
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
  const { currency, rate, rateNote, setCurrency } = useCurrency()
  if (!rate) return null
  return (
    <div className="inline-flex rounded-full bg-on-accent/10 p-0.5 text-xs font-medium" role="group" aria-label="Show prices in" title={rateNote ?? undefined}>
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
  const menu = useMobileMenu(ref, hidden)
  const account = { to: user ? '/account' : '/login', label: user ? user.displayName.split(' ')[0] : 'Sign in' } as const
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
          <Link to="/sell" className={cn(navLink, 'hidden sm:inline-flex')}>
            Sell
          </Link>
          {user?.adminUrl && (
            <a href={user.adminUrl} className={cn(navLink, 'hidden sm:inline-flex')}>
              Admin
            </a>
          )}
          <Link to={account.to} className={cn(navLink, 'hidden max-w-[140px] sm:inline-flex')}>
            <span className="truncate">{account.label}</span>
          </Link>
          <div className="hidden sm:block">
            <CurrencySwitch />
          </div>
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
          <button
            ref={menu.buttonRef}
            type="button"
            className={cn(navLink, 'px-2.5 sm:hidden')}
            aria-label="Menu"
            aria-expanded={menu.open}
            aria-controls="mobile-menu"
            onClick={() => menu.setOpen(!menu.open)}
          >
            {menu.open ? <XMarkIcon className="size-5" aria-hidden /> : <Bars3Icon className="size-5" aria-hidden />}
          </button>
        </nav>
      </div>

      {/* Phones: the header's links, in a panel that drops from under it. */}
      <nav
        id="mobile-menu"
        aria-label="Menu"
        data-open={menu.open}
        className="menu-panel band absolute inset-x-0 top-full border-t border-on-deep-muted/15 shadow-lg sm:hidden"
      >
        <ul className="page py-2">
          <MenuLink to="/search" first>
            Browse
          </MenuLink>
          <MenuLink to="/sell">Sell</MenuLink>
          <MenuLink to={account.to}>{user ? 'Your account' : 'Sign in'}</MenuLink>
          {user?.adminUrl && (
            <li>
              <a href={user.adminUrl} className={menuItem} tabIndex={menu.open ? undefined : -1}>
                Admin
              </a>
            </li>
          )}
        </ul>
        <div className="page flex items-center justify-between gap-4 border-t border-on-deep-muted/15 py-4">
          <span className="text-sm text-on-deep-muted">
            Prices in
            <RateNote className="block text-xs" />
          </span>
          <CurrencySwitch />
        </div>
      </nav>
    </header>
  )
}

const menuItem = 'block py-3 text-lg font-medium text-on-accent no-underline hover:text-on-deep-muted'

function MenuLink({ to, first = false, children }: { to: '/search' | '/sell' | '/account' | '/login'; first?: boolean; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className={menuItem} data-first-menu-item={first || undefined}>
        {children}
      </Link>
    </li>
  )
}

/** Open state for the phone menu: closes on navigation, Escape, a tap outside, or when the header tucks away. */
function useMobileMenu(headerRef: React.RefObject<HTMLElement | null>, headerHidden: boolean) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const href = useRouterState({ select: (s) => s.location.href })

  useEffect(() => setOpen(false), [href])
  useEffect(() => {
    if (headerHidden) setOpen(false)
  }, [headerHidden])

  useEffect(() => {
    if (!open) return
    headerRef.current?.querySelector<HTMLElement>('[data-first-menu-item]')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onPointer = (e: PointerEvent) => {
      if (!headerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointer)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointer)
    }
  }, [open, headerRef])

  return { open, setOpen, buttonRef }
}

/** Dated, so a USD guide price is never mistaken for a live one. */
function RateNote({ className, usdOnly = false }: { className?: string; usdOnly?: boolean }) {
  const { currency, rateNote } = useCurrency()
  if (!rateNote || (usdOnly && currency !== 'USD')) return null
  return <span className={className}>{usdOnly ? `USD is a guide: ${rateNote}. You pay in kwacha.` : rateNote}</span>
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
        <p>
          &copy; {new Date().getFullYear()} Kuwala Books
          <RateNote usdOnly className="mt-1 block" />
        </p>
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

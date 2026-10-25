import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Bars3Icon, MagnifyingGlassIcon, ShoppingBagIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { useEffect, useRef, useState } from 'react'
import { FOOTER_NAV } from '#/data/navigation'
import { LEGAL_ORDER, LEGAL_PAGES } from '#/data/legal'
import { quickSearch } from '#/functions/catalog.functions'
import { BookCover } from './book'
import { LoadingLine, Spinner } from './loading-line'
import { useHideOnScroll } from './use-hide-on-scroll'
import { cn } from '#/lib/utils'
import { useBag, useCurrency } from './providers'
import { PhotoFallback } from './photo-fallback'
import { Wordmark } from './wordmark'

interface HeaderUser {
  displayName: string
  sellerSlug: string | null
  adminUrl: string | null
}

export function Logo({ className, tone = 'default' }: { className?: string; tone?: 'default' | 'inverse' }) {
  return (
    <Link to="/" className="w-fit shrink-0 no-underline">
      <Wordmark tone={tone} className={className} />
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

type Quick = Awaited<ReturnType<typeof quickSearch>>
type QuickItem = { key: string; to: 'book' | 'author' | 'all'; slug: string }

const QUICK_DELAY_MS = 250

/** The header search: results drop down as you type; Enter on nothing highlighted runs the full search. */
function SearchBox() {
  const navigate = useNavigate()
  const current = useRouterState({ select: (s) => (s.location.pathname === '/search' ? ((s.location.search as { q?: string }).q ?? '') : '') })
  const [q, setQ] = useState(current)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [found, setFound] = useState<{ q: string; result: Quick } | null>(null)
  useEffect(() => setQ(current), [current])
  const term = q.trim()
  const searching = open && term.length >= 2

  useEffect(() => {
    if (!searching) return
    let cancelled = false
    const timer = setTimeout(() => {
      quickSearch({ data: { q: term } })
        .then((result) => !cancelled && setFound({ q: term, result }))
        .catch(() => undefined)
    }, QUICK_DELAY_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [term, searching])

  const fresh = searching && found?.q === term ? found.result : null
  // While the next answer loads, the last one stays (dimmed) rather than the list blinking away on every key.
  const stale = searching && !fresh && found && (found.result.books.length || found.result.authors.length) ? found.result : null
  const result = fresh ?? stale
  const loading = searching && !fresh
  // A submitted search runs on /search; the box shows it's working until that page arrives.
  const navigating = useRouterState({ select: (s) => s.isLoading && s.location.pathname === '/search' })
  const items: QuickItem[] = result
    ? [
        ...result.books.map((b) => ({ key: `b-${b.slug}`, to: 'book' as const, slug: b.slug })),
        ...result.authors.map((a) => ({ key: `a-${a.slug}`, to: 'author' as const, slug: a.slug })),
        { key: 'all', to: 'all' as const, slug: '' },
      ]
    : []

  const go = (item: QuickItem | undefined) => {
    setOpen(false)
    setActive(-1)
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur()
    if (item?.to === 'book') return void navigate({ to: '/books/$slug', params: { slug: item.slug } })
    if (item?.to === 'author') return void navigate({ to: '/authors/$slug', params: { slug: item.slug } })
    void navigate({ to: '/search', search: term ? { q: term } : {} })
  }

  return (
    <form
      role="search"
      className="relative w-full"
      onSubmit={(e) => {
        e.preventDefault()
        go(fresh ? items[active] : undefined)
      }}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false)
      }}
    >
      {loading || navigating ? (
        <Spinner className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-on-deep-muted" />
      ) : (
        <MagnifyingGlassIcon className="pointer-events-none absolute top-1/2 left-4 size-[18px] -translate-y-1/2 text-on-deep-muted" aria-hidden />
      )}
      <input
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setActive(-1)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!fresh) return
          if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, items.length - 1))
          } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, -1))
          } else if (e.key === 'Escape') {
            setOpen(false)
          }
        }}
        role="combobox"
        aria-expanded={!!fresh}
        aria-controls="quick-results"
        aria-autocomplete="list"
        aria-activedescendant={fresh && active >= 0 ? `quick-${items[active]?.key}` : undefined}
        autoComplete="off"
        placeholder="A title, an author, or an ISBN"
        aria-label="Search books"
        className="h-11 w-full rounded-full bg-on-accent/10 pr-4 pl-11 text-[15px] text-on-accent transition-colors placeholder:text-on-deep-muted focus:bg-on-accent/15 focus:shadow-[inset_0_0_0_1.5px_var(--color-on-deep-muted)] focus:outline-none md:h-12"
      />
      {searching && (
        <div className="card drop-in absolute inset-x-0 top-full z-40 mt-2 max-h-[min(70vh,34rem)] overflow-y-auto text-left">
          {result ? (
            <QuickResults result={result} term={term} items={items} active={active} stale={!fresh} onHover={setActive} onPick={go} />
          ) : (
            <LoadingLine kind="find" className="px-4 py-3.5" />
          )}
        </div>
      )}
    </form>
  )
}

function QuickResults({
  result,
  term,
  items,
  active,
  stale,
  onHover,
  onPick,
}: {
  result: Quick
  term: string
  items: QuickItem[]
  active: number
  stale: boolean
  onHover: (i: number) => void
  onPick: (item: QuickItem) => void
}) {
  const { format } = useCurrency()
  const row = (i: number) => ({
    id: `quick-${items[i].key}`,
    role: 'option' as const,
    'aria-selected': i === active,
    // Keeps focus in the input so the list doesn't close before the click lands.
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(),
    onMouseEnter: () => onHover(i),
    onClick: () => onPick(items[i]),
    className: cn('flex cursor-pointer items-center gap-3 px-4 py-2 text-ink', i === active && 'bg-sunken'),
  })
  const authorStart = result.books.length
  return (
    <div className={cn('py-1 transition-opacity duration-200', stale && 'pointer-events-none opacity-50')} aria-busy={stale}>
      <ul id="quick-results" role="listbox" aria-label="Search results">
        {!result.books.length && !result.authors.length && <li className="px-4 py-3 text-sm text-subtle">No books match “{term}” yet</li>}
        {result.books.map((b, i) => (
          <li key={b.slug} {...row(i)}>
            <div className="w-9 shrink-0">
              <BookCover src={b.coverUrl} title={b.title} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-[15px] font-medium">{b.title}</p>
              <p className="line-clamp-1 text-sm text-subtle">{b.authorNames}</p>
            </div>
            <span className={cn('shrink-0 text-sm tabular-nums', b.fromPriceNgwee !== null ? 'font-medium' : 'text-subtle')}>
              {b.fromPriceNgwee !== null ? `from ${format(b.fromPriceNgwee)}` : 'None for sale'}
            </span>
          </li>
        ))}
        {result.authors.length > 0 && <li role="presentation" className="eyebrow px-4 pt-3 pb-1">Authors</li>}
        {result.authors.map((a, i) => (
          <li key={a.slug} {...row(authorStart + i)}>
            <PhotoFallback kind="person" className="size-9 rounded-md" />
            <span className="min-w-0 flex-1 truncate text-[15px] font-medium">{a.name}</span>
            <span className="shrink-0 text-sm text-subtle tabular-nums">
              {a.bookCount} {a.bookCount === 1 ? 'book' : 'books'}
            </span>
          </li>
        ))}
        <li {...row(items.length - 1)} className={cn(row(items.length - 1).className, 'mt-1 border-t border-line py-3 text-sm font-medium text-accent-ink')}>
          {result.total > result.books.length ? `See all ${result.total} results for “${term}”` : `Search for “${term}”`}
        </li>
      </ul>
    </div>
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
        <Logo tone="inverse" className="h-5" />
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
        <nav aria-label="Legal" className="flex flex-wrap gap-x-5 gap-y-2">
          {LEGAL_ORDER.map((page) => (
            <Link key={page} to="/legal/$page" params={{ page }} className={footerLink}>
              {LEGAL_PAGES[page].title}
            </Link>
          ))}
        </nav>
      </div>
    </footer>
  )
}

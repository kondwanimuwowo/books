import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import type { LinkProps } from '@tanstack/react-router'
import { Bars3Icon, ChatBubbleLeftRightIcon, EnvelopeIcon, MagnifyingGlassIcon, PhoneIcon, ShoppingBagIcon, XMarkIcon } from '@heroicons/react/20/solid'
import { useEffect, useRef, useState } from 'react'
import { FOOTER_NAV, MENU_LINKS, TABS } from '#/data/navigation'
import { PAY_COPY } from '#/data/payments'
import { PaymentMarks } from './payment-marks'
import { LEGAL_CONTACT, LEGAL_ORDER, LEGAL_PAGES } from '#/data/legal'
import { COOKIE_COPY } from '#/data/cookies'
import { openCookieSettings } from '#/lib/consent'
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

export function SiteHeader({ user, tabs }: { user: HeaderUser | null; tabs: boolean }) {
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
            className={cn(
              'btn btn-sm ml-1 gap-1.5 px-3 text-on-accent shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--color-on-accent)_30%,transparent)] hover:bg-on-accent/10 hover:text-on-accent',
              // Phones with the tab bar reach the bag from there.
              tabs && 'hidden sm:inline-flex',
            )}
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
          {/* Pages without the tab bar still need its main places. */}
          {!tabs && (
            <>
              <MenuLink to="/search" icon={TABS[1].icon}>
                Browse
              </MenuLink>
              <MenuLink to="/sell" icon={TABS[2].icon}>
                Sell
              </MenuLink>
              <MenuLink to={account.to} icon={TABS[4].icon}>
                {user ? 'Your account' : 'Sign in'}
              </MenuLink>
            </>
          )}
          {MENU_LINKS.map((link) => (
            <MenuLink key={link.to} to={link.to} icon={link.icon}>
              {link.label}
            </MenuLink>
          ))}
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

const menuItem = 'flex items-center gap-3 py-3 text-lg font-medium text-on-accent no-underline hover:text-on-deep-muted'

function MenuLink({ to, icon: Icon, children }: { to: LinkProps['to']; icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <li>
      <Link to={to} className={menuItem}>
        <Icon className="size-5 shrink-0 text-on-deep-muted" aria-hidden />
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
    headerRef.current?.querySelector<HTMLElement>('#mobile-menu a')?.focus()
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
const FOOTER_PHONE = '+260976999510'
const FOOTER_FACEBOOK = 'https://facebook.com/kuwalabooks'

export function SiteFooter() {
  return (
    <footer className="band mt-14 sm:mt-20">
      <div className="page grid grid-cols-2 gap-x-8 gap-y-8 py-9 text-sm sm:grid-cols-3 sm:gap-10 sm:py-12 lg:grid-cols-[1.3fr_1fr_1fr_1fr_1.4fr]">
        <div className="col-span-2 sm:col-span-1">
          <Logo tone="inverse" className="h-5" />
        </div>
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
            {group.title === 'Sell' && (
              <div className="space-y-2 pt-3">
                <p className="eyebrow text-on-deep-muted">{PAY_COPY.footer}</p>
                <PaymentMarks size="sm" monochrome />
              </div>
            )}
          </nav>
        ))}
        <nav aria-label="Legal" className="space-y-3">
          <p className="eyebrow text-on-deep-muted">Legal</p>
          <ul className="space-y-2">
            {LEGAL_ORDER.map((page) => (
              <li key={page}>
                <Link to="/legal/$page" params={{ page }} className={footerLink}>
                  {LEGAL_PAGES[page].title}
                </Link>
              </li>
            ))}
            <li>
              <button type="button" onClick={openCookieSettings} className={footerLink}>
                {COOKIE_COPY.settings}
              </button>
            </li>
          </ul>
        </nav>
        <address className="space-y-3 not-italic">
          <p className="eyebrow text-on-deep-muted">Contact</p>
          <ul className="space-y-3">
            <li>
              <a href={`mailto:${LEGAL_CONTACT}`} className={`flex items-center gap-2 ${footerLink}`}>
                <EnvelopeIcon aria-hidden className="size-4 shrink-0" />
                <span>{LEGAL_CONTACT}</span>
              </a>
            </li>
            <li>
              <a href={`https://wa.me/${FOOTER_PHONE.replace(/\D/g, '')}`} className={`flex items-center gap-2 ${footerLink}`} target="_blank" rel="noreferrer">
                <ChatBubbleLeftRightIcon aria-hidden className="size-4 shrink-0" />
                <span>WhatsApp {FOOTER_PHONE}</span>
              </a>
            </li>
            <li>
              <a href={`tel:${FOOTER_PHONE}`} className={`flex items-center gap-2 ${footerLink}`}>
                <PhoneIcon aria-hidden className="size-4 shrink-0" />
                <span>Call {FOOTER_PHONE}</span>
              </a>
            </li>
            <li>
              <a href={FOOTER_FACEBOOK} className={`flex items-center gap-2 ${footerLink}`} target="_blank" rel="noreferrer">
                <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 shrink-0 fill-current">
                  <path d="M13.5 21v-8.2h2.8l.4-3.2h-3.2V7.5c0-.9.3-1.6 1.6-1.6h1.7V3.1c-.3 0-1.4-.1-2.6-.1-2.6 0-4.4 1.6-4.4 4.5v2.1H7v3.2h2.8V21h3.7Z" />
                </svg>
                <span>Facebook</span>
              </a>
            </li>
          </ul>
        </address>
      </div>
      <div className="border-t border-on-deep-muted/20">
        <div className="page flex flex-col gap-3 py-5 text-xs text-on-deep-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            &copy; {new Date().getFullYear()} Kuwala Books
            <RateNote usdOnly className="mt-1 block" />
          </p>
        </div>
      </div>
    </footer>
  )
}

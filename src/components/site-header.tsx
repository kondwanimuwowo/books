import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { Search, ShoppingBag } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '#/lib/utils'
import { useBag, useCurrency } from './providers'

interface HeaderUser {
  displayName: string
  sellerSlug: string | null
  isAdmin: boolean
}

export function Logo({ className }: { className?: string }) {
  return (
    <Link to="/" className={cn('text-2xl leading-none font-extrabold tracking-[-0.03em] text-ink no-underline hover:text-ink', className)}>
      kuwala<span className="font-light text-accent-700">books</span>
    </Link>
  )
}

function CurrencySwitch() {
  const { currency, rate, setCurrency } = useCurrency()
  if (!rate) return null
  return (
    <div className="inline-flex rounded-full bg-neutral-100 p-0.5 text-xs font-semibold" role="group" aria-label="Currency">
      {(['ZMW', 'USD'] as const).map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => setCurrency(c)}
          aria-pressed={currency === c}
          className={cn('h-7 rounded-full px-2.5 transition-colors', currency === c ? 'bg-white text-ink shadow-sm' : 'text-neutral-600 hover:text-ink')}
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
      <Search size={18} className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-neutral-600" aria-hidden />
      <input
        type="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Search by title, author or ISBN"
        aria-label="Search books"
        className="h-12 w-full rounded-full bg-neutral-100 pr-4 pl-11 text-[15px] text-ink placeholder:text-neutral-600 focus:bg-white focus:shadow-[inset_0_0_0_1.5px_var(--color-accent-700)] focus:outline-none"
      />
    </form>
  )
}

export function SiteHeader({ user }: { user: HeaderUser | null }) {
  const { count, ready } = useBag()
  return (
    <header className="sticky top-0 z-30 bg-white shadow-sm">
      <div className="page flex flex-wrap items-center gap-x-6 gap-y-3 py-3 md:flex-nowrap md:py-4">
        <Logo />
        <div className="order-last w-full md:order-none md:flex-1">
          <SearchBox />
        </div>
        <nav className="ml-auto flex items-center gap-1 sm:gap-2">
          <Link to="/search" className="btn-ghost btn btn-sm hidden sm:inline-flex">
            Browse
          </Link>
          <Link to="/sell" className="btn-ghost btn btn-sm">
            Sell
          </Link>
          {user?.isAdmin && (
            <Link to="/admin" className="btn-ghost btn btn-sm">
              Admin
            </Link>
          )}
          <Link to={user ? '/account' : '/login'} className="btn-ghost btn btn-sm max-w-[140px]">
            <span className="truncate">{user ? user.displayName.split(' ')[0] : 'Sign in'}</span>
          </Link>
          <CurrencySwitch />
          <Link to="/bag" className="btn btn-primary btn-sm ml-1" aria-label={`Bag, ${count} items`}>
            <ShoppingBag size={16} aria-hidden />
            <span className="tabular-nums">{ready ? count : 0}</span>
          </Link>
        </nav>
      </div>
    </header>
  )
}

export function SiteFooter() {
  return (
    <footer className="mt-20 bg-white shadow-[0_-1px_0_var(--color-neutral-200)]">
      <div className="page grid gap-8 py-10 text-sm sm:grid-cols-3">
        <div className="space-y-2">
          <Logo className="text-xl" />
          <p className="max-w-xs text-neutral-700">Books from readers, authors and bookshops across Zambia. Paid safely, delivered to every province.</p>
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Shop</p>
          <ul className="space-y-1.5 text-neutral-700">
            <li>
              <Link to="/search" search={{ zambian: true }}>
                Zambian authors
              </Link>
            </li>
            <li>
              <Link to="/search" search={{ condition: 'used' }}>
                Used books
              </Link>
            </li>
            <li>
              <Link to="/search" search={{ category: 'textbooks' }}>
                School textbooks
              </Link>
            </li>
          </ul>
        </div>
        <div className="space-y-2">
          <p className="eyebrow">Sell</p>
          <ul className="space-y-1.5 text-neutral-700">
            <li>
              <Link to="/sell">List a book</Link>
            </li>
            <li>
              <Link to="/account/sales">Your sales</Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="page border-t border-neutral-200 py-5 text-xs text-neutral-600">
        Prices in Zambian kwacha. USD amounts are a guide at today&rsquo;s rate; you are always charged in kwacha.
      </div>
    </footer>
  )
}

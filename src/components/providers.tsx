import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { formatMoney } from '#/lib/money'
import type { Currency } from '#/lib/money'

// ---- Bag -------------------------------------------------------------------

export interface BagLine {
  listingId: string
  quantity: number
}

interface BagContextValue {
  lines: BagLine[]
  count: number
  ready: boolean
  add: (listingId: string, quantity?: number) => void
  setQuantity: (listingId: string, quantity: number) => void
  remove: (listingId: string) => void
  clear: () => void
}

const BagContext = createContext<BagContextValue | null>(null)
const BAG_KEY = 'kb_bag'

function readBag(): BagLine[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(BAG_KEY) ?? '[]')
    if (!Array.isArray(parsed)) return []
    return parsed.filter((l): l is BagLine => typeof l?.listingId === 'string' && Number.isInteger(l?.quantity) && l.quantity > 0)
  } catch {
    return []
  }
}

export function BagProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<BagLine[]>([])
  const [ready, setReady] = useState(false)

  useEffect(() => {
    setLines(readBag())
    setReady(true)
    const sync = (e: StorageEvent) => e.key === BAG_KEY && setLines(readBag())
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [])

  const update = useCallback((fn: (prev: BagLine[]) => BagLine[]) => {
    setLines((prev) => {
      const next = fn(prev)
      try {
        localStorage.setItem(BAG_KEY, JSON.stringify(next))
      } catch {
        // Private mode: the bag still works for this tab.
      }
      return next
    })
  }, [])

  const value = useMemo<BagContextValue>(
    () => ({
      lines,
      ready,
      count: lines.reduce((n, l) => n + l.quantity, 0),
      add: (listingId, quantity = 1) =>
        update((prev) => {
          const existing = prev.find((l) => l.listingId === listingId)
          return existing ? prev.map((l) => (l.listingId === listingId ? { ...l, quantity: l.quantity + quantity } : l)) : [...prev, { listingId, quantity }]
        }),
      setQuantity: (listingId, quantity) =>
        update((prev) => (quantity < 1 ? prev.filter((l) => l.listingId !== listingId) : prev.map((l) => (l.listingId === listingId ? { ...l, quantity } : l)))),
      remove: (listingId) => update((prev) => prev.filter((l) => l.listingId !== listingId)),
      clear: () => update(() => []),
    }),
    [lines, ready, update],
  )

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>
}

export function useBag() {
  const ctx = useContext(BagContext)
  if (!ctx) throw new Error('useBag must be used inside BagProvider')
  return ctx
}

// ---- Currency --------------------------------------------------------------

interface CurrencyContextValue {
  currency: Currency
  rate: number | null
  setCurrency: (currency: Currency) => void
  format: (ngwee: number) => string
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null)
export const CURRENCY_COOKIE = 'kb_currency'

export function CurrencyProvider({ initial, rate, children }: { initial: Currency; rate: number | null; children: ReactNode }) {
  const [currency, setState] = useState<Currency>(rate ? initial : 'ZMW')

  const value = useMemo<CurrencyContextValue>(
    () => ({
      currency,
      rate,
      setCurrency: (next) => {
        setState(next)
        document.cookie = `${CURRENCY_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
      },
      format: (ngwee) => formatMoney(ngwee, currency, rate),
    }),
    [currency, rate],
  )

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>
}

export function useCurrency() {
  const ctx = useContext(CurrencyContext)
  if (!ctx) throw new Error('useCurrency must be used inside CurrencyProvider')
  return ctx
}

/** Prices always show in the chosen currency; USD is a guide, the charge is in kwacha. */
export function Price({ ngwee, className }: { ngwee: number; className?: string }) {
  const { format } = useCurrency()
  return <span className={className}>{format(ngwee)}</span>
}

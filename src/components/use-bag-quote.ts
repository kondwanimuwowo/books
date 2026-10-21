import { useEffect, useState } from 'react'
import { quoteBag } from '#/functions/orders.functions'
import type { Province } from '#/data/zambia'
import { useBag } from './providers'

export type BagQuote = Awaited<ReturnType<typeof quoteBag>>

/** Prices the bag on the server; with a destination it also returns delivery options per seller. */
export function useBagQuote(to: { town: string; province: Province } | null) {
  const { lines, ready } = useBag()
  const [quote, setQuote] = useState<BagQuote | null>(null)
  const key = JSON.stringify([lines, to])

  useEffect(() => {
    if (!ready) return
    if (!lines.length) {
      setQuote({ problems: [], groups: [] })
      return
    }
    let cancelled = false
    quoteBag({ data: { lines, to } })
      .then((q) => !cancelled && setQuote(q))
      .catch(() => !cancelled && setQuote({ problems: ['We couldn’t load your bag. Check your connection and refresh'], groups: [] }))
    return () => {
      cancelled = true
    }
    // `key` captures lines and destination by value.
  }, [key, ready])

  return quote
}

import { useEffect, useMemo, useState } from 'react'
import { quoteBag } from '#/functions/orders.functions'
import type { Province } from '#/data/zambia'
import { useBag } from './providers'

export type BagQuote = Awaited<ReturnType<typeof quoteBag>>

/** Prices the bag on the server; with a destination it also returns delivery options per seller. */
export function useBagQuote(to: { town: string; province: Province } | null) {
  const { lines, ready, remove } = useBag()
  const [quote, setQuote] = useState<BagQuote | null>(null)
  // Why lines were removed, kept after the re-quote that no longer mentions them.
  const [notices, setNotices] = useState<string[]>([])
  const key = JSON.stringify([lines, to])

  useEffect(() => {
    if (!ready) return
    if (!lines.length) {
      setQuote({ problems: [], dropped: [], groups: [] })
      return
    }
    let cancelled = false
    quoteBag({ data: { lines, to } })
      .then((q) => {
        if (cancelled) return
        setQuote(q)
        if (q.dropped.length) {
          setNotices((n) => [...new Set([...n, ...q.problems])])
          q.dropped.forEach(remove)
        }
      })
      .catch(() => !cancelled && setQuote({ problems: ['We couldn’t load your bag. Check your connection and refresh'], dropped: [], groups: [] }))
    return () => {
      cancelled = true
    }
    // `key` captures lines and destination by value.
  }, [key, ready])

  // The same object until the quote or notices change: callers depend on it in effects.
  return useMemo(() => quote && { ...quote, problems: [...new Set([...notices, ...quote.problems])] }, [quote, notices])
}

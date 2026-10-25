import { useRouter } from '@tanstack/react-router'
import { CheckBadgeIcon, StarIcon } from '@heroicons/react/16/solid'
import { useState } from 'react'
import { rateParcel } from '#/functions/ratings.functions'
import { REPUTATION_COPY, SCORE_LABELS } from '#/data/reputation'
import { cn } from '#/lib/utils'
import { Alert, useAction } from './form'

interface Rating {
  average: number
  count: number
}

export function RatingMark({ rating, className }: { rating: Rating | null; className?: string }) {
  if (!rating) return null
  return (
    <span className={cn('inline-flex items-center gap-1 text-sm tabular-nums', className)}>
      <StarIcon className="size-3.5 text-gold" aria-hidden />
      <span className="font-medium text-ink">{rating.average.toFixed(1)}</span>
      <span className="text-subtle">
        ({rating.count}
        <span className="sr-only"> {rating.count === 1 ? 'rating' : 'ratings'}</span>)
      </span>
    </span>
  )
}

interface Standing {
  books: number
  badge: string | null
  rating: Rating | null
  trusted: boolean
}

/** What a seller sees about a buyer: never what they bought, only how they've been as a customer. */
export function ReaderStanding({ standing, className }: { standing: Standing | null; className?: string }) {
  if (!standing || (!standing.books && !standing.rating)) return <span className={cn('text-xs text-subtle', className)}>New to Kuwala</span>
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-xs', className)}>
      {standing.trusted && (
        <span className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 font-medium text-accent-soft-ink">
          <CheckBadgeIcon className="size-3.5" aria-hidden />
          {REPUTATION_COPY.trusted}
        </span>
      )}
      {standing.badge && <span className="font-medium text-ink">{standing.badge}</span>}
      <span className="text-subtle">
        {standing.books} {standing.books === 1 ? 'book' : 'books'}
      </span>
      {standing.rating && <RatingMark rating={standing.rating} className="text-xs" />}
    </span>
  )
}

/** Five stars and a few tags, once a parcel has arrived. Nothing to type. */
export function RateParcel({ sellerOrderId, title, tags, current }: { sellerOrderId: string; title: string; tags: readonly string[]; current: number | null }) {
  const router = useRouter()
  const [score, setScore] = useState(0)
  const [hover, setHover] = useState(0)
  const [picked, setPicked] = useState<string[]>([])
  const [sent, setSent] = useState(false)
  const send = useAction(async () => {
    await rateParcel({ data: { sellerOrderId, score, tags: picked } })
    setSent(true)
    await router.invalidate()
  })

  if (current !== null) {
    return (
      <p className="inline-flex items-center gap-1.5 text-sm text-muted">
        You rated it <Stars value={current} /> {sent && <span className="rise text-xs text-subtle">{REPUTATION_COPY.thanks}</span>}
      </p>
    )
  }

  const shown = hover || score
  return (
    <div className="space-y-3">
      <p className="font-medium">{title}</p>
      <div className="flex items-center gap-3">
        <div role="radiogroup" aria-label="Rating" className="flex" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={score === n}
              aria-label={`${n} of 5, ${SCORE_LABELS[n]}`}
              onClick={() => setScore(n)}
              onMouseEnter={() => setHover(n)}
              className="grid size-10 place-items-center rounded-full transition-transform duration-150 ease-out active:scale-90"
            >
              <StarIcon className={cn('size-7 transition-colors duration-150', n <= shown ? 'text-gold' : 'text-line-strong')} aria-hidden />
            </button>
          ))}
        </div>
        <span className="text-sm text-muted" aria-live="polite">
          {SCORE_LABELS[shown]}
        </span>
      </div>
      {score > 0 && (
        <div className="rise flex flex-wrap gap-2">
          {tags.map((tag) => {
            const on = picked.includes(tag)
            return (
              <button
                key={tag}
                type="button"
                aria-pressed={on}
                onClick={() => setPicked(on ? picked.filter((t) => t !== tag) : [...picked, tag])}
                className={cn('pill transition-[background-color,transform] duration-150 active:scale-[0.97]', on ? 'bg-accent-soft text-accent-soft-ink' : 'bg-sunken text-ink hover:bg-sunken-strong')}
              >
                {tag}
              </button>
            )
          })}
        </div>
      )}
      {send.error && <Alert>{send.error}</Alert>}
      {score > 0 && (
        <button type="button" className="btn btn-secondary btn-sm" disabled={send.pending} onClick={() => void send.run()}>
          {send.pending ? 'Sending…' : 'Send rating'}
        </button>
      )}
    </div>
  )
}

function Stars({ value }: { value: number }) {
  return (
    <span className="inline-flex" role="img" aria-label={`${value} of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <StarIcon key={n} className={cn('size-4', n <= value ? 'text-gold' : 'text-line-strong')} aria-hidden />
      ))}
    </span>
  )
}

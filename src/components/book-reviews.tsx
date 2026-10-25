import { CheckBadgeIcon, StarIcon } from '@heroicons/react/16/solid'
import { REVIEW_COPY } from '#/data/reputation'
import { cn, formatDate } from '#/lib/utils'
import { ShareOnWhatsApp } from './share'

interface Review {
  id: string
  score: number
  body: string | null
  createdAt: Date | string
  reviewer: string
  badge: string | null
  verified: boolean
}

/** What readers who bought the book thought. Hidden entirely until there's a first review. */
export function BookReviews({ slug, title, reviews }: { slug: string; title: string; reviews: { average: number | null; count: number; items: Review[] } }) {
  if (!reviews.count || reviews.average === null) return null
  return (
    <section aria-labelledby="reviews" className="mt-14 max-w-3xl scroll-mt-24" id="reviews">
      <div className="mb-5 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="reviews" className="text-xl">
          {REVIEW_COPY.heading}
        </h2>
        <span className="inline-flex items-center gap-1 tabular-nums">
          <StarIcon className="size-4 text-gold" aria-hidden />
          <span className="font-medium">{reviews.average.toFixed(1)}</span>
          <span className="text-sm text-subtle">
            from {reviews.count} {reviews.count === 1 ? 'reader' : 'readers'}
          </span>
        </span>
      </div>
      <ul className="space-y-6">
        {reviews.items.map((r) => (
          <li key={r.id} id={`review-${r.id}`} className="scroll-mt-24">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
              <span className="inline-flex" role="img" aria-label={`${r.score} of 5`}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <StarIcon key={n} className={cn('size-4', n <= r.score ? 'text-gold' : 'text-line-strong')} aria-hidden />
                ))}
              </span>
              <span className="font-medium">{r.reviewer}</span>
              {r.badge && <span className="text-xs text-subtle">{r.badge}</span>}
              {r.verified && (
                <span className="inline-flex items-center gap-1 text-xs text-success">
                  <CheckBadgeIcon className="size-3.5" aria-hidden />
                  {REVIEW_COPY.verified}
                </span>
              )}
              <span className="text-xs text-subtle">{formatDate(r.createdAt)}</span>
            </div>
            {r.body && <p className="mt-2 leading-relaxed whitespace-pre-line">{r.body}</p>}
            {r.body && (
              <ShareOnWhatsApp
                className="mt-2"
                path={`/books/${slug}#review-${r.id}`}
                text={`“${r.body.length > 140 ? `${r.body.slice(0, 140).trimEnd()}…` : r.body}” ${r.reviewer} on ${title}, Kuwala Books`}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

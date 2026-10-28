import { createFileRoute, useRouter } from '@tanstack/react-router'
import { StarIcon } from '@heroicons/react/16/solid'
import { listReviews, setReviewHidden } from '#/functions/reviews.functions'
import { Empty, PageHeader, StatusPill, useStoreUrl } from '#/components/admin'
import { Alert, useAction } from '#/components/form'
import { Placeholder, RowShapes } from '#/components/placeholder'
import { REVIEW_COPY } from '#/data/reputation'
import { cn, formatDate } from '#/lib/utils'

export const Route = createFileRoute('/admin/_shell/reviews')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading reviews" shapes={<RowShapes cover={false} />} />,
  loader: () => listReviews(),
  component: Reviews,
})

type Review = Awaited<ReturnType<typeof listReviews>>[number]

function Reviews() {
  const reviews = Route.useLoaderData()
  return (
    <div className="space-y-5">
      <PageHeader title="Reviews" description="Newest first. Hide anything abusive, off-topic or trying to take buyers off Kuwala; phone numbers and links are already blocked." />
      {reviews.length ? (
        <ul className="space-y-3">
          {reviews.map((r) => (
            <ReviewRow key={r.id} review={r} />
          ))}
        </ul>
      ) : (
        <Empty>No reviews yet.</Empty>
      )}
    </div>
  )
}

function ReviewRow({ review: r }: { review: Review }) {
  const router = useRouter()
  const storeUrl = useStoreUrl()
  const toggle = useAction(async () => {
    await setReviewHidden({ data: { id: r.id, hidden: !r.hidden } })
    await router.invalidate()
  })
  return (
    <li className={cn('card space-y-2 p-4 sm:p-5', r.hidden && 'opacity-60')}>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="inline-flex" role="img" aria-label={`${r.score} of 5`}>
          {[1, 2, 3, 4, 5].map((n) => (
            <StarIcon key={n} className={cn('size-4', n <= r.score ? 'text-gold' : 'text-line-strong')} aria-hidden />
          ))}
        </span>
        <a href={storeUrl(`/books/${r.book.slug}#reviews`)} target="_blank" rel="noreferrer" className="font-medium">
          {r.book.title}
        </a>
        <span className="text-subtle">
          {r.reviewer ?? <em>{REVIEW_COPY.formerMember}</em>} · {formatDate(r.createdAt)}
        </span>
        {r.hidden && <StatusPill label={REVIEW_COPY.hidden} tone="bg-sunken text-muted" />}
      </div>
      {r.body && <p className="max-w-prose text-sm whitespace-pre-line">{r.body}</p>}
      {toggle.error && <Alert>{toggle.error}</Alert>}
      <button type="button" className="btn btn-ghost btn-sm" disabled={toggle.pending} onClick={() => void toggle.run()}>
        {r.hidden ? 'Show again' : 'Hide'}
      </button>
    </li>
  )
}

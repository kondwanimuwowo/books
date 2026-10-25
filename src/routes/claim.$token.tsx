import { Link, createFileRoute, useLoaderData } from '@tanstack/react-router'
import { useState } from 'react'
import { getClaim, stopInvites } from '#/functions/claims.functions'
import { PhotoFallback } from '#/components/photo-fallback'
import { Alert, useAction } from '#/components/form'
import { CLAIM_COPY } from '#/data/claims'

export const Route = createFileRoute('/claim/$token')({
  loader: ({ params }) => getClaim({ data: { token: params.token } }),
  head: () => ({ meta: [{ title: 'Claim your author page | Kuwala Books' }, { name: 'robots', content: 'noindex' }] }),
  component: ClaimPage,
})

function ClaimPage() {
  const claim = Route.useLoaderData()
  const { token } = Route.useParams()
  const { user } = useLoaderData({ from: '__root__' })
  const [stopped, setStopped] = useState(false)
  const stop = useAction(async () => {
    await stopInvites({ data: { token } })
    setStopped(true)
  })

  if (claim.state !== 'open' || stopped) {
    const message = stopped || claim.state === 'stopped' ? CLAIM_COPY.stopped : claim.state === 'claimed' ? CLAIM_COPY.claimed : CLAIM_COPY.expired
    return (
      <div className="page rise max-w-xl py-16">
        <p className="text-lg">{claim.state === 'missing' ? 'That link isn’t valid.' : message}</p>
        {claim.state !== 'missing' && (
          <Link to="/authors/$slug" params={{ slug: claim.author.slug }} className="btn btn-secondary mt-6">
            See the page
          </Link>
        )}
      </div>
    )
  }

  const { author } = claim
  const next = `/start-selling?author=${author.id}`
  return (
    <div className="page max-w-2xl py-10 lg:py-16">
      <h1 className="rise text-4xl sm:text-5xl">{CLAIM_COPY.title(author.name.split(' ')[0])}</h1>
      <p className="rise mt-3 text-muted">{CLAIM_COPY.line}</p>

      <div className="card rise mt-8 flex gap-5 p-5">
        {author.photoUrl ? (
          <img src={author.photoUrl} alt="" className="aspect-[2/3] w-20 shrink-0 rounded-md object-cover" />
        ) : (
          <PhotoFallback kind="person" className="aspect-[2/3] w-20 rounded-md" />
        )}
        <div className="min-w-0">
          <p className="text-xl font-bold">{author.name}</p>
          <p className="mt-0.5 text-sm text-subtle">
            {author.books} {author.books === 1 ? 'book' : 'books'} on Kuwala
          </p>
          {author.bio && <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-muted">{author.bio}</p>}
          <Link to="/authors/$slug" params={{ slug: author.slug }} className="mt-2 inline-block text-sm">
            See the page
          </Link>
        </div>
      </div>

      <ol className="mt-8 space-y-3">
        {CLAIM_COPY.steps.map((step, i) => (
          <li key={step} className="flex items-center gap-3">
            <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent-soft-ink tabular-nums">{i + 1}</span>
            <span>{step}</span>
          </li>
        ))}
      </ol>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        {user ? (
          <a href={next} className="btn btn-primary">
            {CLAIM_COPY.signedIn}
          </a>
        ) : (
          <>
            <Link to="/signup" search={{ next, invite: token }} className="btn btn-primary">
              {CLAIM_COPY.signUp}
            </Link>
            <Link to="/login" search={{ next }} className="btn btn-ghost">
              {CLAIM_COPY.haveAccount}
            </Link>
          </>
        )}
      </div>

      <div className="mt-14 border-t border-line pt-5">
        {stop.error && <Alert>{stop.error}</Alert>}
        <button type="button" className="text-sm text-subtle underline-offset-4 hover:text-ink hover:underline" disabled={stop.pending} onClick={() => void stop.run()}>
          {CLAIM_COPY.stop}
        </button>
      </div>
    </div>
  )
}

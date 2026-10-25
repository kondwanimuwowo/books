import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { decideVerification, listVerifications } from '#/functions/admin.functions'
import { Empty, PageHeader, useStoreUrl } from '#/components/admin'
import { Alert, Field, useAction } from '#/components/form'
import { Placeholder, RowShapes } from '#/components/placeholder'
import { formatDate } from '#/lib/utils'

export const Route = createFileRoute('/admin/_shell/verification')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading requests" shapes={<RowShapes cover={false} />} />,
  loader: () => listVerifications(),
  component: Verification,
})

type Request = Awaited<ReturnType<typeof listVerifications>>[number]

const DOCUMENT_LABELS = { id: 'NRC or passport', selfie: 'With the book', extra: 'Extra' } as const

function Verification() {
  const requests = Route.useLoaderData()
  return (
    <div className="space-y-5">
      <PageHeader title="Verification" description="Check the NRC matches the name and face, and the selfie shows the book. Documents are deleted once you decide." />
      {requests.length ? (
        <ul className="space-y-4">
          {requests.map((r) => (
            <RequestCard key={r.id} request={r} />
          ))}
        </ul>
      ) : (
        <Empty>No one waiting.</Empty>
      )}
    </div>
  )
}

/** Loose match: the network often has surnames first or middle names dropped. */
function namesMatch(a: string, b: string) {
  const words = (s: string) => new Set(s.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1))
  const left = words(a)
  return [...words(b)].filter((w) => left.has(w)).length >= 2
}

function RequestCard({ request: r }: { request: Request }) {
  const router = useRouter()
  const storeUrl = useStoreUrl()
  const [note, setNote] = useState('')
  const decide = useAction(async (decision: 'approved' | 'rejected' | 'needs_more') => {
    await decideVerification({ data: { requestId: r.id, decision, note: note.trim() || undefined } })
    await router.invalidate()
  })
  const payoutName = r.seller.payoutAccountName

  return (
    <li className="card space-y-5 p-4 sm:p-5">
      <div className="flex flex-wrap items-start gap-4">
        {r.seller.photoUrl && <img src={storeUrl(r.seller.photoUrl)} alt="" className="aspect-[2/3] w-16 rounded-md object-cover" />}
        <div className="min-w-0 flex-1 space-y-1 text-sm">
          <p className="text-base font-medium">
            <a href={storeUrl(`/sellers/${r.seller.slug}`)} target="_blank" rel="noreferrer">
              {r.seller.storeName}
            </a>{' '}
            <span className="font-normal text-subtle">· {r.seller.town} · sent {formatDate(r.createdAt)}</span>
          </p>
          <p>
            Legal name: <span className="font-medium">{r.legalName}</span>
          </p>
          <p>
            Mobile money name:{' '}
            {payoutName ? (
              <span className={namesMatch(payoutName, r.legalName) ? 'font-medium text-success' : 'font-medium text-danger'}>
                {payoutName} {namesMatch(payoutName, r.legalName) ? '(matches)' : '(differs)'}
              </span>
            ) : (
              <span className="text-subtle">payouts not set up yet</span>
            )}
          </p>
          <p>
            Claims:{' '}
            {r.author ? (
              <a href={storeUrl(`/authors/${r.author.slug}`)} target="_blank" rel="noreferrer">
                {r.author.name} ({r.author.books} {r.author.books === 1 ? 'book' : 'books'})
              </a>
            ) : (
              <span>a new author page named {r.seller.storeName}</span>
            )}
            <span className="text-subtle"> · {r.listings} active listings</span>
          </p>
          {r.invitedEmail && <p className="font-medium text-success">Signed up with the email we invited (found on their own site)</p>}
        </div>
      </div>

      {r.seller.bio && <p className="max-w-prose text-sm whitespace-pre-line text-muted">{r.seller.bio}</p>}

      <div className="grid gap-3 sm:grid-cols-3">
        {r.documents.map((d) => (
          <a key={d.key} href={`/admin-files/${d.key}`} target="_blank" rel="noreferrer" className="block space-y-1.5 no-underline">
            <img src={`/admin-files/${d.key}`} alt={DOCUMENT_LABELS[d.type]} className="aspect-[3/2] w-full rounded-lg bg-sunken object-contain" />
            <span className="text-xs text-subtle">{DOCUMENT_LABELS[d.type]}</span>
          </a>
        ))}
      </div>

      <Field label="Note to the author" hint="Needed to ask for more or decline. Sent by email.">
        <textarea className="input" rows={2} maxLength={600} value={note} onChange={(e) => setNote(e.target.value)} placeholder="The NRC photo is blurry. Please send a sharper one." />
      </Field>
      {decide.error && <Alert>{decide.error}</Alert>}
      <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-primary btn-sm" disabled={decide.pending || r.listings === 0} onClick={() => void decide.run('approved')}>
          Verify
        </button>
        <button type="button" className="btn btn-secondary btn-sm" disabled={decide.pending || !note.trim()} onClick={() => void decide.run('needs_more')}>
          Ask for more
        </button>
        <button type="button" className="btn btn-ghost btn-sm" disabled={decide.pending || !note.trim()} onClick={() => void decide.run('rejected')}>
          Decline
        </button>
        {r.listings === 0 && <span className="self-center text-xs text-subtle">Verify once they’ve listed a book.</span>}
      </div>
    </li>
  )
}

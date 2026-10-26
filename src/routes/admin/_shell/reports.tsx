import { createFileRoute, useRouter } from '@tanstack/react-router'
import { decideReport, listReports } from '#/functions/reports.functions'
import { Empty, PageHeader, StatusPill, useStoreUrl } from '#/components/admin'
import { BookCover } from '#/components/book'
import { Alert, useAction } from '#/components/form'
import { Placeholder, RowShapes } from '#/components/placeholder'
import { REPORT_REASONS, conditionLabel } from '#/data/listing-options'
import { formatDate } from '#/lib/utils'

export const Route = createFileRoute('/admin/_shell/reports')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading reports" shapes={<RowShapes />} />,
  loader: () => listReports(),
  component: Reports,
})

type Report = Awaited<ReturnType<typeof listReports>>[number]

const STATUS: Record<Report['status'], { label: string; tone: string }> = {
  open: { label: 'Open', tone: 'bg-warning-soft text-warning' },
  removed: { label: 'Taken down', tone: 'bg-danger-soft text-danger' },
  dismissed: { label: 'Dismissed', tone: 'bg-sunken text-muted' },
}

function Reports() {
  const reports = Route.useLoaderData()
  return (
    <div className="space-y-5">
      <PageHeader title="Reported copies" description="Readers flag photocopies, books marked as government, school, library or donated property, and misdescribed copies. Check the photos, then take it down or dismiss." />
      {reports.length ? (
        <ul className="space-y-3">
          {reports.map((r) => (
            <ReportRow key={r.id} report={r} />
          ))}
        </ul>
      ) : (
        <Empty>No reports.</Empty>
      )}
    </div>
  )
}

function ReportRow({ report: r }: { report: Report }) {
  const router = useRouter()
  const storeUrl = useStoreUrl()
  const decide = useAction(async (decision: 'removed' | 'dismissed') => {
    await decideReport({ data: { id: r.id, decision } })
    await router.invalidate()
  })
  const status = STATUS[r.status]
  return (
    <li className="card flex flex-wrap gap-4 p-4">
      <BookCover src={r.book.coverUrl ? storeUrl(r.book.coverUrl) : null} title={r.book.title} className="w-12 shrink-0" />
      <div className="min-w-0 flex-1 space-y-1 text-sm">
        <p className="flex flex-wrap items-center gap-2">
          <a href={storeUrl(`/books/${r.book.slug}`)} target="_blank" rel="noreferrer" className="text-base font-medium">
            {r.book.title}
          </a>
          <StatusPill label={status.label} tone={status.tone} />
        </p>
        <p className="text-muted">
          {conditionLabel(r.listing.condition)} copy from{' '}
          <a href={storeUrl(`/sellers/${r.seller.slug}`)} target="_blank" rel="noreferrer">
            {r.seller.storeName}
          </a>{' '}
          · reported {formatDate(r.createdAt)}
        </p>
        <p className="font-medium">{REPORT_REASONS.find((x) => x.value === r.reason)?.label}</p>
        {r.note && <p className="whitespace-pre-line text-muted">“{r.note}”</p>}
        {r.listing.photos.length > 0 && (
          <div className="flex gap-2 pt-1">
            {r.listing.photos.map((src) => (
              <a key={src} href={storeUrl(src)} target="_blank" rel="noreferrer">
                <img src={storeUrl(src)} alt="Photo of the reported copy" className="aspect-[3/4] w-16 rounded-md object-cover" />
              </a>
            ))}
          </div>
        )}
        {decide.error && <Alert>{decide.error}</Alert>}
      </div>
      {r.status === 'open' && (
        <div className="flex gap-2 self-start">
          <button type="button" className="btn btn-primary btn-sm" disabled={decide.pending} onClick={() => void decide.run('removed')}>
            Take down
          </button>
          <button type="button" className="btn btn-ghost btn-sm" disabled={decide.pending} onClick={() => void decide.run('dismissed')}>
            Dismiss
          </button>
        </div>
      )}
    </li>
  )
}

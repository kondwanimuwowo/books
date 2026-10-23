import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { listSellers, setSellerVerified } from '#/functions/admin.functions'
import { AdminSearch, Empty, PageHeader, StatusPill, useStoreUrl } from '#/components/admin'
import { VerifiedMark } from '#/components/book'
import { Alert, useAction } from '#/components/form'
import { SELLER_KINDS } from '#/data/listing-options'
import { formatDate } from '#/lib/utils'
import { Placeholder, RowShapes } from '#/components/placeholder'

export const Route = createFileRoute('/admin/_shell/sellers')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading sellers" shapes={<RowShapes cover={false} />} />,
  validateSearch: z.object({ q: z.string().optional() }),
  loaderDeps: ({ search }) => search,
  loader: ({ deps }) => listSellers({ data: deps }),
  component: Sellers,
})

type Seller = Awaited<ReturnType<typeof listSellers>>[number]

function Sellers() {
  const sellers = Route.useLoaderData()
  const { q } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })

  return (
    <div className="space-y-5">
      <PageHeader title="Sellers" description="Verify once you've checked ID or business papers." />
      <AdminSearch value={q ?? ''} placeholder="Search shop name, address or email" onSearch={(value) => void navigate({ search: value ? { q: value } : {} })} />
      {sellers.length ? (
        <ul className="space-y-3">
          {sellers.map((s) => (
            <SellerRow key={s.id} seller={s} />
          ))}
        </ul>
      ) : (
        <Empty>{q ? `No sellers match "${q}".` : 'No sellers yet.'}</Empty>
      )}
    </div>
  )
}

function SellerRow({ seller: s }: { seller: Seller }) {
  const router = useRouter()
  const storeUrl = useStoreUrl()
  const verify = useAction(async (verified: boolean) => {
    await setSellerVerified({ data: { sellerId: s.id, verified } })
    await router.invalidate()
  })
  const kind = SELLER_KINDS.find((k) => k.value === s.kind)?.label ?? s.kind

  return (
    <li className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          <a href={storeUrl(`/sellers/${s.slug}`)} target="_blank" rel="noreferrer">
            {s.storeName}
          </a>
          {s.verifiedAt && <VerifiedMark />}
          <StatusPill label={kind} tone="bg-sunken text-ink" />
        </p>
        <p className="text-sm text-muted">
          {s.town} · {s.email} · {s.phone}
        </p>
        <p className="text-xs text-subtle">
          Joined {formatDate(s.createdAt)} · {s.activeListings} active listings · {s.sales} sales ·{' '}
          {s.hasPayoutDetails ? 'Payout number set' : 'No payout number'}
        </p>
        {verify.error && <Alert>{verify.error}</Alert>}
      </div>
      {s.verifiedAt ? (
        <button type="button" className="btn btn-ghost btn-sm" disabled={verify.pending} onClick={() => void verify.run(false)}>
          Remove badge
        </button>
      ) : (
        <button type="button" className="btn btn-primary btn-sm" disabled={verify.pending} onClick={() => void verify.run(true)}>
          Verify
        </button>
      )}
    </li>
  )
}

import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { z } from 'zod'
import { listSellers, setSellerVerified } from '#/functions/admin.functions'
import { AdminSearch, Empty, StatusPill } from '#/components/admin'
import { VerifiedMark } from '#/components/book'
import { Alert, useAction } from '#/components/form'
import { SELLER_KINDS } from '#/data/listing-options'
import { formatDate } from '#/lib/utils'

export const Route = createFileRoute('/_authed/admin/sellers')({
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
  const verify = useAction(async (verified: boolean) => {
    await setSellerVerified({ data: { sellerId: s.id, verified } })
    await router.invalidate()
  })
  const kind = SELLER_KINDS.find((k) => k.value === s.kind)?.label ?? s.kind

  return (
    <li className="card flex flex-wrap items-center justify-between gap-4 p-4 sm:p-5">
      <div className="min-w-0 space-y-1">
        <p className="flex flex-wrap items-center gap-2 font-semibold">
          <Link to="/sellers/$slug" params={{ slug: s.slug }}>
            {s.storeName}
          </Link>
          {s.verifiedAt && <VerifiedMark />}
          <StatusPill label={kind} tone="bg-neutral-100 text-neutral-800" />
        </p>
        <p className="text-sm text-neutral-700">
          {s.town} · {s.email} · {s.phone}
        </p>
        <p className="text-xs text-neutral-600">
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

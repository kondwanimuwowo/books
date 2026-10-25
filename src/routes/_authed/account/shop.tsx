import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { getMySeller } from '#/functions/sell.functions'
import { getMyVerification } from '#/functions/verification.functions'
import { DeliveryForm, PayoutForm, SellerProfileForm } from '#/components/seller-forms'
import { VerificationForm } from '#/components/verification-form'
import { emptyVerify } from '#/components/onboarding/draft'
import { VerifiedMark } from '#/components/book'
import { Alert } from '#/components/form'
import { ONBOARDING } from '#/data/onboarding'
import { formatDate } from '#/lib/utils'

export const Route = createFileRoute('/_authed/account/shop')({
  loader: async () => {
    const mine = await getMySeller()
    return { ...mine, verification: mine.seller && !mine.seller.verified ? await getMyVerification() : null }
  },
  component: ShopSettings,
})

function ShopSettings() {
  const { seller, profile, verification } = Route.useLoaderData()

  if (!seller) {
    return (
      <div className="card rise max-w-xl p-6">
        <h2 className="text-2xl">Start selling</h2>
        <p className="mt-1 text-muted">A stall for your old books, an author page, or your whole bookshop. Two minutes to set up.</p>
        <Link to="/start-selling" className="btn btn-primary mt-5">
          Get started
        </Link>
      </div>
    )
  }

  const needsPayout = !seller.payoutAccountName

  const shop = (
    <section key="shop">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">Shop</h2>
        <div className="flex items-center gap-3 text-sm">
          {seller.verified && <VerifiedMark />}
          <Link to="/sellers/$slug" params={{ slug: seller.slug }}>
            View
          </Link>
        </div>
      </div>
      <SellerProfileForm
        primary={!needsPayout}
        submitLabel="Save"
        defaults={{
          storeName: seller.storeName,
          kind: seller.kind,
          bio: seller.bio,
          phone: seller.phone ?? profile?.phone ?? null,
          town: seller.town ?? profile?.town ?? null,
          province: seller.province ?? profile?.province ?? null,
          photoUrl: seller.photoUrl,
        }}
      />
    </section>
  )

  const payouts = (
    <section key="payouts">
      <h2 className="text-2xl">Payouts</h2>
      <p className="mt-1 mb-5 text-sm text-subtle">Paid here when the buyer confirms delivery.</p>
      <PayoutForm primary={needsPayout} current={{ phone: seller.payoutPhone, operator: seller.payoutOperator, accountName: seller.payoutAccountName }} />
    </section>
  )

  const verify = verification && (
    <section key="verify" className="lg:col-span-2">
      <Verification storeName={seller.storeName} isAuthor={seller.kind === 'author'} latest={verification.latest} />
    </section>
  )

  const delivery = (
    <section key="delivery" className="lg:col-span-2">
      <h2 className="text-2xl">Delivery</h2>
      <p className="mt-1 mb-5 text-sm text-subtle">Buyers only see the ways you send books.</p>
      <DeliveryForm current={{ deliveryMethods: seller.deliveryMethods, freeDeliveryOverNgwee: seller.freeDeliveryOverNgwee }} />
    </section>
  )

  // Whichever still needs doing comes first and carries the primary button.
  return <div className="grid gap-12 lg:grid-cols-2">{needsPayout ? [payouts, shop, verify, delivery] : [shop, payouts, verify, delivery]}</div>
}

type Latest = NonNullable<Awaited<ReturnType<typeof getMyVerification>>['latest']>

function Verification({ storeName, isAuthor, latest }: { storeName: string; isAuthor: boolean; latest: Latest | null }) {
  const router = useRouter()
  const [open, setOpen] = useState(isAuthor)
  const [value, setValue] = useState(emptyVerify)

  if (latest?.status === 'pending') {
    return (
      <div className="rounded-xl bg-accent-soft p-5 text-accent-soft-ink">
        <h2 className="text-xl">Verification in review</h2>
        <p className="mt-1 text-sm">Sent {formatDate(latest.createdAt)}. We usually reply within two working days. You can keep selling meanwhile.</p>
      </div>
    )
  }

  return (
    <>
      <h2 className="text-2xl">{isAuthor ? ONBOARDING.verifyTitle : 'Wrote a book?'}</h2>
      <p className="mt-1 mb-5 max-w-prose text-sm text-subtle">{isAuthor ? ONBOARDING.verifyLine : 'Get verified as its author: a verified mark, your own author page, and your books to edit.'}</p>
      {latest && latest.note && (
        <div className="mb-5 max-w-xl">
          <Alert tone="info">{latest.note}</Alert>
        </div>
      )}
      {open ? (
        <div className="max-w-2xl">
          <VerificationForm storeName={storeName} value={value} onChange={(patch) => setValue((v) => ({ ...v, ...patch }))} onSubmitted={() => void router.invalidate()} />
        </div>
      ) : (
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(true)}>
          Get verified
        </button>
      )}
    </>
  )
}

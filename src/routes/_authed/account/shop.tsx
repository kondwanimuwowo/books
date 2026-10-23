import { Link, createFileRoute } from '@tanstack/react-router'
import { getMySeller } from '#/functions/sell.functions'
import { PayoutForm, SellerProfileForm } from '#/components/seller-forms'
import { VerifiedMark } from '#/components/book'

export const Route = createFileRoute('/_authed/account/shop')({
  loader: () => getMySeller(),
  component: ShopSettings,
})

function ShopSettings() {
  const { seller, profile } = Route.useLoaderData()
  const needsPayout = !!seller && !seller.payoutAccountName

  const shop = (
    <section key="shop">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl">{seller ? 'Shop' : 'Open your shop'}</h2>
        {seller && (
          <div className="flex items-center gap-3 text-sm">
            {seller.verified && <VerifiedMark />}
            <Link to="/sellers/$slug" params={{ slug: seller.slug }}>
              View
            </Link>
          </div>
        )}
      </div>
      <SellerProfileForm
        primary={!needsPayout}
        submitLabel={seller ? 'Save' : 'Open shop'}
        defaults={{
          storeName: seller?.storeName ?? profile?.displayName ?? '',
          kind: seller?.kind ?? 'individual',
          bio: seller?.bio ?? null,
          phone: seller?.phone ?? profile?.phone ?? null,
          town: seller?.town ?? profile?.town ?? null,
          province: seller?.province ?? profile?.province ?? null,
        }}
      />
    </section>
  )

  const payouts = seller && (
    <section key="payouts">
      <h2 className="text-2xl">Payouts</h2>
      <p className="mt-1 mb-5 text-sm text-subtle">Paid here when the buyer confirms delivery.</p>
      <PayoutForm primary={needsPayout} current={{ phone: seller.payoutPhone, operator: seller.payoutOperator, accountName: seller.payoutAccountName }} />
    </section>
  )

  // Whichever still needs doing comes first and carries the primary button.
  return <div className="grid gap-12 lg:grid-cols-2">{needsPayout ? [payouts, shop] : [shop, payouts]}</div>
}

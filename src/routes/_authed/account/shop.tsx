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

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-xl">{seller ? 'Shop details' : 'Set up your shop'}</h2>
          {seller && (
            <div className="flex items-center gap-3 text-sm">
              {seller.verified && <VerifiedMark />}
              <Link to="/sellers/$slug" params={{ slug: seller.slug }}>
                View your shop
              </Link>
            </div>
          )}
        </div>
        <SellerProfileForm
          submitLabel={seller ? 'Save shop details' : 'Create my shop'}
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
      {seller && (
        <section>
          <h2 className="mb-2 text-xl">Payouts</h2>
          <p className="mb-4 text-sm text-neutral-700">
            When a buyer confirms delivery, your share (price minus the 10% Kuwala fee, plus the delivery fee) is sent to this number.
          </p>
          <PayoutForm current={{ phone: seller.payoutPhone, operator: seller.payoutOperator, accountName: seller.payoutAccountName }} />
        </section>
      )}
    </div>
  )
}

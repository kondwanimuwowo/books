import { Link, Outlet, createFileRoute, useLoaderData, useNavigate, useRouter } from '@tanstack/react-router'
import { signOut } from '#/functions/auth.functions'
import { activeTab, tabClass } from '#/components/tabs'

export const Route = createFileRoute('/_authed/account')({
  head: () => ({ meta: [{ title: 'Your account | Kuwala Books' }] }),
  component: AccountLayout,
})

function AccountLayout() {
  const { user } = useLoaderData({ from: '__root__' })
  const router = useRouter()
  const navigate = useNavigate()
  const isSeller = !!user?.sellerSlug

  return (
    <div className="page py-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl">Your account</h1>
          <p className="mt-1 text-sm text-neutral-700">{user?.email}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={async () => {
            await signOut()
            await router.invalidate()
            await navigate({ to: '/' })
          }}
        >
          Sign out
        </button>
      </div>
      <nav className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
        <Link to="/account" activeOptions={{ exact: true }} className={tabClass} activeProps={activeTab}>
          Orders
        </Link>
        {isSeller && (
          <>
            <Link to="/account/sales" className={tabClass} activeProps={activeTab}>
              Sales
            </Link>
            <Link to="/account/listings" className={tabClass} activeProps={activeTab}>
              Listings
            </Link>
          </>
        )}
        <Link to="/account/shop" className={tabClass} activeProps={activeTab}>
          {isSeller ? 'Shop and payouts' : 'Start selling'}
        </Link>
        <Link to="/account/password" className={tabClass} activeProps={activeTab}>
          Password
        </Link>
      </nav>
      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  )
}

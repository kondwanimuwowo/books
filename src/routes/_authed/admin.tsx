import { Link, Outlet, createFileRoute, redirect } from '@tanstack/react-router'
import { getAdminAccess } from '#/functions/admin.functions'
import { activeTab, tabClass } from '#/components/tabs'

// Page guard only; every admin server function checks the admin flag itself.
export const Route = createFileRoute('/_authed/admin')({
  beforeLoad: async () => {
    if (!(await getAdminAccess())) throw redirect({ to: '/' })
  },
  head: () => ({ meta: [{ title: 'Admin | Kuwala Books' }, { name: 'robots', content: 'noindex' }] }),
  component: AdminLayout,
})

function AdminLayout() {
  return (
    <div className="page py-8">
      <p className="eyebrow">Kuwala Books</p>
      <h1 className="mt-1 text-3xl">Admin</h1>
      <nav className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 py-1 sm:-mx-6 sm:px-6">
        <Link to="/admin" activeOptions={{ exact: true }} className={tabClass} activeProps={activeTab}>
          Overview
        </Link>
        <Link to="/admin/sellers" className={tabClass} activeProps={activeTab}>
          Sellers
        </Link>
        <Link to="/admin/authors" className={tabClass} activeProps={activeTab}>
          Authors
        </Link>
        <Link to="/admin/orders" className={tabClass} activeProps={activeTab}>
          Orders
        </Link>
      </nav>
      <div className="mt-8">
        <Outlet />
      </div>
    </div>
  )
}

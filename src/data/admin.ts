import { BookUser, LayoutDashboard, ReceiptText, Store } from 'lucide-react'

export const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard, exact: true },
  { to: '/admin/orders', label: 'Orders', icon: ReceiptText, exact: false },
  { to: '/admin/sellers', label: 'Sellers', icon: Store, exact: false },
  { to: '/admin/authors', label: 'Authors', icon: BookUser, exact: false },
] as const

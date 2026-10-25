import { BookOpenIcon, BuildingLibraryIcon, BuildingStorefrontIcon, ClipboardDocumentListIcon, ShieldCheckIcon, Squares2X2Icon, TruckIcon } from '@heroicons/react/20/solid'

export const ADMIN_NAV = [
  { to: '/admin', label: 'Overview', icon: Squares2X2Icon, exact: true },
  { to: '/admin/orders', label: 'Orders', icon: ClipboardDocumentListIcon, exact: false },
  { to: '/admin/sellers', label: 'Sellers', icon: BuildingStorefrontIcon, exact: false },
  { to: '/admin/authors', label: 'Authors', icon: BookOpenIcon, exact: false },
  { to: '/admin/verification', label: 'Verification', icon: ShieldCheckIcon, exact: false },
  { to: '/admin/publishers', label: 'Publishers', icon: BuildingLibraryIcon, exact: false },
  { to: '/admin/delivery', label: 'Delivery', icon: TruckIcon, exact: false },
] as const

import {
  ArchiveBoxIcon,
  ArrowRightStartOnRectangleIcon,
  BanknotesIcon,
  BookOpenIcon,
  BuildingStorefrontIcon,
  KeyIcon,
  PencilSquareIcon,
  TagIcon,
} from '@heroicons/react/16/solid'

export const FOOTER_NAV = [
  {
    title: 'Shop',
    links: [
      { label: 'Zambia Top 20', to: '/top-20' },
      { label: 'Zambian authors', to: '/search', search: { zambian: true } },
      { label: 'Authors', to: '/authors' },
      { label: 'Publishers', to: '/publishers' },
      { label: 'Used books', to: '/search', search: { condition: 'used' } },
      { label: 'School textbooks', to: '/search', search: { category: 'textbooks' } },
      { label: 'School book list', to: '/school-list' },
    ],
  },
  {
    title: 'Sell',
    links: [
      { label: 'List a book', to: '/sell' },
      { label: 'Your sales', to: '/account/sales' },
    ],
  },
] as const

export function accountNav(isSeller: boolean, isAuthor: boolean) {
  return [
    { to: '/account', label: 'Orders', exact: true, icon: ArchiveBoxIcon },
    { to: '/account/offers', label: 'Offers', exact: false, icon: TagIcon },
    ...(isSeller
      ? ([
          { to: '/account/sales', label: 'Sales', exact: false, icon: BanknotesIcon },
          { to: '/account/listings', label: 'Listings', exact: false, icon: BookOpenIcon },
        ] as const)
      : []),
    ...(isAuthor ? ([{ to: '/account/author', label: 'Your books', exact: false, icon: PencilSquareIcon }] as const) : []),
    { to: '/account/shop', label: isSeller ? 'Shop and payouts' : 'Start selling', exact: false, icon: BuildingStorefrontIcon },
    { to: '/account/password', label: 'Password', exact: false, icon: KeyIcon },
  ] as const
}

export const SIGN_OUT_ICON = ArrowRightStartOnRectangleIcon

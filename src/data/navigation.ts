export const FOOTER_NAV = [
  {
    title: 'Shop',
    links: [
      { label: 'Zambian authors', to: '/search', search: { zambian: true } },
      { label: 'Used books', to: '/search', search: { condition: 'used' } },
      { label: 'School textbooks', to: '/search', search: { category: 'textbooks' } },
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
    { to: '/account', label: 'Orders', exact: true },
    ...(isSeller
      ? ([
          { to: '/account/sales', label: 'Sales', exact: false },
          { to: '/account/listings', label: 'Listings', exact: false },
        ] as const)
      : []),
    ...(isAuthor ? ([{ to: '/account/author', label: 'Your books', exact: false }] as const) : []),
    { to: '/account/shop', label: isSeller ? 'Shop and payouts' : 'Start selling', exact: false },
    { to: '/account/password', label: 'Password', exact: false },
  ] as const
}

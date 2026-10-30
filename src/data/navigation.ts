import {
  ArchiveBoxIcon,
  ArrowRightStartOnRectangleIcon,
  BanknotesIcon,
  BookOpenIcon,
  BuildingStorefrontIcon,
  Cog6ToothIcon,
  PencilSquareIcon,
  TagIcon,
} from '@heroicons/react/16/solid'
import {
  BuildingLibraryIcon,
  BuildingStorefrontIcon as StorefrontIcon,
  ClipboardDocumentListIcon,
  HomeIcon,
  MagnifyingGlassIcon,
  PlusCircleIcon,
  ShoppingBagIcon,
  TrophyIcon,
  UserCircleIcon,
  UserGroupIcon,
} from '@heroicons/react/24/solid'
import { CONTACT } from './brand'

// Phones get an app-style tab bar; the native apps will use the same five tabs.
export const TABS = [
  { key: 'home', label: 'Home', to: '/', icon: HomeIcon, match: (path: string) => path === '/' },
  { key: 'browse', label: 'Browse', to: '/search', icon: MagnifyingGlassIcon, match: (path: string) => /^\/(search|authors|publishers|top-20|sellers)(\/|$)/.test(path) },
  { key: 'sell', label: 'Sell', to: '/sell', icon: PlusCircleIcon, match: (path: string) => /^\/(sell|start-selling|sell-on-kuwala)(\/|$)/.test(path) },
  { key: 'bag', label: 'Bag', to: '/bag', icon: ShoppingBagIcon, match: (path: string) => path === '/bag' },
  { key: 'account', label: 'Account', to: '/account', icon: UserCircleIcon, match: (path: string) => /^\/(account|orders|login|welcome)(\/|$)/.test(path) },
] as const

// Flows with their own bar of actions at the bottom (buy, pay, list) hide the tabs, as apps do.
export const NO_TAB_ROUTES: readonly string[] = ['/books/$slug', '/_authed/checkout', '/_authed/sell']

// Checkout keeps to the task: no footer to wander off through.
export const NO_FOOTER_ROUTES: readonly string[] = ['/_authed/checkout']

// Sellers get their own shop in the header and the phone menu, in place of Sell; listing a book is a button there.
export const MY_SHOP = { label: 'My shop', icon: StorefrontIcon, list: 'List a book', edit: 'Edit shop' } as const

// The phone menu holds what the tabs don't.
export const MENU_LINKS = [
  { label: 'Zambia Top 20', to: '/top-20', icon: TrophyIcon },
  { label: 'Authors', to: '/authors', icon: UserGroupIcon },
  { label: 'Publishers', to: '/publishers', icon: BuildingLibraryIcon },
  { label: 'School book list', to: '/school-list', icon: ClipboardDocumentListIcon },
] as const

// Legal pages are named by slug and take their titles from LEGAL_PAGES; terms and privacy sit in the bottom row.
export const FOOTER_NAV = [
  {
    title: 'Shop',
    links: [
      { label: 'Zambian authors', to: '/search', search: { zambian: true } },
      { label: 'Zambia Top 20', to: '/top-20' },
      { label: 'Authors', to: '/authors' },
      { label: 'Publishers', to: '/publishers' },
      { label: 'Used books', to: '/search', search: { condition: 'used' } },
      { label: 'School book list', to: '/school-list' },
    ],
  },
  {
    title: 'Sell',
    links: [{ label: 'Sell on Kuwala', to: '/sell-on-kuwala' }, { label: 'For authors', to: '/for-authors' }, { legal: 'seller-agreement' }],
  },
  {
    title: 'Help',
    links: [
      { label: 'How buying works', to: '/how-it-works' },
      { label: 'Your orders', to: '/account' },
      { legal: 'buyer-protection' },
      { label: 'Email support', href: `mailto:${CONTACT.support}` },
      { label: 'WhatsApp us', href: `https://wa.me/${CONTACT.phone.replace(/\D/g, '')}`, external: true },
    ],
  },
] as const

export const FOOTER_LEGAL = ['terms', 'privacy'] as const

export const FOOTER_COPY = {
  line: 'Connecting readers with authors, publishers and booksellers in Zambia and beyond.',
  facebook: 'Facebook',
}

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
    isSeller
      ? ({ to: '/account/shop', label: 'Shop and payouts', exact: false, icon: BuildingStorefrontIcon } as const)
      : ({ to: '/start-selling', label: 'Start selling', exact: false, icon: BuildingStorefrontIcon } as const),
    { to: '/account/settings', label: 'Settings', exact: false, icon: Cog6ToothIcon },
  ] as const
}

export const SIGN_OUT_ICON = ArrowRightStartOnRectangleIcon

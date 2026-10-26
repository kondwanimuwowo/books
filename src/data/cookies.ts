// Cookies and similar storage, by category. Adding a service to an optional category makes the banner ask
// everyone again (the consent version changes) and puts it behind hasConsent(category) in the code.
// The privacy page describes these too: update it in the same change.

export type CookieCategory = 'essential' | 'analytics' | 'marketing'

export interface CookieService {
  name: string
  purpose: string
}

export interface CookieCategoryInfo {
  key: CookieCategory
  label: string
  description: string
  /** Always on: the site can't work without these. */
  required: boolean
  services: CookieService[]
}

export const COOKIE_CATEGORIES: CookieCategoryInfo[] = [
  {
    key: 'essential',
    label: 'Essential',
    description: 'Keep you signed in, remember your currency, and hold your bag and unfinished forms on this device.',
    required: true,
    services: [
      { name: 'Sign-in', purpose: 'Keeps you signed in securely' },
      { name: 'Currency', purpose: 'Remembers kwacha or dollars' },
      { name: 'Bag and drafts', purpose: 'Stored on your device, never sent to us until you check out' },
    ],
  },
  {
    key: 'analytics',
    label: 'Analytics',
    description: 'Help us see which pages work and which don’t, so we can improve Kuwala Books.',
    required: false,
    services: [],
  },
  {
    key: 'marketing',
    label: 'Marketing',
    description: 'Let us measure our adverts and show relevant ones elsewhere.',
    required: false,
    services: [],
  },
]

/** Only categories with something in them are offered as a choice; an empty switch would promise nothing. */
export const OPTIONAL_CATEGORIES = COOKIE_CATEGORIES.filter((c) => !c.required && c.services.length > 0)

/** Changes whenever an optional service is added or removed, so people are asked again. */
export const CONSENT_VERSION = ['v1', ...OPTIONAL_CATEGORIES.flatMap((c) => c.services.map((s) => `${c.key}:${s.name}`))].join('|')

export const COOKIE_COPY = {
  title: 'Cookies on Kuwala Books',
  essentialOnly: 'We only use cookies to keep you signed in and remember your currency. No adverts, no tracking.',
  withChoices: 'We use essential cookies to run the site. With your permission, we’d also like to use a few more to improve it.',
  ok: 'Okay',
  acceptAll: 'Accept all',
  essentialButton: 'Essential only',
  choose: 'Choose',
  save: 'Save choices',
  settings: 'Cookie settings',
  more: 'Privacy policy',
} as const

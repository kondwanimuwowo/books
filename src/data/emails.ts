// Opt-in email: alerts about saved books and follows, and the newsletter. Shared with the apps.

/** The evening digest goes out from this hour, Lusaka time. */
export const DIGEST_HOUR = 18
/** Books per section of a digest; the rest are on the Saved page. */
export const DIGEST_MAX_BOOKS = 8

export const EMAIL_LISTS = ['alerts', 'news'] as const
export type EmailList = (typeof EMAIL_LISTS)[number]

export const NEWSLETTER_SOURCES = ['footer', 'about', 'settings'] as const

export const EMAIL_PREFS_COPY = {
  heading: 'Emails',
  intro: 'Emails about your orders, sales and account always come. These two are up to you.',
  alerts: {
    label: 'Alerts',
    hint: 'One email in the evening when a book you saved gets cheaper or comes back, or someone you follow lists a new one.',
  },
  news: { label: 'News from Kuwala', hint: 'New Zambian books, author launches and the odd offer. About twice a month.' },
} as const

export const ALERTS_COPY = {
  subject: (count: number) => (count === 1 ? 'An update on books you’re watching' : `${count} updates on books you’re watching`),
  greeting: (name: string) => `Hi ${name},`,
  cheaperHeading: 'From your saved books',
  cheaper: (title: string, price: string, was: string | null) => (was ? `${title}: now ${price}, was ${was}` : `${title}: back on sale at ${price}`),
  newHeading: 'New from who you follow',
  fresh: (title: string, via: string, price: string) => `${title}, from ${via}: ${price}`,
  action: 'Your saved books',
  unsubscribe: 'Stop these alerts',
  // After the first heart or Follow, while alerts are off.
  nudge: 'Want an email when saved books get cheaper, or someone you follow lists a new one?',
  nudgeOn: 'Turn on alerts',
  nudgeDone: 'Alerts are on. Change it any time in Settings.',
  nudgeDismiss: 'No thanks',
} as const

export const NEWSLETTER_COPY = {
  heading: 'News from Kuwala',
  line: 'New Zambian books and author launches, about twice a month.',
  emailLabel: 'Email address',
  submit: 'Sign up',
  sending: 'Sending',
  sentShort: 'Sent',
  sent: (email: string) => `Check ${email} and tap the link to confirm.`,
  privacy: 'Unsubscribe any time.',
  confirmSubject: 'Confirm your email for Kuwala Books news',
  confirmLines: [
    'Tap below to confirm you’d like news from Kuwala Books: new Zambian books and author launches, about twice a month.',
    'If you didn’t sign up, ignore this email and you won’t hear from us.',
  ],
  confirmAction: 'Confirm my email',
  confirmHeading: 'Confirm your email',
  confirmBody: 'One tap and you’re on the list.',
  confirmed: 'You’re on the list. The next newsletter will reach you.',
  badToken: 'This link has expired or was already used. Sign up again at the bottom of any page.',
  unsubscribeHeading: { news: 'Unsubscribe from news', alerts: 'Stop alerts' },
  unsubscribeBody: { news: 'You’ll stop getting the Kuwala Books newsletter.', alerts: 'You’ll stop getting emails about saved books and who you follow.' },
  unsubscribeButton: 'Unsubscribe',
  unsubscribed: 'Done. You won’t get these any more. Order and account emails still come.',
  changedMind: 'Changed your mind? Turn it back on in Settings.',
} as const

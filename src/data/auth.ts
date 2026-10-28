// Copy for signing in and joining, shared by the web and (later) the apps.
export const AUTH_COPY = {
  signIn: 'Sign in',
  createAccount: 'Create account',
  google: 'Continue with Google',
  or: 'or',
  googleFailed: 'Google sign-in didn’t finish. Try again, or use your email.',
  linkExpired: 'That link has expired. Sign in or ask for a new one.',
  welcomeTitle: 'Your Kuwala account',
  welcomeLine: 'Buy, sell and make offers on books across Zambia.',
  perks: ['Your payment is held until your books arrive', 'Offers, orders and tracking in one place', 'Sell the books on your shelf'],
}

// Why we're asking, from where they were headed (?next=). First match wins.
const REASONS: { prefix: string; reason: string }[] = [
  { prefix: '/checkout', reason: 'to check out' },
  { prefix: '/sell', reason: 'to list your books' },
  { prefix: '/start-selling', reason: 'to start selling' },
  { prefix: '/account/offers', reason: 'to see your offers' },
  { prefix: '/account', reason: 'to see your orders' },
  { prefix: '/orders/', reason: 'to see your order' },
  { prefix: '/school-list', reason: 'to find the books on your list' },
  { prefix: '/claim/', reason: 'to claim your author page' },
  { prefix: '/books/', reason: 'to continue' },
]

export function authReason(next: string | undefined) {
  const match = next && REASONS.find((r) => next.startsWith(r.prefix))
  return match ? `Sign in or create an account ${match.reason}.` : undefined
}

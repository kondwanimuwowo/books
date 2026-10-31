// Weekly payouts: delivered sales collect into a balance, paid in one free transfer on payout day.
// "Pay me now" pays the balance at once, with Lenco's transfer fee taken from it.

/** Friday (0 = Sunday), from 09:00 Lusaka time. */
export const PAYOUT_WEEKDAY = 5
export const PAYOUT_HOUR = 9
/** Zambia doesn't change its clocks. */
const LUSAKA_OFFSET_HOURS = 2

/** Smaller balances wait for the next payout day, but never longer than MAX_WAIT_DAYS. */
export const WEEKLY_MIN_NGWEE = 10_000
export const MAX_WAIT_DAYS = 30
/** "Pay me now" needs enough to be worth the fee. */
export const INSTANT_MIN_NGWEE = 2_000

// Lenco's mobile money payout fees (broadpay.co.zm/pricing). Confirm with Lenco when they change.
const INSTANT_FEES = [
  { upTo: 100_000, fee: 850 },
  { upTo: 5_000_000, fee: 1_500 },
  { upTo: Infinity, fee: 3_500 },
] as const

export const instantFee = (amountNgwee: number) => INSTANT_FEES.find((t) => amountNgwee <= t.upTo)?.fee ?? 3_500

const lusaka = (date: Date) => new Date(date.getTime() + LUSAKA_OFFSET_HOURS * 3_600_000)

export function isPayoutWindow(now = new Date()) {
  const local = lusaka(now)
  return local.getUTCDay() === PAYOUT_WEEKDAY && local.getUTCHours() >= PAYOUT_HOUR
}

/** The next payout day at 09:00 Lusaka time, today if it's Friday morning before nine. */
export function nextPayoutDay(now = new Date()) {
  const local = lusaka(now)
  const days = (PAYOUT_WEEKDAY - local.getUTCDay() + 7) % 7
  const target = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days, PAYOUT_HOUR - LUSAKA_OFFSET_HOURS))
  return target.getTime() > now.getTime() || isPayoutWindow(now) ? target : new Date(target.getTime() + 7 * 86_400_000)
}

export const PAYOUT_COPY = {
  balance: 'Ready to pay out',
  weekly: (day: string) => `Paid free on ${day}.`,
  belowMinimum: (min: string, day: string) => `Paid free once it reaches ${min}, or on ${day} if it has waited a month.`,
  instant: 'Pay me now',
  instantNote: (fee: string, net: string) => `Lenco’s ${fee} transfer fee comes off. You receive ${net} now.`,
  noDestination: 'Add your mobile money number to get paid.',
  listingFees: 'Payouts are free every Friday, or instant for a small transfer fee.',
  empty: (min: string) => `Delivered sales collect here. Paid free every Friday from 09:00 once it reaches ${min}.`,
  breakdown: (books: string, commission: string, percent: string, delivery: string) =>
    `${books} books − ${commission} commission (${percent})${delivery ? ` + ${delivery} delivery` : ''}`,
} as const

/** Where one sale's money is, and when it moves next. */
export const SALE_MONEY_COPY = {
  heldToShip: 'Held until the buyer has the books.',
  heldShipped: (date: string) => `Held until the buyer confirms, or ${date} at the latest.`,
  heldDisputed: 'Held while the problem is looked at.',
  released: (day: string) => `In your balance, paid ${day}.`,
  releasedSmall: (min: string) => `In your balance, paid once it reaches ${min}.`,
  processing: 'On its way to your mobile money.',
  paid: (date: string) => `Paid ${date}.`,
  failed: 'The transfer didn’t go through. It’s back in your balance for the next payout.',
} as const

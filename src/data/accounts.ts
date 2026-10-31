// Deleting an account: what it removes, what it keeps, and what has to be finished first. Shared with the apps.

export type DeletionBlocker = 'payment' | 'parcels' | 'refunds' | 'sales' | 'payouts'

export const DELETE_ACCOUNT_COPY = {
  heading: 'Delete account',
  intro: 'This removes your account for good. It can’t be undone.',
  removes: [
    'Your sign-in, name, email, phone and saved addresses',
    'Your shop, listings, offers and shop photo',
    'Verification documents, if you sent any',
    'Your saved books, follows and email choices, including the newsletter',
  ],
  keeps: 'Orders and payments stay in our records without your account, as the law requires. Your book reviews stay up as from a former member.',
  blocked: 'Finish these first:',
  confirmLabel: 'Type your email address to confirm',
  confirmMismatch: 'Type your email address exactly as it is on your account',
  button: 'Delete my account',
  deleting: 'Deleting…',
  emailSubject: 'Your Kuwala Books account is deleted',
  emailLines: ['Your Kuwala Books account has been deleted, as you asked.', 'If this wasn’t you, reply to this email straight away.'],
}

/** Why the account can't be deleted yet, and where to sort it out. */
export const DELETION_BLOCKERS: Record<DeletionBlocker, { text: (n: number) => string; to: string }> = {
  payment: { text: () => 'A payment is still going through', to: '/account' },
  parcels: { text: (n) => `${n} ${n === 1 ? 'parcel is' : 'parcels are'} still on the way to you`, to: '/account' },
  refunds: { text: (n) => `${n} ${n === 1 ? 'refund is' : 'refunds are'} still being sent to you`, to: '/account' },
  sales: { text: (n) => `${n} ${n === 1 ? 'sale is' : 'sales are'} still open or not yet paid out to you`, to: '/account/sales' },
  payouts: { text: () => 'A payout to you is still being sent', to: '/account/sales' },
}

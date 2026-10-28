import type { Operator } from '#/lib/phone'
import { SHIP_WITHIN_DAYS } from './fulfilment'

// Cards are paused: the option is hidden, the server refuses to start one, and the legal text says mobile money only.
// Turning this back on brings all three back together.
export const CARD_PAYMENTS = false

/** The mobile money networks, in the order buyers see them, with their official logos (public/brand/momo/). */
export const NETWORKS: { key: Operator; name: string; logo: string }[] = [
  { key: 'airtel', name: 'Airtel Money', logo: '/brand/momo/airtel.png' },
  { key: 'mtn', name: 'MTN MoMo', logo: '/brand/momo/mtn.png' },
  { key: 'zamtel', name: 'Zamtel Money', logo: '/brand/momo/zamtel.png' },
]

export const PAY_COPY = {
  payWith: 'Pay with mobile money',
  networkLabel: 'Network',
  numberLabel: 'Mobile money number',
  how: 'A prompt pops up on your phone. Enter your PIN to approve.',
  waitingTitle: 'Check your phone',
  waitingBody: (amount: string, phone: string) => `Approve ${amount} on ${phone} with your PIN.`,
  waitingNote: 'Keep this page open. It moves on by itself once you approve.',
  successTitle: 'Payment received',
  successBody: (amount: string) => `${amount} is held safely until your books arrive.`,
  next: [
    { title: 'Sellers pack your books', body: `Each seller ships their part within ${SHIP_WITHIN_DAYS} days.` },
    { title: 'Track it here', body: 'You get an email when each parcel is on its way.' },
    { title: 'Confirm when it arrives', body: 'The seller is paid only after you confirm.' },
  ],
}

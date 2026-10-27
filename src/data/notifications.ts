// What members are told when something happens to their orders, sales, ratings and payouts.
// Subjects are plain text; lines are HTML, so anything a member typed is escaped before it gets here.
import { DECISION_WORKING_DAYS } from './fulfilment'
import { BLIND_DAYS } from './reputation'

export const NOTIFY_COPY = {
  deliveredBuyer: {
    subject: (number: string) => `Delivered: order ${number}`,
    lines: (store: string, auto: boolean) => [
      auto
        ? `We’ve marked your books from ${store} as delivered, since no problem was reported in time.`
        : `Thanks for confirming your books from ${store} arrived.`,
      'Rate the shop and review the books. It helps other readers and the authors.',
    ],
    action: 'Rate and review',
  },
  deliveredSeller: {
    subject: (number: string) => `Delivered: order ${number}`,
    lines: (amount: string, auto: boolean) => [
      auto ? 'The buyer didn’t report a problem in time, so the parcel counts as delivered.' : 'The buyer confirmed the books arrived.',
      `${amount} is now in your balance. Your sales page shows when it’s paid out.`,
    ],
    action: 'Your sales',
  },
  rated: {
    subject: 'You’ve been rated',
    // Ratings are blind: the score shows once both sides have rated, or after BLIND_DAYS.
    hidden: (who: string, number: string) => [
      `${who} rated you for order ${number}.`,
      `Their rating shows once you rate them too, or in ${BLIND_DAYS} days.`,
    ],
    shown: (who: string, score: number, number: string) => [`${who} rated you ${score} out of 5 for order ${number}. Both ratings now show.`],
    rateAction: 'Rate them back',
    seeAction: 'See your ratings',
  },
  reviewed: {
    subject: (title: string) => `New review of ${title}`,
    lines: (title: string, score: number, body: string | null) => [
      `A reader who bought ${title} gave it ${score} out of 5.`,
      ...(body ? [`“${body}”`] : []),
    ],
    action: 'See the review',
  },
  payoutSent: {
    subject: (amount: string) => `${amount} sent to your mobile money`,
    lines: (amount: string, phone: string) => [`We’ve sent ${amount} to ${phone}. It should show on your phone shortly.`],
    action: 'Your sales',
  },
  offerWithdrawn: {
    subject: (title: string) => `Offer withdrawn: ${title}`,
    lines: (title: string) => [`The buyer withdrew their offer on ${title}. Your copy stays on sale.`],
  },
  disputeAnswered: {
    subject: (number: string) => `The seller replied about order ${number}`,
    lines: () => [`The seller has given their side. We’ll decide within ${DECISION_WORKING_DAYS} working days and let you know.`],
    action: 'Your order',
  },
  teamDisputeAnswered: (number: string, store: string) => ({
    subject: `Seller replied to a dispute on ${number}`,
    lines: [`${store} gave their side on order ${number}. It’s ready to decide.`],
  }),
  teamReport: {
    subject: (title: string) => `Listing reported: ${title}`,
    lines: (title: string, reason: string) => [`A reader reported a copy of ${title} (${reason}).`],
  },
} as const

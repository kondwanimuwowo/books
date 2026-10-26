// Kuwala Books' legal pages, written from the same settings the site runs on, so a change to a rule
// changes the page too. When behaviour changes in a way these words describe (fees, delivery, payouts,
// refunds, disputes, data), update the text here and LEGAL_UPDATED in the same change.
import { CONDITIONS, COMMISSION_RATE, MAX_LISTING_PHOTOS, OFFER_HOLD_HOURS, OFFER_REPLY_HOURS } from './listing-options'
import { AUTO_RELEASE_DAYS, PICKUP_RELEASE_DAYS } from './shipping'
import { BUS_PARCEL_GRACE_DAYS, CLAIM_FLAG_AT, CLAIM_WINDOW_DAYS, DECISION_WORKING_DAYS, DISPUTE_REPLY_HOURS, MAX_REFUND_ATTEMPTS, SHIP_REMINDER_DAYS, SHIP_WITHIN_DAYS } from './fulfilment'
import { INSTANT_MIN_NGWEE, MAX_WAIT_DAYS, WEEKLY_MIN_NGWEE, instantFee } from './payouts'
import { BLIND_DAYS, RATING_WINDOW_DAYS } from './reputation'
import { formatMoney } from '#/lib/money'

export const LEGAL_UPDATED = '2026-10-26'
export const LEGAL_CONTACT = 'support@kuwalabooks.com'
/** How quickly Kuwala Books answers a request about someone's personal data. */
export const DATA_REQUEST_DAYS = 30

export type LegalBlock = { p: string } | { list: string[] }
export interface LegalSection {
  heading: string
  blocks: LegalBlock[]
}
export interface LegalPage {
  slug: LegalSlug
  title: string
  summary: string
  sections: LegalSection[]
}
export type LegalSlug = 'terms' | 'buyer-protection' | 'seller-agreement' | 'privacy'

const percent = `${Math.round(COMMISSION_RATE * 100)}%`
const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
const usedConditions = CONDITIONS.filter((c) => c.value !== 'new')
  .map((c) => c.label.toLowerCase())
  .join(', ')

const terms: LegalPage = {
  slug: 'terms',
  title: 'Terms of use',
  summary: 'The rules for using Kuwala Books, whether you buy, sell or just browse.',
  sections: [
    {
      heading: 'Who we are',
      blocks: [
        { p: 'Kuwala Books is an online marketplace for books in Zambia at kuwalabooks.com. Readers, authors, bookshops and publishers list books for sale, and buyers buy them from those sellers.' },
        { p: 'Kuwala Books is not the seller of books listed by others. The contract for each book is between the buyer and the seller. Kuwala Books runs the marketplace, holds payments until delivery and steps in when something goes wrong, as these terms and the Buyer protection page describe.' },
      ],
    },
    {
      heading: 'Your account',
      blocks: [
        {
          list: [
            'You need an account to buy, sell, make offers, review or rate. Every account starts as a reader account.',
            'Give your real name and a phone number you use. Keep your password to yourself; you are responsible for what happens on your account.',
            'You must be 18 or older to sell, or have a parent or guardian’s permission.',
          ],
        },
      ],
    },
    {
      heading: 'Prices and payment',
      blocks: [
        {
          list: [
            'Prices are in Zambian kwacha (ZMW). US dollar prices are shown for guidance only, at a daily rate; you always pay in kwacha.',
            'You pay for books and delivery on Kuwala Books, by mobile money or card, through our payment provider Lenco. We never see or store your card number.',
            'Your money is held by Kuwala Books until you confirm the books arrived, then paid to the seller. See Buyer protection.',
            'Agree and pay everything on Kuwala Books. Payments made to a seller directly are not protected, and asking for them can close a seller’s shop.',
          ],
        },
      ],
    },
    {
      heading: 'Offers',
      blocks: [
        {
          list: [
            `Some listings accept offers. The seller has ${OFFER_REPLY_HOURS} hours to reply; silence declines.`,
            'Each side can counter once. An accepted offer is a promise to buy at that price.',
            `When an offer is accepted, the copy is held for you for ${OFFER_HOLD_HOURS} hours. If you don’t pay in that time, it goes back on sale, and unpaid accepted offers count against your standing as a buyer.`,
          ],
        },
      ],
    },
    {
      heading: 'Reviews and ratings',
      blocks: [
        {
          list: [
            'Only buyers who received a book can review it. Reviews must be honest, about the book, and free of phone numbers, links and abuse. Kuwala Books may hide reviews that break these rules.',
            `After delivery, buyers and sellers can rate each other within ${days(RATING_WINDOW_DAYS)}. Ratings stay hidden until both sides have rated, or ${days(BLIND_DAYS)} pass.`,
          ],
        },
      ],
    },
    {
      heading: 'What isn’t allowed',
      blocks: [
        {
          list: [
            'Pirated, photocopied or counterfeit books, and books you don’t have the right to sell.',
            'Listings that misdescribe a book or its condition.',
            'Taking a sale, payment or conversation off Kuwala Books to avoid fees or protection.',
            'Fake reviews, ratings, accounts or problem reports.',
            'Harassing other users, or using the site to break Zambian law.',
          ],
        },
        { p: 'Kuwala Books may remove listings or reviews, hold payments while we look into a problem, and suspend or close accounts that break these terms.' },
      ],
    },
    {
      heading: 'Our responsibility',
      blocks: [
        { p: 'We work to keep Kuwala Books running and safe, but we can’t promise it will always be available or free of mistakes. Books are described by their sellers; we don’t check every listing.' },
        { p: 'Nothing in these terms takes away rights you have under Zambian consumer law. Beyond those, our responsibility for any order is limited to the amount paid for it on Kuwala Books.' },
      ],
    },
    {
      heading: 'Changes and law',
      blocks: [
        { p: 'We update these terms when the way Kuwala Books works changes. The date at the top shows the latest version; using the site after a change means you accept it.' },
        { p: `These terms are governed by the laws of Zambia. Questions or complaints: ${LEGAL_CONTACT}.` },
      ],
    },
  ],
}

const buyerProtection: LegalPage = {
  slug: 'buyer-protection',
  title: 'Buyer protection and refunds',
  summary: 'Your money is held until your books arrive. Here is what happens if they don’t, or aren’t what you were promised.',
  sections: [
    {
      heading: 'Your money is held until you have the books',
      blocks: [
        { p: 'When you pay, Kuwala Books holds the money. The seller is only paid once you confirm the books arrived.' },
        {
          list: [
            'When your books arrive, confirm on your order page.',
            `If you don’t confirm or report a problem, the money is released to the seller ${days(AUTO_RELEASE_DAYS)} after the parcel is marked as shipped (${days(PICKUP_RELEASE_DAYS)} for pickup from the seller).`,
            'If something is wrong, report it before you confirm. Reporting pauses the release.',
          ],
        },
      ],
    },
    {
      heading: 'If the seller doesn’t send your books',
      blocks: [{ p: `Sellers must ship within ${days(SHIP_WITHIN_DAYS)} of your payment. If they don’t, that part of your order is cancelled automatically and you are refunded in full, books and delivery.` }],
    },
    {
      heading: 'What you can report',
      blocks: [
        {
          list: [
            'The books never arrived.',
            'You received the wrong book.',
            `The condition is clearly worse than the listing said (sellers grade copies as new, ${usedConditions}), or pages are missing.`,
            'The books were damaged in transit.',
          ],
        },
        { p: 'Kuwala Books doesn’t offer returns for a change of mind. Check the condition, notes and photos before you buy.' },
      ],
    },
    {
      heading: 'How a problem is decided',
      blocks: [
        {
          list: [
            `The seller is told straight away and has ${DISPUTE_REPLY_HOURS} hours to give their side, with proof such as the courier’s receipt.`,
            `Kuwala Books looks at both sides and decides within ${DECISION_WORKING_DAYS} working days.`,
            'If the seller can’t show they sent the books, you are refunded.',
            'If they sent them and the courier shows they were delivered or collected, the seller is paid.',
            'If they sent them but the courier lost them, you are refunded. The seller claims from the courier with their receipt.',
            `For bus parcels not collected, buyer and seller have ${days(BUS_PARCEL_GRACE_DAYS)} more to sort it out at the station before we decide.`,
          ],
        },
        { p: `Problem reports are taken seriously. A buyer who reports ${CLAIM_FLAG_AT} or more parcels in ${days(CLAIM_WINDOW_DAYS)} is looked at more closely.` },
      ],
    },
    {
      heading: 'How refunds are paid',
      blocks: [
        {
          list: [
            'Mobile money payments are refunded to the number that paid, automatically, usually within minutes.',
            `If a mobile money refund fails ${MAX_REFUND_ATTEMPTS} times, our team sends it by hand.`,
            'Card payments are refunded to the card. Banks can take several working days to show it.',
            'You get back what you paid for that part of the order: the books and their delivery.',
          ],
        },
      ],
    },
    {
      heading: 'What isn’t covered',
      blocks: [{ list: ['Anything paid to a seller outside Kuwala Books.', 'A change of mind after a correct book has arrived as described.', 'Problems reported after you confirmed delivery or the money was released.'] }],
    },
    { heading: 'Questions', blocks: [{ p: `Report a problem from your order page. For anything else: ${LEGAL_CONTACT}.` }] },
  ],
}

const sellerAgreement: LegalPage = {
  slug: 'seller-agreement',
  title: 'Seller agreement',
  summary: 'What Kuwala Books asks of sellers, what it charges, and how and when you are paid.',
  sections: [
    {
      heading: 'Selling on Kuwala Books',
      blocks: [
        { p: 'Anyone can open a shop: readers selling books they own, authors, bookshops and publishers. By opening a shop you agree to these terms as well as the Terms of use.' },
        { p: 'Authors can ask to be verified. We check identity and authorship; documents are seen only by our team and deleted once we decide. Verified authors get a mark on their page and can edit their books’ details.' },
      ],
    },
    {
      heading: 'Listing books',
      blocks: [
        {
          list: [
            'List only books you have and have the right to sell. Pirated and photocopied books are not allowed.',
            'Describe the condition honestly. Used copies need at least one photo of the actual copy (up to ' + MAX_LISTING_PHOTOS + ').',
            'Keep your stock up to date; pause listings you can’t send.',
          ],
        },
      ],
    },
    {
      heading: 'Fees',
      blocks: [
        {
          list: [
            `Kuwala Books takes ${percent} of the price of the books you sell. There is no fee to list.`,
            'Delivery is paid by the buyer at the platform’s rates, and all of it goes to you. You can offer free delivery, but you can’t charge more than the platform rate.',
          ],
        },
      ],
    },
    {
      heading: 'Shipping',
      blocks: [
        {
          list: [
            `Ship within ${days(SHIP_WITHIN_DAYS)} of the buyer’s payment. We remind you after ${days(SHIP_REMINDER_DAYS)}. If it isn’t marked as shipped in time, the order is cancelled, the buyer is refunded, you aren’t paid for it, and the listing is paused.`,
            'When you mark a parcel as shipped with Platinum, Mercury or a bus, add a photo of the courier’s receipt. For Yango, add the trip link. This is your proof if a buyer says it never arrived.',
            'Pickup from you can be by the buyer or someone they send, using the name and number on the order.',
          ],
        },
      ],
    },
    {
      heading: 'Getting paid',
      blocks: [
        {
          list: [
            'You are paid for a sale once the buyer confirms it arrived, or the release date passes without a problem being reported.',
            `Paid sales collect in your balance and are sent free to your mobile money every Friday, once the balance reaches ${formatMoney(WEEKLY_MIN_NGWEE)} or a sale has waited ${days(MAX_WAIT_DAYS)}.`,
            `To be paid sooner, Pay me now sends your balance at once (from ${formatMoney(INSTANT_MIN_NGWEE)}). Our payment provider’s transfer fee comes off it: ${formatMoney(instantFee(100_000))} for up to ${formatMoney(100_000)}, ${formatMoney(instantFee(5_000_000))} above that.`,
            'Payouts go to a mobile money number in your name. You are responsible for any tax on your sales.',
          ],
        },
      ],
    },
    {
      heading: 'Problems and refunds',
      blocks: [
        {
          list: [
            `If a buyer reports a problem, you have ${DISPUTE_REPLY_HOURS} hours to give your side with proof. If you don’t reply, we decide on what the buyer told us.`,
            'If you can’t show you sent the books, the buyer is refunded and you aren’t paid.',
            'If a courier loses a parcel you sent, the buyer is refunded. You claim from the courier with your receipt; Kuwala Books doesn’t cover courier losses.',
            `Sellers with ${CLAIM_FLAG_AT} or more refunded parcels in ${days(CLAIM_WINDOW_DAYS)} are reviewed, and may have their shop paused.`,
          ],
        },
      ],
    },
    {
      heading: 'Contact with buyers',
      blocks: [{ p: 'You see the buyer’s phone number once they’ve paid, to arrange delivery. Never ask a buyer to pay you outside Kuwala Books; it isn’t protected, and doing it can close your shop.' }],
    },
    { heading: 'Closing a shop', blocks: [{ p: `You can stop selling at any time; orders already paid must still be sent. Kuwala Books may pause or close shops that break these terms. Questions: ${LEGAL_CONTACT}.` }] },
  ],
}

const privacy: LegalPage = {
  slug: 'privacy',
  title: 'Privacy',
  summary: 'What Kuwala Books collects, why, who helps us handle it, and your rights under the Data Protection Act.',
  sections: [
    {
      heading: 'What we collect',
      blocks: [
        {
          list: [
            'Account details: your name, email address and password (stored only as a secure hash by our sign-in provider).',
            'For orders: the name, phone number, town and address for delivery, and what you bought.',
            'For sellers: shop details, photos, and the mobile money number and registered name you are paid to.',
            'For author verification: your legal name, a photo of your NRC or passport and a photo with your book, kept privately and deleted once we decide.',
            'What you add: listings, photos of books, reviews, ratings, offers and messages.',
            'How the site is used, to keep it secure and working.',
          ],
        },
      ],
    },
    {
      heading: 'How we use it',
      blocks: [
        {
          list: [
            'To run your orders: payment, delivery, payouts, refunds and problem reports.',
            'To show the right people the right things: a seller sees a buyer’s delivery details only after payment; a buyer’s purchases are never shown publicly.',
            'To keep Kuwala Books safe: spotting fraud, repeated false reports and off-platform payments.',
            'To send emails about your orders, sales and account.',
          ],
        },
      ],
    },
    {
      heading: 'Who helps us',
      blocks: [
        {
          list: [
            'Lenco processes payments, payouts and refunds. Card details go to Lenco, not to us.',
            'Supabase runs sign-in. Cloudflare hosts the site and stores photos.',
            'Resend sends our emails.',
            'Anthropic’s Claude reads book photos and school book lists you upload, to fill in details, and helps us research public information about authors. It isn’t used to train AI models.',
          ],
        },
        { p: 'We don’t sell your information.' },
      ],
    },
    {
      heading: 'Cookies and your device',
      blocks: [{ p: 'We use cookies to keep you signed in and remember your currency. Your bag, recently viewed books and unfinished forms are kept on your device. We don’t use advertising trackers.' }],
    },
    {
      heading: 'How long we keep it',
      blocks: [
        {
          list: [
            'Order records are kept as long as the law requires for business records.',
            'Verification documents are deleted as soon as we decide.',
            'If you ask us to close your account, we delete your personal details except what we must keep for orders and the law.',
          ],
        },
      ],
    },
    {
      heading: 'Your rights',
      blocks: [
        { p: 'Under Zambia’s Data Protection Act, you can ask to see the information we hold about you, correct it, or have it deleted, and object to how we use it.' },
        { p: `Write to ${LEGAL_CONTACT}. We reply within ${days(DATA_REQUEST_DAYS)}.` },
      ],
    },
  ],
}

export const LEGAL_PAGES: Record<LegalSlug, LegalPage> = {
  terms,
  'buyer-protection': buyerProtection,
  'seller-agreement': sellerAgreement,
  privacy,
}

export const LEGAL_ORDER: LegalSlug[] = ['terms', 'buyer-protection', 'seller-agreement', 'privacy']

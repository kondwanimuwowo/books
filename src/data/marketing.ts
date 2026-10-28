// Marketing pages. Every number comes from the constants the site runs on, so the pages follow a change of fee or rule.
import { formatMoney } from '#/lib/money'
import { DISPUTE_REPLY_HOURS, SHIP_WITHIN_DAYS } from './fulfilment'
import { COMMISSION_RATE, OFFER_REPLY_HOURS } from './listing-options'
import { instantFee } from './payouts'

const percent = `${Math.round(COMMISSION_RATE * 100)}%`
const examplePrice = 20_000
const exampleKeep = examplePrice - Math.round(examplePrice * COMMISSION_RATE)

export const SELL_PAGE = {
  path: '/sell-on-kuwala',
  metaTitle: 'Sell your books on Kuwala Books',
  metaDescription: `Free to list. ${percent} only when it sells. Paid by mobile money or bank.`,
  hero: {
    title: 'Your books have readers.',
    titleBold: 'Sell them here.',
    line: 'List in minutes and get paid by mobile money. One book or a whole bookshop.',
    cta: 'Start selling',
    secondary: 'How it works',
  },
  stepsHeading: 'How it works',
  steps: [
    { title: 'List it', body: 'Search the title or ISBN, or photograph the cover. We fill in the details; you set the price.' },
    {
      title: 'Send it',
      body: `The buyer pays first. You send the books within ${SHIP_WITHIN_DAYS} days by Yango, Platinum, Mercury or bus parcel, or they pick up from you.`,
    },
    { title: 'Get paid', body: 'Once the books arrive, the money is yours: to your mobile money or bank, free every Friday, or straight away if you’d rather.' },
  ],
  costsHeading: 'What it costs',
  costs: [
    { label: 'Listing', value: 'Free' },
    { label: 'Our fee', value: `${percent} of the book price, only when it sells` },
    { label: 'Delivery', value: 'The whole delivery fee is yours' },
    { label: 'Payouts', value: `Free every Friday, or straight away with Pay me now, less the transfer fee (from ${formatMoney(instantFee(0))})` },
  ],
  example: `Sell a book for ${formatMoney(examplePrice)} and you get ${formatMoney(exampleKeep)}, plus the delivery fee.`,
  whyHeading: 'Why sell here',
  why: [
    { title: 'Buyers pay up front.', body: 'The money is held safely until the books arrive. No chasing anyone for payment.' },
    {
      title: 'Offers without the haggling.',
      body: `Let buyers make offers and set a lowest price they never see. Everyone gets ${OFFER_REPLY_HOURS} hours to reply.`,
    },
    { title: 'Zambian books first.', body: 'Zambian authors get their own shelf and the Zambia Top 20.' },
  ],
  doors: [
    { title: 'Wrote the book?', body: 'Get verified as its author and sell copies direct.' },
    { title: 'Run a bookshop?', body: 'Open a shop with your logo and list your whole stock.' },
  ],
  faqHeading: 'Questions',
  faq: [
    { q: 'Do I need a registered business?', a: 'No. Anyone 18 or older can sell, or younger with a parent’s or guardian’s permission.' },
    { q: 'Can I sell used books and school books?', a: 'Yes, both, from like-new to well-loved. You grade the condition, and used copies need a photo.' },
    {
      q: 'What if a buyer says the books didn’t arrive?',
      a: `Upload your courier receipt when you send. If there’s a problem, you get ${DISPUTE_REPLY_HOURS} hours to give your side before we decide.`,
    },
    { q: 'How do I get paid?', a: 'Airtel Money, MTN MoMo, Zamtel Money or a bank account, set up once in your shop settings.' },
    { q: 'What can’t I sell?', a: 'Copies that aren’t genuine, and anything else the Seller agreement rules out.' },
  ],
  closing: 'Got a book on your shelf? List it in minutes.',
} as const

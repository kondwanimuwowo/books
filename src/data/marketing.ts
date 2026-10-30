// Marketing pages. Every number comes from the constants the site runs on, so the pages follow a change of fee or rule.
import { formatMoney } from '#/lib/money'
import { DECISION_WORKING_DAYS, DISPUTE_REPLY_HOURS, SHIP_WITHIN_DAYS } from './fulfilment'
import { COMMISSION_RATE, OFFER_HOLD_HOURS, OFFER_REPLY_HOURS } from './listing-options'
import { CARD_PAYMENTS, NETWORKS } from './payments'
import { instantFee } from './payouts'
import { AUTO_RELEASE_DAYS, PICKUP_RELEASE_DAYS } from './shipping'
import { YANGO_TOWNS } from './zambia'

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

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`
const networkList = (() => {
  const names = NETWORKS.map((n) => n.name)
  return names.length > 1 ? `${names.slice(0, -1).join(', ')} or ${names.at(-1)}` : (names[0] ?? 'mobile money')
})()

export const BUY_PAGE = {
  path: '/how-it-works',
  metaTitle: 'How buying works on Kuwala Books',
  metaDescription: 'Pay by mobile money. Your money is held until your books arrive.',
  hero: {
    title: 'Books from across Zambia.',
    titleBold: 'Paid for safely.',
    line: 'New and used books from readers, authors and bookshops. Your money is held until they reach you.',
    cta: 'Browse books',
    secondary: 'How it works',
  },
  stepsHeading: 'How it works',
  steps: [
    { title: 'Find it', body: 'Search by title, author or ISBN, or photograph a school book list. Compare copies by condition, price and seller.' },
    { title: 'Pay safely', body: `Pay with ${networkList}${CARD_PAYMENTS ? ' or card' : ''}, approved on your own phone. We hold the money; the seller isn’t paid yet.` },
    { title: 'Get your books', body: `The seller sends them within ${days(SHIP_WITHIN_DAYS)}. Confirm on your order page when they arrive, and only then is the seller paid.` },
  ],
  protectionHeading: 'Your money is protected',
  protection: [
    { title: 'Not sent? Refunded.', body: `If the seller doesn’t send your books within ${days(SHIP_WITHIN_DAYS)}, you get everything back, books and delivery, without asking.` },
    {
      title: 'Not right? Report it.',
      body: `Wrong book, missing pages, damaged, or worse than described: report it before you confirm. The seller has ${DISPUTE_REPLY_HOURS} hours to answer and we decide within ${days(DECISION_WORKING_DAYS)}.`,
    },
    { title: 'Refunds in minutes.', body: 'Mobile money refunds go back to the number that paid, usually within minutes.' },
  ],
  protectionLink: 'Read Buyer protection',
  deliveryHeading: 'Delivery',
  delivery: [
    { title: 'Yango Delivery', body: `By motorbike to your door, within ${YANGO_TOWNS.join(', ')}.` },
    { title: 'Platinum Courier', body: 'To you anywhere in Zambia.' },
    { title: 'Mercury Tigmoo', body: 'Premium courier, tracked to your door.' },
    { title: 'Bus parcel', body: 'Collect at your bus station with your order number.' },
    { title: 'Pick up', body: 'Meet the seller in their town and collect it yourself.' },
  ],
  deliveryNote: 'You see the delivery price before you pay, and sellers can’t charge more than our rates.',
  faqHeading: 'Questions',
  faq: [
    { q: 'Do I need an account?', a: 'Only to buy. It takes a minute, or continue with Google. Browsing doesn’t need one.' },
    {
      q: 'Can I pay by card?',
      a: CARD_PAYMENTS ? `Yes, or with ${networkList}.` : `Not yet. For now it’s mobile money: ${networkList}.`,
    },
    { q: 'Can I make an offer?', a: `On listings open to offers, yes. The seller has ${OFFER_REPLY_HOURS} hours to reply, and if they accept you have ${OFFER_HOLD_HOURS} hours to pay.` },
    { q: 'What if I change my mind?', a: 'There are no returns for a change of mind, so check the condition, notes and photos before you buy.' },
    {
      q: 'What if I forget to confirm?',
      a: `The money goes to the seller ${days(AUTO_RELEASE_DAYS)} after they send the parcel (${days(PICKUP_RELEASE_DAYS)} for pickup), unless you’ve reported a problem.`,
    },
    { q: 'Can I see prices in dollars?', a: 'Yes, switch to USD at the top of the page. It’s a guide; you always pay in kwacha.' },
  ],
  closing: 'Find your next book.',
} as const

// Illustrations for the marketing pages, as WebP in public/illustrations (originals stay out of git).
export const ILLUSTRATIONS = {
  bookMarket: { src: '/illustrations/book-market.webp', width: 1200, height: 800, alt: 'A woman reads the back of a book at a second-hand book stall in a Lusaka market while the stallholder smiles.' },
  schoolList: { src: '/illustrations/school-list.webp', width: 1200, height: 849, alt: 'A mother photographs a school book list at the kitchen table while her children check their books.' },
  busParcel: { src: '/illustrations/bus-parcel.webp', width: 1200, height: 800, alt: 'A woman shows her phone at a bus station parcel counter and is handed her parcel.' },
  grandmotherStory: { src: '/illustrations/grandmother-story.webp', width: 1200, height: 800, alt: 'A grandmother reads aloud to three children on a shaded veranda.' },
  jacarandaDelivery: { src: '/illustrations/jacaranda-delivery.webp', width: 1200, height: 800, alt: 'A motorbike rider hands a parcel over a gate under a flowering jacaranda tree.' },
  packing: { src: '/illustrations/packing.webp', width: 1000, height: 1000, alt: 'A seller wraps books in brown paper at his desk, a mine headframe through the window.' },
  moneyHeld: { src: '/illustrations/money-held.webp', width: 1000, height: 719, alt: 'An open hand holds a book and a phone under a shield, with delivered parcels around them.' },
  zambiaMap: {
    src: '/illustrations/zambia-map.webp',
    width: 1200,
    height: 805,
    alt: 'A map of Zambia with parcels and books travelling between Livingstone, Lusaka, the Copperbelt and beyond.',
  },
  bookSigning: { src: '/illustrations/book-signing.webp', width: 1200, height: 800, alt: 'An author signs a book for a reader at a launch while others queue with copies.' },
} as const

export type Illustration = (typeof ILLUSTRATIONS)[keyof typeof ILLUSTRATIONS]

import { formatMoney } from '#/lib/money'

// Shared links always point at the public site, whichever host rendered the page.
export const SITE_URL = 'https://kuwalabooks.com'

export const SHARE_COPY = {
  label: 'Share on WhatsApp',
  book: (book: { title: string; authors: string; fromNgwee: number | null }) =>
    [book.title, book.authors && `by ${book.authors}`, book.fromNgwee !== null && `from ${formatMoney(book.fromNgwee)}`].filter(Boolean).join(' ') + ' on Kuwala Books',
  author: (author: { name: string; books: number }) =>
    `${author.name} on Kuwala Books${author.books ? `: ${author.books} ${author.books === 1 ? 'book' : 'books'}` : ''}`,
  shop: (shop: { storeName: string; inStock: number }) =>
    `${shop.storeName} on Kuwala Books${shop.inStock ? `: ${shop.inStock} ${shop.inStock === 1 ? 'book' : 'books'} in stock` : ''}`,
} as const

export function whatsAppLink(text: string, path: string) {
  return `https://wa.me/?text=${encodeURIComponent(`${text}\n${SITE_URL}${path}`)}`
}

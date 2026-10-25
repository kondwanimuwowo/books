// Shown beside sign-in on desktop.
export const NAME_ENTRY = {
  word: 'kuwala',
  meaning: 'light',
}

// Pages that stand alone, without the store's header and footer.
export const BARE_ROUTES: readonly string[] = ['/login', '/signup', '/forgot-password']

// Brand files in public/: the kb mark (favicons, app icons, share fallback) and the wordmark for emails.
export const BRAND = {
  wordmark: '/brand/wordmark.png',
  // Recoloured for dark backgrounds: the burgundy header and dark mode.
  wordmarkLight: '/brand/wordmark-light.png',
  mark: '/icon-512.png',
} as const

// Shops without a logo get one of these, always the same one for a given shop.
const SHOP_FALLBACKS = ['shop-1', 'shop-2'] as const

function pick(seed: string) {
  let hash = 0
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) | 0
  return SHOP_FALLBACKS[Math.abs(hash) % SHOP_FALLBACKS.length]
}

/** For the page (small WebP) and for link previews (JPEG, which every chat app shows). */
export const shopFallback = (seed: string, use: 'page' | 'share' = 'page') => `/fallback/${pick(seed)}.${use === 'page' ? 'webp' : 'jpg'}`

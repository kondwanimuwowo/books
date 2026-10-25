// Sonnet where a seller is waiting on the answer; Haiku for small text jobs and the cron.
export const AI_MODELS = {
  reader: 'claude-sonnet-5-5',
  light: 'claude-haiku-5-5',
} as const

export type AiKind = 'photos' | 'tidy' | 'summary' | 'list' | 'search' | 'author'

// Per person per day. Generous for a real seller, a hard stop for a script.
export const AI_DAILY_LIMITS: Record<Exclude<AiKind, 'summary' | 'search' | 'author'>, number> = {
  photos: 40,
  tidy: 150,
  list: 15,
}

export const PHOTO_SLOTS = [
  { key: 'front', label: 'Front cover', required: true },
  { key: 'back', label: 'Back cover', required: false },
  { key: 'copyright', label: 'Copyright page', required: false },
] as const

export type PhotoSlot = (typeof PHOTO_SLOTS)[number]['key']

// Search is open to everyone, so it gets one site-wide daily budget instead of a per-person one.
export const AI_SEARCH_DAILY_CAP = 3000

// Searches that read like a request ("grade 7 maths in Bemba", "used novels") get interpreted even when they match something.
export const SEARCH_REQUEST_WORDS = /\b(grade|form|standard|in (bemba|nyanja|tonga|lozi|kaonde|lunda|luvale|english|french)|used|second[- ]?hand|zambian|for (kids|children|teens)|books? (on|about)|textbooks?)\b/i

// Words sellers type into a title that belong elsewhere on the listing.
export const TITLE_NOISE = /\b(hard\s?cover|hardback|paper\s?back|soft\s?cover|edition|by)\b/i

export const PHOTO_COPY = {
  open: 'Read it from photos',
  intro: 'Photograph the front, the back and the copyright page. We fill in what we can read; you check it.',
  reading: 'Reading your photos…',
  read: 'Read photos',
  filled: 'Filled in from your photos. Check every detail before you publish.',
} as const

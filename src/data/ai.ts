// Sonnet where a seller is waiting on the answer; Haiku for small text jobs and the cron.
export const AI_MODELS = {
  reader: 'claude-sonnet-5-5',
  light: 'claude-haiku-5-5',
} as const

export type AiKind = 'photos' | 'tidy' | 'summary'

// Per person per day. Generous for a real seller, a hard stop for a script.
export const AI_DAILY_LIMITS: Record<Exclude<AiKind, 'summary'>, number> = {
  photos: 40,
  tidy: 150,
}

export const PHOTO_SLOTS = [
  { key: 'front', label: 'Front cover', required: true },
  { key: 'back', label: 'Back cover', required: false },
  { key: 'copyright', label: 'Copyright page', required: false },
] as const

export type PhotoSlot = (typeof PHOTO_SLOTS)[number]['key']

// Words sellers type into a title that belong elsewhere on the listing.
export const TITLE_NOISE = /\b(hard\s?cover|hardback|paper\s?back|soft\s?cover|edition|by)\b/i

export const PHOTO_COPY = {
  open: 'Read it from photos',
  intro: 'Photograph the front, the back and the copyright page. We fill in what we can read; you check it.',
  reading: 'Reading your photos…',
  read: 'Read photos',
  filled: 'Filled in from your photos. Check every detail before you publish.',
} as const

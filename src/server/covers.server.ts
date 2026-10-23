import { env } from 'cloudflare:workers'

// Covers are stored under a random key; the key is the only thing clients ever see.
export const COVER_KEY = /^[0-9a-f-]{36}\.(webp|jpg)$/
export const MAX_COVER_BYTES = 800 * 1024

const TYPES = { webp: 'image/webp', jpg: 'image/jpeg' } as const

/** Sniff the real format from the first bytes; the file name and declared type are not trusted. */
export function detectImage(bytes: Uint8Array): keyof typeof TYPES | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  return null
}

export async function storeCover(bytes: Uint8Array, uploaderId: string) {
  const ext = detectImage(bytes)
  if (!ext) throw new Error('Use a JPEG or WebP photo')
  if (bytes.byteLength > MAX_COVER_BYTES) throw new Error('That photo is too large')
  const key = `${crypto.randomUUID()}.${ext}`
  await env.COVERS.put(key, bytes, { httpMetadata: { contentType: TYPES[ext] }, customMetadata: { uploader: uploaderId } })
  return key
}

/** The public path for a stored cover, or null if the key is unknown or someone else uploaded it. */
export async function ownedCoverUrl(key: string, uploaderId: string) {
  if (!COVER_KEY.test(key)) return null
  const head = await env.COVERS.head(key)
  if (!head || head.customMetadata?.uploader !== uploaderId) return null
  return `/covers/${key}`
}

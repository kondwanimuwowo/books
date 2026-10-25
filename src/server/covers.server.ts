import { env } from 'cloudflare:workers'

// Covers are stored under a random key; the key is the only thing clients ever see.
export const COVER_KEY = /^[0-9a-f-]{36}\.(webp|jpg|png)$/
export const MAX_COVER_BYTES = 800 * 1024
// Copies of publisher covers are larger than seller photos, which the browser shrinks before upload.
const MAX_MIRROR_BYTES = 3 * 1024 * 1024
// Anything narrower is a thumbnail or a placeholder, not worth keeping.
const MIN_MIRROR_WIDTH = 240

const TYPES = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' } as const

/** Sniff the real format from the first bytes; the file name and declared type are not trusted. */
export function detectImage(bytes: Uint8Array): keyof typeof TYPES | null {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg'
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp'
  if (ascii(1, 4) === 'PNG') return 'png'
  return null
}

/** Pixel width from the image header, or null if it can't be read. */
function imageWidth(bytes: Uint8Array, ext: keyof typeof TYPES) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (ext === 'png') return bytes.byteLength > 24 ? view.getUint32(16) : null
  if (ext === 'webp') {
    const chunk = String.fromCharCode(...bytes.slice(12, 16))
    if (chunk === 'VP8 ') return view.getUint16(26, true) & 0x3fff
    if (chunk === 'VP8L') return (view.getUint16(21, true) & 0x3fff) + 1
    if (chunk === 'VP8X') return (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16)) + 1
    return null
  }
  // JPEG: walk the segments to the start-of-frame marker.
  let i = 2
  while (i + 9 < bytes.byteLength) {
    if (bytes[i] !== 0xff) return null
    const marker = bytes[i + 1]
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) return view.getUint16(i + 7)
    i += 2 + view.getUint16(i + 2)
  }
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

/** Keeps our own copy of a cover found online, so pages don't depend on Google or Open Library staying up. */
export function mirrorCover(url: string, bookId: string) {
  return mirrorImage(url, { book: bookId })
}

/** Copies an image from the web into the covers bucket, or null if it isn't a usable image. */
export async function mirrorImage(url: string, meta: Record<string, string>) {
  try {
    const response = await fetch(url, { headers: { 'User-Agent': 'KuwalaBooks/1.0 (https://kuwalabooks.com)' } })
    if (!response.ok) return null
    const bytes = new Uint8Array(await response.arrayBuffer())
    const ext = detectImage(bytes)
    if (!ext || bytes.byteLength > MAX_MIRROR_BYTES || (imageWidth(bytes, ext) ?? 0) < MIN_MIRROR_WIDTH) return null
    const key = `${crypto.randomUUID()}.${ext}`
    await env.COVERS.put(key, bytes, { httpMetadata: { contentType: TYPES[ext] }, customMetadata: { ...meta, source: url } })
    return `/covers/${key}`
  } catch {
    return null
  }
}

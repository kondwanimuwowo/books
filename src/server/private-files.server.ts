import { env } from 'cloudflare:workers'
import { COVER_KEY, detectImage } from './covers.server'
import { AppError } from './errors.server'

// ID documents for verification. This bucket has no public route; only admins read it, through /admin-files/<key>.
// Larger than covers: an NRC has to stay legible.
const MAX_DOCUMENT_BYTES = 1.5 * 1024 * 1024
const TYPES = { webp: 'image/webp', jpg: 'image/jpeg', png: 'image/png' } as const

export async function storePrivate(bytes: Uint8Array, uploaderId: string) {
  const ext = detectImage(bytes)
  if (!ext) throw new AppError('Use a JPEG or WebP photo')
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw new AppError('That photo is too large')
  const key = `${crypto.randomUUID()}.${ext}`
  await env.PRIVATE.put(key, bytes, { httpMetadata: { contentType: TYPES[ext] }, customMetadata: { uploader: uploaderId } })
  return key
}

/** True when the key exists and this person uploaded it. */
export async function ownsPrivate(key: string, uploaderId: string) {
  if (!COVER_KEY.test(key)) return false
  const head = await env.PRIVATE.head(key)
  return head?.customMetadata?.uploader === uploaderId
}

export function readPrivate(key: string) {
  return COVER_KEY.test(key) ? env.PRIVATE.get(key) : Promise.resolve(null)
}

export async function deletePrivate(keys: string[]) {
  const valid = keys.filter((k) => COVER_KEY.test(k))
  if (valid.length) await env.PRIVATE.delete(valid)
}

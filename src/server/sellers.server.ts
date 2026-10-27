import { eq } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { profiles, sellers } from '#/db/schema'
import type { Province } from '#/data/zambia'
import type { SellerKind } from '#/data/listing-options'
import { randomCode, slugify } from '#/lib/utils'
import { AppError } from './errors.server'

export interface SellerProfileInput {
  storeName: string
  kind: SellerKind
  bio?: string
  phone: string
  town: string
  province: Province
  /** Undefined keeps the current photo. */
  photoUrl?: string
}

/** Opens the shop on first save, updates it after. Returns the shop's address. */
export async function writeSellerProfile(db: Db, profileId: string, data: SellerProfileInput) {
  const [existing] = await db.select({ id: sellers.id, slug: sellers.slug, photoUrl: sellers.photoUrl }).from(sellers).where(eq(sellers.profileId, profileId)).limit(1)
  // Readers meet authors through their face; the page and its share preview depend on it.
  if (data.kind === 'author' && !data.photoUrl && !existing?.photoUrl) throw new AppError('Add a photo of yourself')
  const values = {
    storeName: data.storeName,
    kind: data.kind,
    bio: data.bio || null,
    phone: data.phone,
    town: data.town,
    province: data.province,
    ...(data.photoUrl && { photoUrl: data.photoUrl }),
  }
  let slug = existing?.slug
  if (existing) {
    await db.update(sellers).set(values).where(eq(sellers.id, existing.id))
  } else {
    const base = slugify(data.storeName) || 'shop'
    const [taken] = await db.select({ id: sellers.id }).from(sellers).where(eq(sellers.slug, base)).limit(1)
    slug = taken ? `${base}-${randomCode(4)}` : base
    await db.insert(sellers).values({ ...values, profileId, slug })
  }
  await db.update(profiles).set({ phone: data.phone, town: data.town, province: data.province }).where(eq(profiles.id, profileId))
  return slug as string
}

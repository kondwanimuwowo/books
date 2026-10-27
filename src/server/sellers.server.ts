import { eq } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { profiles, sellers } from '#/db/schema'
import type { Province } from '#/data/zambia'
import type { SellerKind } from '#/data/listing-options'
import { toNgwee } from '#/lib/money'
import { randomCode, slugify } from '#/lib/utils'
import type { DeliverySettingsInput, PayoutDetailsInput, SellerProfileFormInput } from '#/schemas/sell'
import { ownedCoverUrl } from './covers.server'
import { AppError } from './errors.server'
import { createMobileMoneyRecipient, resolveMobileMoney } from './lenco.server'

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

/** The member's own details and shop, for the shop settings forms. */
export async function loadSellerSetup(db: Db, profileId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.id, profileId)).limit(1)
  const [seller] = await db.select().from(sellers).where(eq(sellers.profileId, profileId)).limit(1)
  return {
    profile: profile ? { displayName: profile.displayName, phone: profile.phone, town: profile.town, province: profile.province } : null,
    seller: seller
      ? {
          slug: seller.slug,
          storeName: seller.storeName,
          kind: seller.kind,
          bio: seller.bio,
          photoUrl: seller.photoUrl,
          phone: seller.phone,
          town: seller.town,
          province: seller.province,
          verified: seller.verifiedAt !== null,
          payoutMethod: seller.payoutMethod,
          payoutPhone: seller.payoutPhone,
          payoutOperator: seller.payoutOperator,
          payoutAccountName: seller.payoutAccountName,
          deliveryMethods: seller.deliveryMethods,
          freeDeliveryOverNgwee: seller.freeDeliveryOverNgwee,
        }
      : null,
  }
}

export async function saveSellerProfileFor(db: Db, profileId: string, input: SellerProfileFormInput) {
  const { photoKey, ...profile } = input
  const photoUrl = photoKey ? await ownedCoverUrl(photoKey, profileId) : undefined
  if (photoUrl === null) throw new AppError('That photo didn’t upload. Add it again.')
  const slug = await writeSellerProfile(db, profileId, { ...profile, photoUrl })
  return { slug }
}

export async function updateDeliverySettings(db: Db, sellerId: string, input: DeliverySettingsInput) {
  await db
    .update(sellers)
    .set({
      deliveryMethods: [...new Set(input.methods)],
      freeDeliveryOverNgwee: input.freeOverKwacha === null ? null : toNgwee(input.freeOverKwacha),
    })
    .where(eq(sellers.id, sellerId))
  return { ok: true }
}

export async function savePayoutDestination(db: Db, sellerId: string, input: PayoutDetailsInput) {
  const resolved = await resolveMobileMoney(input.phone, input.operator).catch(() => null)
  if (!resolved) throw new AppError('We couldn’t find a mobile money account on that number')
  const recipient = await createMobileMoneyRecipient(input.phone, input.operator)
  await db
    .update(sellers)
    .set({
      payoutMethod: 'mobile_money',
      payoutPhone: input.phone,
      payoutOperator: input.operator,
      payoutAccountName: resolved.accountName,
      lencoRecipientId: recipient.id,
    })
    .where(eq(sellers.id, sellerId))
  // Anything waiting is paid on the next payout day, or now if they tap Pay me now.
  return { accountName: resolved.accountName }
}

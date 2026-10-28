import { env } from 'cloudflare:workers'
import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { authors, profiles, sellers } from '#/db/schema'
import type { SessionUser } from './auth'

/**
 * The sign-up trigger only knows our own display_name field, so a Google sign-up starts out named after its email.
 * Take the name Google gave us instead, but never over one the person has set themselves.
 */
export async function adoptProviderName(db: Db, user: { id: string; email?: string; user_metadata: Record<string, unknown> }) {
  const name = String(user.user_metadata.full_name ?? user.user_metadata.name ?? '').trim().slice(0, 80)
  if (name.length < 2 || !user.email) return
  await db
    .update(profiles)
    .set({ displayName: name })
    .where(and(eq(profiles.id, user.id), eq(profiles.displayName, user.email.split('@')[0])))
}

/** What every page needs to know about the signed-in member. */
export async function loadMember(db: Db, user: SessionUser) {
  const [row] = await db
    .select({
      displayName: profiles.displayName,
      isAdmin: profiles.isAdmin,
      termsVersion: profiles.termsVersion,
      sellerSlug: sellers.slug,
      town: profiles.town,
      province: profiles.province,
      isAuthor: sql<boolean>`exists (select 1 from ${authors} where ${authors.verifiedSellerId} = ${sellers.id})`,
      sellerKind: sellers.kind,
      sellerVerified: sql<boolean>`${sellers.verifiedAt} is not null`,
      verificationPending: sql<boolean>`exists (select 1 from verification_requests v where v.seller_id = ${sellers.id} and v.status = 'pending')`,
    })
    .from(profiles)
    .leftJoin(sellers, eq(sellers.profileId, profiles.id))
    .where(eq(profiles.id, user.id))
    .limit(1)
  // A token outliving its deleted account (they last up to an hour): treat it as signed out.
  if (!row) return null
  return {
    id: user.id,
    email: user.email,
    displayName: row.displayName,
    isAdmin: row?.isAdmin ?? false,
    // Admin runs on its own host with its own sign-in.
    adminUrl: row?.isAdmin ? (env.ADMIN_ORIGIN ?? '/admin') : null,
    sellerSlug: row?.sellerSlug ?? null,
    // Where they usually receive books, for delivery estimates on book pages.
    place: row?.town && row.province ? { town: row.town, province: row.province } : null,
    isAuthor: row?.isAuthor ?? false,
    // Compared with TERMS_VERSION to ask for acceptance once.
    termsVersion: row?.termsVersion ?? null,
    // Everyone starts as a reader; opening a shop gives them its kind.
    role: { kind: row?.sellerKind ?? null, verified: row?.sellerVerified ?? false, pending: row?.verificationPending ?? false },
  }
}

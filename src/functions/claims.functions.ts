import { createServerFn } from '@tanstack/react-start'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { authorDrafts, authors, bookAuthors } from '#/db/schema'
import { INVITE_DAYS } from '#/data/claims'
import { sha256 } from '#/server/tokens.server'

const tokenSchema = z.object({ token: z.string().min(20).max(64) })

async function findInvite(token: string) {
  const [row] = await getDb()
    .select({
      draftId: authorDrafts.id,
      invitedAt: authorDrafts.invitedAt,
      optedOut: sql<boolean>`${authorDrafts.optedOutAt} is not null`,
      email: sql<string | null>`${authorDrafts.contact}->>'email'`,
      author: {
        id: authors.id,
        slug: authors.slug,
        name: authors.name,
        bio: authors.bio,
        photoUrl: authors.photoUrl,
        claimed: sql<boolean>`${authors.verifiedSellerId} is not null`,
        books: sql<number>`(select count(*)::int from ${bookAuthors} ba where ba.author_id = ${authors.id})`,
      },
    })
    .from(authorDrafts)
    .innerJoin(authors, eq(authors.id, authorDrafts.authorId))
    .where(eq(authorDrafts.inviteTokenHash, await sha256(token)))
    .limit(1)
  return row ?? null
}

/** The invite behind a claim link. Whoever holds the link is who we invited, so their email can prefill sign-up. */
export const getClaim = createServerFn({ method: 'GET' })
  .validator(tokenSchema)
  .handler(async ({ data }) => {
    const invite = await findInvite(data.token)
    if (!invite) return { state: 'missing' as const }
    const expired = !invite.invitedAt || Date.now() - invite.invitedAt.getTime() > INVITE_DAYS * 86_400_000
    const state = invite.author.claimed ? ('claimed' as const) : invite.optedOut ? ('stopped' as const) : expired ? ('expired' as const) : ('open' as const)
    return { state, author: invite.author, email: state === 'open' ? invite.email : null }
  })

/** "Don't contact me again": stops invites and forgets the contact details we found. */
export const stopInvites = createServerFn({ method: 'POST' })
  .validator(tokenSchema)
  .handler(async ({ data }) => {
    const invite = await findInvite(data.token)
    if (!invite) throw new Error('That link isn’t valid')
    await getDb().update(authorDrafts).set({ optedOutAt: new Date(), contact: {}, inviteTokenHash: null }).where(eq(authorDrafts.id, invite.draftId))
    return { ok: true }
  })

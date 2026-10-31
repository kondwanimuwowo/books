import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { authors, books, favourites, follows, publishers, sellers } from '#/db/schema'
import { savedKey } from '#/schemas/favourites'
import type { SaveKind, SetSavedInput } from '#/schemas/favourites'
import { cardColumns, offersSubquery } from './catalog.server'
import { cheapestFor } from './alerts.server'
import { NotFoundError } from './errors.server'

type FollowKind = Exclude<SaveKind, 'book'>

const FOLLOW_TARGETS = {
  author: { table: authors, name: authors.name, column: follows.authorId },
  seller: { table: sellers, name: sellers.storeName, column: follows.sellerId },
  publisher: { table: publishers, name: publishers.name, column: follows.publisherId },
} as const

/** Everything the reader has saved or follows, keyed for the client so any page can fill its buttons. */
export async function savedKeys(db: Db, profileId: string) {
  const [saved, followed] = await Promise.all([
    db.select({ slug: books.slug }).from(favourites).innerJoin(books, eq(books.id, favourites.bookId)).where(eq(favourites.profileId, profileId)),
    following(db, profileId),
  ])
  return [...saved.map((r) => savedKey('book', r.slug)), ...followed.map((f) => savedKey(f.kind, f.slug))]
}

async function targetId(db: Db, kind: SaveKind, slug: string) {
  const table = kind === 'book' ? books : FOLLOW_TARGETS[kind].table
  const [row] = await db.select({ id: table.id }).from(table).where(eq(table.slug, slug)).limit(1)
  if (!row) throw new NotFoundError()
  return row.id
}

export async function setSaved(db: Db, profileId: string, input: SetSavedInput) {
  const id = await targetId(db, input.kind, input.slug)
  if (input.kind === 'book') {
    // Alerts compare against the price when it was saved.
    if (input.saved) await db.insert(favourites).values({ profileId, bookId: id, seenPriceNgwee: cheapestFor(id, profileId) }).onConflictDoNothing()
    else await db.delete(favourites).where(and(eq(favourites.profileId, profileId), eq(favourites.bookId, id)))
  } else {
    const target = { author: { authorId: id }, seller: { sellerId: id }, publisher: { publisherId: id } }[input.kind]
    if (input.saved) await db.insert(follows).values({ profileId, ...target }).onConflictDoNothing()
    else await db.delete(follows).where(and(eq(follows.profileId, profileId), eq(FOLLOW_TARGETS[input.kind].column, id)))
  }
  return { saved: input.saved }
}

/** Who the reader follows, newest first. */
async function following(db: Db, profileId: string) {
  const rows = await Promise.all(
    (Object.keys(FOLLOW_TARGETS) as FollowKind[]).map(async (kind) => {
      const t = FOLLOW_TARGETS[kind]
      const found = await db
        .select({ slug: t.table.slug, name: t.name, at: follows.createdAt })
        .from(follows)
        .innerJoin(t.table, eq(t.table.id, t.column))
        .where(eq(follows.profileId, profileId))
      return found.map((f) => ({ kind, ...f }))
    }),
  )
  return rows.flat().sort((a, b) => b.at.getTime() - a.at.getTime())
}

/** The Saved page: saved books as cards, newest saved first (sold-out books stay, showing no copies), and who they follow. */
export async function savedPage(db: Db, profileId: string) {
  const offers = offersSubquery(db)
  const [saved, followed] = await Promise.all([
    db
      .select(cardColumns(offers))
      .from(favourites)
      .innerJoin(books, eq(books.id, favourites.bookId))
      .leftJoin(offers, eq(offers.bookId, books.id))
      .where(eq(favourites.profileId, profileId))
      .orderBy(desc(favourites.createdAt)),
    following(db, profileId),
  ])
  return { books: saved, following: followed.map(({ kind, slug, name }) => ({ kind, slug, name })) }
}

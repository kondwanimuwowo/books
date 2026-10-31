import { and, desc, eq } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { books, favourites } from '#/db/schema'
import type { SetFavouriteInput } from '#/schemas/favourites'
import { cardColumns, offersSubquery } from './catalog.server'
import { NotFoundError } from './errors.server'

/** The slugs of every book the reader has saved, so any page can fill its hearts. */
export async function savedSlugs(db: Db, profileId: string) {
  const rows = await db.select({ slug: books.slug }).from(favourites).innerJoin(books, eq(books.id, favourites.bookId)).where(eq(favourites.profileId, profileId))
  return rows.map((r) => r.slug)
}

export async function setFavourite(db: Db, profileId: string, input: SetFavouriteInput) {
  const [book] = await db.select({ id: books.id }).from(books).where(eq(books.slug, input.slug)).limit(1)
  if (!book) throw new NotFoundError()
  if (input.saved) await db.insert(favourites).values({ profileId, bookId: book.id }).onConflictDoNothing()
  else await db.delete(favourites).where(and(eq(favourites.profileId, profileId), eq(favourites.bookId, book.id)))
  return { saved: input.saved }
}

/** Saved books as cards, newest saved first; sold-out books stay, showing no copies. */
export async function savedBooks(db: Db, profileId: string) {
  const offers = offersSubquery(db)
  return db
    .select(cardColumns(offers))
    .from(favourites)
    .innerJoin(books, eq(books.id, favourites.bookId))
    .leftJoin(offers, eq(offers.bookId, books.id))
    .where(eq(favourites.profileId, profileId))
    .orderBy(desc(favourites.createdAt))
}

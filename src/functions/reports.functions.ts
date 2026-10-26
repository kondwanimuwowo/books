import { createServerFn } from '@tanstack/react-start'
import { and, desc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { books, listingReports, listings, profiles, sellers } from '#/db/schema'
import { REPORT_COPY, REPORT_REASONS } from '#/data/listing-options'
import { requireAdminMiddleware, requireUserMiddleware } from '#/server/auth'
import { escapeHtml, sendEmail } from '#/server/email.server'

const reasons = REPORT_REASONS.map((r) => r.value) as [string, ...string[]]

/** A reader flags a copy. One report per person per listing; reporting again just updates it. */
export const reportListing = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(z.object({ listingId: z.string().uuid(), reason: z.enum(reasons), note: z.string().trim().max(500) }))
  .handler(async ({ data, context }) => {
    const values = { reason: data.reason as (typeof REPORT_REASONS)[number]['value'], note: data.note || null, status: 'open' as const }
    await getDb()
      .insert(listingReports)
      .values({ listingId: data.listingId, reporterId: context.user.id, ...values })
      .onConflictDoUpdate({ target: [listingReports.listingId, listingReports.reporterId], set: values })
    return { ok: true }
  })

export const listReports = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .handler(async () => {
    return getDb()
      .select({
        id: listingReports.id,
        reason: listingReports.reason,
        note: listingReports.note,
        status: listingReports.status,
        createdAt: listingReports.createdAt,
        listing: { id: listings.id, photos: listings.photos, condition: listings.condition, status: listings.status },
        book: { slug: books.slug, title: books.title, coverUrl: books.coverUrl },
        seller: { slug: sellers.slug, storeName: sellers.storeName },
      })
      .from(listingReports)
      .innerJoin(listings, eq(listings.id, listingReports.listingId))
      .innerJoin(books, eq(books.id, listings.bookId))
      .innerJoin(sellers, eq(sellers.id, listings.sellerId))
      .orderBy(desc(eq(listingReports.status, 'open')), desc(listingReports.createdAt))
      .limit(200)
  })

/** Take the listing down (and tell the seller), or dismiss the report. Every open report on that listing closes with it. */
export const decideReport = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.string().uuid(), decision: z.enum(['removed', 'dismissed']) }))
  .handler(async ({ data }) => {
    const db = getDb()
    const [report] = await db.select({ listingId: listingReports.listingId }).from(listingReports).where(eq(listingReports.id, data.id)).limit(1)
    if (!report) throw new Error('That report is gone')
    await db
      .update(listingReports)
      .set({ status: data.decision, resolvedAt: new Date() })
      .where(and(eq(listingReports.listingId, report.listingId), eq(listingReports.status, 'open')))
    if (data.decision === 'removed') {
      const [listing] = await db
        .update(listings)
        .set({ status: 'removed' })
        .where(eq(listings.id, report.listingId))
        .returning({ bookId: listings.bookId, sellerId: listings.sellerId })
      const [who] = listing
        ? await db
            .select({ email: profiles.email, title: books.title })
            .from(sellers)
            .innerJoin(profiles, eq(profiles.id, sellers.profileId))
            .innerJoin(books, eq(books.id, listing.bookId))
            .where(eq(sellers.id, listing.sellerId))
            .limit(1)
        : []
      if (who) await sendEmail({ to: who.email, subject: REPORT_COPY.removedSubject(who.title), lines: REPORT_COPY.removedLines(who.title).map(escapeHtml) })
    }
    return { ok: true }
  })

import { notFound } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { env } from 'cloudflare:workers'
import { and, desc, eq, isNull, sql } from 'drizzle-orm'
import { z } from 'zod'
import { getDb } from '#/db/client.server'
import { authorDrafts, authors, bookAuthors } from '#/db/schema'
import type { AuthorLinks, DraftBook } from '#/db/schema'
import { CLAIM_COPY, INVITE_DAYS } from '#/data/claims'
import { slugify } from '#/lib/utils'
import { requireAdminMiddleware } from '#/server/auth'
import { draftAuthor } from '#/server/ai.server'
import { lookupIsbn } from '#/server/book-sources.server'
import { findOrCreateBook, refreshSearchText, uniqueSlug } from '#/server/catalog.server'
import { escapeHtml, sendEmail } from '#/server/email.server'
import { mirrorImage } from '#/server/covers.server'
import { newToken, sha256 } from '#/server/tokens.server'

const LINK_KEYS = ['website', 'facebook', 'instagram', 'x', 'tiktok'] as const

export const listDrafts = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .handler(async () => {
    return getDb()
      .select({
        id: authorDrafts.id,
        name: authorDrafts.name,
        books: sql<number>`jsonb_array_length(${authorDrafts.books})::int`,
        photo: sql<string | null>`coalesce(${authors.photoUrl}, case when (${authorDrafts.extras}->>'usePhoto')::boolean then ${authorDrafts.extras}->'photo'->>'url' end)`,
        hasContact: sql<boolean>`${authorDrafts.contact} ? 'email' or ${authorDrafts.contact} ? 'phone'`,
        invitedAt: authorDrafts.invitedAt,
        optedOut: sql<boolean>`${authorDrafts.optedOutAt} is not null`,
        published: sql<boolean>`${authorDrafts.authorId} is not null`,
        claimed: sql<boolean>`${authors.verifiedSellerId} is not null`,
        updatedAt: authorDrafts.updatedAt,
      })
      .from(authorDrafts)
      .leftJoin(authors, eq(authors.id, authorDrafts.authorId))
      .orderBy(sql`${authorDrafts.authorId} is not null`, desc(authorDrafts.updatedAt))
  })

export const getDraft = createServerFn({ method: 'GET' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    const [row] = await getDb()
      .select({
        draft: authorDrafts,
        author: { slug: authors.slug, photoUrl: authors.photoUrl, claimed: sql<boolean>`${authors.verifiedSellerId} is not null` },
      })
      .from(authorDrafts)
      .leftJoin(authors, eq(authors.id, authorDrafts.authorId))
      .where(eq(authorDrafts.id, data.id))
      .limit(1)
    if (!row) throw notFound()
    return row
  })

export const createDraft = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ name: z.string().trim().min(3).max(120), hints: z.string().trim().max(600) }))
  .handler(async ({ data, context }) => {
    const db = getDb()
    const reading = await draftAuthor(db, context.user.id, data)
    if (!reading) throw new Error('The research didn’t finish. Try again in a minute.')
    if (!reading.found) throw new Error(`Couldn’t find enough about ${data.name} online. Add a hint, like a book title or their town.`)
    const links = Object.fromEntries(LINK_KEYS.flatMap((k) => (reading.links[k] ? [[k, reading.links[k]]] : []))) as AuthorLinks
    const [draft] = await db
      .insert(authorDrafts)
      .values({
        name: reading.name,
        isZambian: reading.isZambian,
        bio: reading.bio,
        links,
        books: reading.books,
        sources: reading.sources,
        contact: {
          ...(reading.contactEmail && { email: reading.contactEmail, emailSource: reading.contactEmailSource ?? undefined }),
          ...(reading.contactPhone && { phone: reading.contactPhone, phoneSource: reading.contactPhoneSource ?? undefined }),
        },
        extras: {
          ...(reading.photoUrl && reading.photoSource && { photo: { url: reading.photoUrl, source: reading.photoSource } }),
          initiatives: reading.initiatives,
        },
        invite: { subject: reading.inviteSubject, body: reading.inviteBody, whatsapp: reading.inviteWhatsapp },
        createdBy: context.user.id,
      })
      .returning({ id: authorDrafts.id })
    return draft
  })

const bookSchema = z.object({ title: z.string().trim().min(1).max(300), year: z.number().int().nullable(), publisher: z.string().trim().max(200).nullable(), isbn: z.string().trim().max(20).nullable() })

export const saveDraft = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(
    z.object({
      id: z.string().uuid(),
      name: z.string().trim().min(2).max(120),
      isZambian: z.boolean(),
      bio: z.string().trim().max(2000),
      links: z.record(z.enum(LINK_KEYS), z.string().trim().max(200)),
      books: z.array(bookSchema).max(40),
      email: z.string().trim().max(200),
      phone: z.string().trim().max(40),
      invite: z.object({ subject: z.string().trim().max(120), body: z.string().trim().max(3000), whatsapp: z.string().trim().max(600) }),
      usePhoto: z.boolean(),
      initiatives: z.array(z.object({ name: z.string().trim().min(1).max(200), url: z.string().trim().max(300).nullable(), note: z.string().trim().max(400) })).max(20),
    }),
  )
  .handler(async ({ data }) => {
    const db = getDb()
    const [current] = await db.select({ contact: authorDrafts.contact, extras: authorDrafts.extras }).from(authorDrafts).where(eq(authorDrafts.id, data.id)).limit(1)
    if (!current) throw new Error('That draft is gone')
    const links = Object.fromEntries(Object.entries(data.links).filter(([, v]) => v)) as AuthorLinks
    await db
      .update(authorDrafts)
      .set({
        name: data.name,
        isZambian: data.isZambian,
        bio: data.bio,
        links,
        books: data.books,
        // A source only stays with the detail it was found for.
        contact: {
          ...(data.email && { email: data.email, emailSource: data.email === current.contact.email ? current.contact.emailSource : undefined }),
          ...(data.phone && { phone: data.phone, phoneSource: data.phone === current.contact.phone ? current.contact.phoneSource : undefined }),
        },
        invite: data.invite,
        extras: { ...current.extras, usePhoto: data.usePhoto && !!current.extras.photo, initiatives: data.initiatives },
      })
      .where(eq(authorDrafts.id, data.id))
    return { ok: true }
  })

export const deleteDraft = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data }) => {
    await getDb()
      .delete(authorDrafts)
      .where(and(eq(authorDrafts.id, data.id), isNull(authorDrafts.authorId)))
    return { ok: true }
  })

/** Puts the page live: fills a catalogue author of the same name, or creates one, and adds books we can match by ISBN. */
export const publishDraft = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    const db = getDb()
    const [draft] = await db.select().from(authorDrafts).where(eq(authorDrafts.id, data.id)).limit(1)
    if (!draft) throw new Error('That draft is gone')
    if (draft.authorId) throw new Error('Already published')
    if (!draft.bio) throw new Error('Add a bio first')

    const slug = slugify(draft.name)
    const [existing] = await db.select().from(authors).where(eq(authors.slug, slug)).limit(1)
    if (existing?.verifiedSellerId) throw new Error(`${existing.name} has already claimed their page`)
    const [author] = existing
      ? await db
          .update(authors)
          .set({ bio: existing.bio ?? draft.bio, links: { ...draft.links, ...existing.links }, isZambian: existing.isZambian || draft.isZambian })
          .where(eq(authors.id, existing.id))
          .returning({ id: authors.id, slug: authors.slug, name: authors.name, isZambian: authors.isZambian })
      : await db
          .insert(authors)
          .values({ slug: await uniqueSlug(db, authors, slug), name: draft.name, bio: draft.bio, links: draft.links, isZambian: draft.isZambian })
          .returning({ id: authors.id, slug: authors.slug, name: authors.name, isZambian: authors.isZambian })
    await db.update(authorDrafts).set({ authorId: author.id }).where(eq(authorDrafts.id, draft.id))

    // Their own portrait, from a page they run, only when admin chose to use it; never over a photo already there.
    let photo = false
    if (draft.extras.usePhoto && draft.extras.photo && !existing?.photoUrl) {
      const photoUrl = await mirrorImage(draft.extras.photo.url, { author: author.id })
      if (photoUrl) {
        await db.update(authors).set({ photoUrl }).where(eq(authors.id, author.id))
        photo = true
      }
    }

    // Only books we can confirm by ISBN reach the catalogue; the rest stay in the draft for reference.
    let added = 0
    for (const book of draft.books) {
      const candidate = book.isbn ? await lookupIsbn(book.isbn).catch(() => null) : null
      if (!candidate) continue
      const created = await findOrCreateBook(db, { candidate: { ...candidate, authors: [author.name] }, categoryId: null, markZambian: author.isZambian, createdBy: context.user.id })
      await db.insert(bookAuthors).values({ bookId: created.id, authorId: author.id }).onConflictDoNothing()
      await refreshSearchText(db, created.id)
      added++
    }
    return { slug: author.slug, added, photo }
  })

/** Sends the invite by email, or returns a WhatsApp link with it typed out. Each invite gets a fresh link. */
export const sendInvite = createServerFn({ method: 'POST' })
  .middleware([requireAdminMiddleware])
  .validator(z.object({ id: z.string().uuid(), channel: z.enum(['email', 'whatsapp']) }))
  .handler(async ({ data }) => {
    const db = getDb()
    const [row] = await db
      .select({ draft: authorDrafts, claimed: sql<boolean>`${authors.verifiedSellerId} is not null` })
      .from(authorDrafts)
      .innerJoin(authors, eq(authors.id, authorDrafts.authorId))
      .where(eq(authorDrafts.id, data.id))
      .limit(1)
    if (!row) throw new Error('Publish the page before inviting')
    const { draft } = row
    if (row.claimed) throw new Error('They’ve already claimed it')
    if (draft.optedOutAt) throw new Error('They asked not to be contacted')
    if (!draft.invite) throw new Error('Write the invite first')
    const to = data.channel === 'email' ? draft.contact.email : draft.contact.phone?.replace(/[^\d]/g, '')
    if (!to) throw new Error(data.channel === 'email' ? 'Add an email address first' : 'Add a phone number first')

    const token = newToken()
    await db.update(authorDrafts).set({ inviteTokenHash: await sha256(token), invitedAt: new Date() }).where(eq(authorDrafts.id, draft.id))
    const link = `${env.APP_ORIGIN}/claim/${token}`
    if (data.channel === 'whatsapp') return { whatsapp: `https://wa.me/${to}?text=${encodeURIComponent(`${draft.invite.whatsapp}\n\n${link}`)}` }

    await sendEmail({
      to,
      subject: draft.invite.subject,
      lines: [...draft.invite.body.split(/\n{2,}/).map((p) => escapeHtml(p).replace(/\n/g, '<br>')), `<span style="font-size:13px;color:#776453">${CLAIM_COPY.emailFooter(INVITE_DAYS)}</span>`],
      action: { label: CLAIM_COPY.emailAction, path: `/claim/${token}` },
    })
    return { whatsapp: null }
  })

export type DraftRow = Awaited<ReturnType<typeof getDraft>>
export type { DraftBook }

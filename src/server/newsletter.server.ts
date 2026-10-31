import { and, eq, sql } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { newsletterSubscribers, profiles } from '#/db/schema'
import { NEWSLETTER_COPY } from '#/data/emails'
import type { EmailPrefInput, SubscribeInput, UnsubscribeInput } from '#/schemas/emails'
import { AppError } from './errors.server'
import { addToReaders, removeFromReaders, sendNews } from './brevo.server'
import type { SessionUser } from './session.server'
import { newToken } from './tokens.server'

const byEmail = (email: string) => sql`lower(${newsletterSubscribers.email}) = ${email.toLowerCase()}`
// A sign-up waiting on its confirmation link isn't sent another one this soon.
const RESEND_AFTER_HOURS = 24

/** The footer and About form: a confirmation email first, the list only once they tap it. */
export async function subscribe(db: Db, input: SubscribeInput) {
  if (input.website) return { ok: true }
  const [existing] = await db.select().from(newsletterSubscribers).where(byEmail(input.email)).limit(1)
  if (existing?.confirmedAt && !existing.unsubscribedAt) return { ok: true }
  if (existing && !existing.confirmedAt && existing.updatedAt > new Date(Date.now() - RESEND_AFTER_HOURS * 3_600_000)) return { ok: true }

  const token = newToken()
  const values = { token, source: input.source, consentedAt: new Date(), confirmedAt: null, unsubscribedAt: null }
  if (existing) await db.update(newsletterSubscribers).set(values).where(eq(newsletterSubscribers.id, existing.id))
  else await db.insert(newsletterSubscribers).values({ email: input.email, ...values })
  await sendNews({
    to: input.email,
    subject: NEWSLETTER_COPY.confirmSubject,
    lines: [...NEWSLETTER_COPY.confirmLines],
    action: { label: NEWSLETTER_COPY.confirmAction, path: `/newsletter/confirm?t=${token}` },
  })
  return { ok: true }
}

export async function confirmSubscription(db: Db, token: string) {
  const [row] = await db
    .update(newsletterSubscribers)
    .set({ confirmedAt: new Date(), unsubscribedAt: null })
    .where(eq(newsletterSubscribers.token, token))
    .returning({ email: newsletterSubscribers.email, firstName: newsletterSubscribers.firstName })
  if (!row) throw new AppError(NEWSLETTER_COPY.badToken)
  await addToReaders(row.email, row.firstName)
  return { ok: true }
}

/** From the link in an email, or the mail app's own unsubscribe button. */
export async function unsubscribeByToken(db: Db, input: UnsubscribeInput) {
  if (input.list === 'alerts') {
    await db.update(profiles).set({ alertsAt: null }).where(eq(profiles.alertsToken, input.token))
    return { ok: true }
  }
  const [row] = await db
    .update(newsletterSubscribers)
    .set({ unsubscribedAt: new Date() })
    .where(eq(newsletterSubscribers.token, input.token))
    .returning({ email: newsletterSubscribers.email })
  if (row) await removeFromReaders(row.email)
  return { ok: true }
}

/** Brevo's own unsubscribe link, a spam complaint or a dead address: ours follows. */
export async function unsubscribeEmail(db: Db, email: string) {
  await db.update(newsletterSubscribers).set({ unsubscribedAt: new Date() }).where(and(byEmail(email), sql`${newsletterSubscribers.unsubscribedAt} is null`))
}

export async function emailPrefs(db: Db, user: SessionUser) {
  const [[profile], [news]] = await Promise.all([
    db.select({ alertsAt: profiles.alertsAt }).from(profiles).where(eq(profiles.id, user.id)).limit(1),
    db.select({ confirmedAt: newsletterSubscribers.confirmedAt, unsubscribedAt: newsletterSubscribers.unsubscribedAt }).from(newsletterSubscribers).where(byEmail(user.email)).limit(1),
  ])
  return { alerts: !!profile?.alertsAt, news: !!news?.confirmedAt && !news.unsubscribedAt }
}

/** The Settings switches. A member's address is already confirmed, so news starts straight away. */
export async function setEmailPref(db: Db, user: SessionUser, input: EmailPrefInput) {
  if (input.list === 'alerts') {
    await db
      .update(profiles)
      .set(input.on ? { alertsAt: new Date(), alertsToken: sql`coalesce(${profiles.alertsToken}, ${newToken()})` } : { alertsAt: null })
      .where(eq(profiles.id, user.id))
    return { on: input.on }
  }
  const [profile] = await db.select({ name: profiles.displayName }).from(profiles).where(eq(profiles.id, user.id)).limit(1)
  const firstName = profile?.name.split(' ')[0] ?? null
  if (input.on) {
    const now = new Date()
    const values = { profileId: user.id, firstName, source: 'settings', consentedAt: now, confirmedAt: now, unsubscribedAt: null }
    const [existing] = await db.select({ id: newsletterSubscribers.id }).from(newsletterSubscribers).where(byEmail(user.email)).limit(1)
    if (existing) await db.update(newsletterSubscribers).set(values).where(eq(newsletterSubscribers.id, existing.id))
    else await db.insert(newsletterSubscribers).values({ email: user.email, token: newToken(), ...values })
    await addToReaders(user.email, firstName)
  } else {
    await unsubscribeEmail(db, user.email)
    await removeFromReaders(user.email)
  }
  return { on: input.on }
}

/** On account deletion: off the list here and in Brevo. */
export async function forgetSubscriber(db: Db, email: string) {
  await db.delete(newsletterSubscribers).where(byEmail(email))
  await removeFromReaders(email)
}

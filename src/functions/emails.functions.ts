import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { getDb } from '#/db/client.server'
import { requireUserMiddleware } from '#/server/auth'
import { AppError } from '#/server/errors.server'
import { confirmSubscription, emailPrefs, setEmailPref, subscribe, unsubscribeByToken } from '#/server/newsletter.server'
import { emailPrefSchema, emailTokenSchema, subscribeSchema, unsubscribeSchema } from '#/schemas/emails'

export const subscribeToNews = createServerFn({ method: 'POST' })
  .validator(subscribeSchema)
  .handler(async ({ data }) => {
    const ip = getRequest().headers.get('cf-connecting-ip') ?? 'local'
    const limit = await env.SIGNUP_LIMITER?.limit({ key: ip })
    if (limit && !limit.success) throw new AppError('Too many tries. Wait a minute and try again.')
    return subscribe(getDb(), data)
  })

export const confirmNews = createServerFn({ method: 'POST' })
  .validator(emailTokenSchema)
  .handler(({ data }) => confirmSubscription(getDb(), data.token))

export const unsubscribe = createServerFn({ method: 'POST' })
  .validator(unsubscribeSchema)
  .handler(({ data }) => unsubscribeByToken(getDb(), data))

export const getEmailPrefs = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(({ context }) => emailPrefs(getDb(), context.user))

export const saveEmailPref = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(emailPrefSchema)
  .handler(({ data, context }) => setEmailPref(getDb(), context.user, data))

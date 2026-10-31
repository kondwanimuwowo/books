import { createServerFn } from '@tanstack/react-start'
import { getDb } from '#/db/client.server'
import { requireUserMiddleware } from '#/server/auth'
import { savedKeys, savedPage, setSaved } from '#/server/favourites.server'
import { setSavedSchema } from '#/schemas/favourites'

export const getSavedKeys = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(({ context }) => savedKeys(getDb(), context.user.id))

export const saveOrFollow = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(setSavedSchema)
  .handler(({ data, context }) => setSaved(getDb(), context.user.id, data))

export const getSaved = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(({ context }) => savedPage(getDb(), context.user.id))

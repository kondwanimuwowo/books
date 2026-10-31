import { createServerFn } from '@tanstack/react-start'
import { getDb } from '#/db/client.server'
import { requireUserMiddleware } from '#/server/auth'
import { savedBooks, savedSlugs, setFavourite } from '#/server/favourites.server'
import { setFavouriteSchema } from '#/schemas/favourites'

export const getSavedSlugs = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(({ context }) => savedSlugs(getDb(), context.user.id))

export const saveBook = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(setFavouriteSchema)
  .handler(({ data, context }) => setFavourite(getDb(), context.user.id, data))

export const getSavedBooks = createServerFn({ method: 'GET' })
  .middleware([requireUserMiddleware])
  .handler(({ context }) => savedBooks(getDb(), context.user.id))

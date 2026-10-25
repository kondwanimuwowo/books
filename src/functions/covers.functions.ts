import { createServerFn } from '@tanstack/react-start'
import { requireUserMiddleware } from '#/server/auth'
import { storeCover } from '#/server/covers.server'
import { storePrivate } from '#/server/private-files.server'

function photoFrom(data: unknown) {
  if (!(data instanceof FormData)) throw new Error('Expected a photo')
  const file = data.get('cover')
  if (!(file instanceof File)) throw new Error('Expected a photo')
  return file
}

// Open to anyone signed in: shop photos are uploaded while the shop is being set up.
export const uploadCover = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(photoFrom)
  .handler(async ({ data, context }) => {
    const key = await storeCover(new Uint8Array(await data.arrayBuffer()), context.user.id)
    return { key, url: `/covers/${key}` }
  })

/** ID documents for verification: private, so only the key comes back. */
export const uploadDocument = createServerFn({ method: 'POST' })
  .middleware([requireUserMiddleware])
  .validator(photoFrom)
  .handler(async ({ data, context }) => {
    const key = await storePrivate(new Uint8Array(await data.arrayBuffer()), context.user.id)
    return { key }
  })

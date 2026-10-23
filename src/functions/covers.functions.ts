import { createServerFn } from '@tanstack/react-start'
import { requireSellerMiddleware } from '#/server/auth'
import { storeCover } from '#/server/covers.server'

export const uploadCover = createServerFn({ method: 'POST' })
  .middleware([requireSellerMiddleware])
  .validator((data: unknown) => {
    if (!(data instanceof FormData)) throw new Error('Expected a photo')
    const file = data.get('cover')
    if (!(file instanceof File)) throw new Error('Expected a photo')
    return file
  })
  .handler(async ({ data, context }) => {
    const key = await storeCover(new Uint8Array(await data.arrayBuffer()), context.user.id)
    return { key, url: `/covers/${key}` }
  })

import { createFileRoute } from '@tanstack/react-router'
import { env } from 'cloudflare:workers'
import { COVER_KEY } from '#/server/covers.server'

// Keys are random and never reused, so a cover can be cached forever.
export const Route = createFileRoute('/covers/$key')({
  server: {
    handlers: {
      GET: async ({ params, request }) => {
        if (!COVER_KEY.test(params.key)) return new Response('Not found', { status: 404 })
        const object = await env.COVERS.get(params.key, { onlyIf: request.headers })
        if (!object) return new Response('Not found', { status: 404 })
        const headers = new Headers()
        object.writeHttpMetadata(headers)
        headers.set('etag', object.httpEtag)
        headers.set('cache-control', 'public, max-age=31536000, immutable')
        // A conditional request that matched returns metadata without a body.
        if (!('body' in object)) return new Response(null, { status: 304, headers })
        return new Response(object.body, { headers })
      },
    },
  },
})

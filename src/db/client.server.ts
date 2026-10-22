import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Workers can't share sockets across requests, so each request gets its own client.
// DATABASE_URL should be Supabase's transaction pooler (port 6543); prepare must be off for it.
function createDb() {
  const client = postgres(env.DATABASE_URL, { prepare: false, max: 1 })
  return drizzle(client, { schema, casing: 'snake_case' })
}

export type Db = ReturnType<typeof createDb>

// During SSR the root and page loaders run in one request; reuse its connection
// instead of paying a new TCP + TLS + auth handshake per getDb() call.
const perRequest = new WeakMap<Request, Db>()

export function getDb(): Db {
  const request = getRequest()
  let db = perRequest.get(request)
  if (!db) {
    db = createDb()
    perRequest.set(request, db)
  }
  return db
}

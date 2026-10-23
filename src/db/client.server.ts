import { getRequest } from '@tanstack/react-start/server'
import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Workers can't share sockets across requests, so each request gets its own client.
// In production HYPERDRIVE (bound in wrangler.jsonc) keeps warm connections to Supabase near the database.
// Without it, DATABASE_URL should be Supabase's transaction pooler (port 6543); prepare must be off for it.
// Dev skips the local Hyperdrive emulation: it decodes the percent-encoded password into an invalid URL.
export function createDb() {
  const url = import.meta.env.DEV ? env.DATABASE_URL : (env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL)
  const client = postgres(url, { prepare: false, max: 1, connect_timeout: 10 })
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

// After a query stalls (lossy network), later queries on the same connection would queue behind it.
// Drop the request's client so the next getDb() opens a fresh one.
export function discardRequestDb() {
  const request = getRequest()
  const db = perRequest.get(request)
  if (!db) return
  perRequest.delete(request)
  void db.$client.end({ timeout: 0 })
}

import { env } from 'cloudflare:workers'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

// Workers can't share sockets across requests, so each request gets its own client.
// DATABASE_URL should be Supabase's transaction pooler (port 6543); prepare must be off for it.
export function getDb() {
  const client = postgres(env.DATABASE_URL, { prepare: false, max: 1 })
  return drizzle(client, { schema, casing: 'snake_case' })
}

export type Db = ReturnType<typeof getDb>

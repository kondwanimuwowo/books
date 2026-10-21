import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { CATEGORIES } from '../src/data/categories'
import { categories } from '../src/db/schema'

// Upserts reference data from src/data. Safe to run repeatedly: `npm run db:seed`.
async function main() {
  const url = process.env.DIRECT_DATABASE_URL
  if (!url) throw new Error('DIRECT_DATABASE_URL is not set (see .env.example)')
  const client = postgres(url, { max: 1 })
  const db = drizzle(client)

  await db
    .insert(categories)
    .values(CATEGORIES.map((c, i) => ({ slug: c.slug, name: c.name, sortOrder: i })))
    .onConflictDoUpdate({ target: categories.slug, set: { name: sql`excluded.name`, sortOrder: sql`excluded.sort_order` } })

  console.log(`Seeded ${CATEGORIES.length} categories`)
  await client.end()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})

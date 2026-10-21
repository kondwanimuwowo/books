import 'dotenv/config'
import { defineConfig } from 'drizzle-kit'

// Migrations run against the direct (session) connection, not the transaction pooler.
export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url: process.env.DIRECT_DATABASE_URL ?? '' },
  schemaFilter: ['public'],
  strict: true,
})

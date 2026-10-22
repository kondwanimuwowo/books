import { createServerEntry, createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'

// Same as TanStack Start's default entry, plus the cron handler (triggers in wrangler.jsonc).
// App modules load lazily: importing them here at the top level recreates the cold-start
// SSR cycle that src/start.ts avoids.
const start = createServerEntry({ fetch: createStartHandler(defaultStreamHandler) })

async function runCron() {
  const [{ createDb }, { runScheduledJobs }] = await Promise.all([import('#/db/client.server'), import('#/server/jobs.server')])
  const db = createDb()
  try {
    await runScheduledJobs(db)
  } finally {
    await db.$client.end()
  }
}

export default {
  fetch: start.fetch,
  scheduled(_controller, _env, ctx) {
    ctx.waitUntil(runCron())
  },
} satisfies ExportedHandler<Env>

import { desc } from 'drizzle-orm'
import { discardRequestDb } from '#/db/client.server'
import type { Db } from '#/db/client.server'
import { fxRates } from '#/db/schema'

// USD is display-only; every charge is in ZMW. A failure here hides the USD switch
// rather than taking down every page (this runs in the root loader).
export async function getZmwPerUsd(db: Db): Promise<{ rate: number; day: string } | null> {
  try {
    return await withTimeout(loadRate(db), FX_TIMEOUT_MS)
  } catch (error) {
    if (error instanceof FxTimeout) discardRequestDb()
    console.error('fx rate unavailable', error instanceof Error ? (error.cause ?? error) : error)
    return null
  }
}

// On a lossy link a query can stall mid-send; the page shouldn't wait on a display-only rate.
const FX_TIMEOUT_MS = 4000

class FxTimeout extends Error {}

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return Promise.race([promise, new Promise<never>((_, reject) => setTimeout(() => reject(new FxTimeout(`timed out after ${ms}ms`)), ms))])
}

// One rate per day, fetched lazily.
async function loadRate(db: Db): Promise<{ rate: number; day: string } | null> {
  const today = new Date().toISOString().slice(0, 10)
  const [latest] = await db.select().from(fxRates).orderBy(desc(fxRates.day)).limit(1)
  if (latest?.day === today) return { rate: Number(latest.zmwPerUsd), day: latest.day }

  try {
    const response = await fetch('https://open.er-api.com/v6/latest/USD')
    const json = (await response.json()) as { result?: string; rates?: Record<string, number> }
    const rate = json.rates?.ZMW
    if (json.result === 'success' && rate) {
      await db.insert(fxRates).values({ day: today, zmwPerUsd: rate.toFixed(4), source: 'open.er-api.com' }).onConflictDoNothing()
      return { rate, day: today }
    }
  } catch {
    // Fall through to the last stored rate.
  }
  return latest ? { rate: Number(latest.zmwPerUsd), day: latest.day } : null
}

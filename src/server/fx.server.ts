import { desc } from 'drizzle-orm'
import type { Db } from '#/db/client.server'
import { fxRates } from '#/db/schema'

// USD is display-only; every charge is in ZMW. One rate per day, fetched lazily.
export async function getZmwPerUsd(db: Db): Promise<{ rate: number; day: string } | null> {
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

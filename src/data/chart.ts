// The Zambia Top 20: books by Zambian authors ranked by how many different readers bought them.
export const CHART_SIZE = 20
// A book needs this many different buyers in the window to be ranked at all.
export const CHART_MIN_BUYERS = 2
export const CHART_WINDOW_DAYS = 30
// A sale counts fully on the day before the snapshot and fades to this weight at the start of the window.
export const CHART_OLDEST_WEIGHT = 0.5
// Zambia is UTC+2 all year; weeks start on Monday at midnight there.
export const CHART_UTC_OFFSET_HOURS = 2

/** Monday of the week containing `at`, in Zambian time, as YYYY-MM-DD. */
export function chartWeek(at: Date = new Date()) {
  const local = new Date(at.getTime() + CHART_UTC_OFFSET_HOURS * 3_600_000)
  const daysSinceMonday = (local.getUTCDay() + 6) % 7
  local.setUTCDate(local.getUTCDate() - daysSinceMonday)
  return local.toISOString().slice(0, 10)
}

export function shiftWeek(week: string, weeks: number) {
  const d = new Date(`${week}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + weeks * 7)
  return d.toISOString().slice(0, 10)
}

/** The instant a chart week begins (Monday 00:00 in Zambia). */
export function weekStartsAt(week: string) {
  return new Date(new Date(`${week}T00:00:00Z`).getTime() - CHART_UTC_OFFSET_HOURS * 3_600_000)
}

// Shown under the chart, so readers and the press can see exactly how it's counted.
export const CHART_RULES = [
  `Books by Zambian authors, ranked by how many different readers bought them in the ${CHART_WINDOW_DAYS} days before Monday.`,
  'Each reader counts once per book, however many copies they buy. Recent buys count a little more.',
  'Only paid orders count. Cancelled, refunded and disputed orders don’t, and neither do sellers or authors buying their own books.',
  `A book needs at least ${CHART_MIN_BUYERS} different buyers to be ranked. The chart is only published once ${CHART_SIZE} books qualify.`,
  'Updated every Monday.',
]

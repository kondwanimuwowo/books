export type Tier = 'copper' | 'emerald' | 'gold'

export interface TierInfo {
  tier: Tier
  label: string
  /** Distinct readers with a delivered copy of the author's books. */
  readers: number
  /** Books under the author's name in the catalogue. */
  books: number
  line: string
}

// Milestones for Zambian verified authors, named for what Zambia is known for. Rare on purpose: in Zambia
// 1,000 copies is a bestseller, so Gold sits beyond it.
const tier = (key: Tier, label: string, readers: number, books: number): TierInfo => ({
  tier: key,
  label,
  readers,
  books,
  line: `Read by ${readers.toLocaleString('en')} people on Kuwala`,
})
export const TIERS: TierInfo[] = [tier('copper', 'Copper', 100, 1), tier('emerald', 'Emerald', 500, 1), tier('gold', 'Gold', 1500, 2)]

/** Only copies a reader paid at least this much for count towards plaques, so cheap listings can't farm readers. */
export const PLAQUE_MIN_PRICE_NGWEE = 10_000

/** Once an author has this many reviews, their average must reach MIN_AVERAGE for the next milestone. */
export const REVIEW_GATE = { reviews: 10, average: 4 } as const

export const tierInfo = (tier: Tier) => TIERS.find((t) => t.tier === tier) as TierInfo

/** The highest of the tiers earned, which is the one shown. */
export function topTier(earned: Tier[]) {
  return [...TIERS].reverse().find((t) => earned.includes(t.tier)) ?? null
}

export const AUTHOR_LINKS = [
  { key: 'website', label: 'Website', placeholder: 'https://mwilabanda.com' },
  { key: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/…' },
  { key: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/…' },
  { key: 'x', label: 'X', placeholder: 'https://x.com/…' },
  { key: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@…' },
] as const

export const PLAQUE_COPY = {
  heading: 'Milestones',
  reached: (label: string) => `You’ve reached ${label}`,
  email: (name: string, label: string, readers: number) =>
    `Congratulations ${name}. ${readers.toLocaleString('en')} readers on Kuwala now have one of your books, which makes you a ${label} author. It shows on your author page from today.`,
  claim: (name: string) => `Are you ${name}?`,
  claimLine: 'Claim this page to add your photo and story, and get verified.',
} as const

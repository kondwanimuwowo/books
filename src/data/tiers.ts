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

// Named for what Zambia is known for. Thresholds suit the local market, where 1,000 copies is a bestseller.
export const TIERS: TierInfo[] = [
  { tier: 'copper', label: 'Copper', readers: 25, books: 1, line: 'Read by 25 people on Kuwala' },
  { tier: 'emerald', label: 'Emerald', readers: 250, books: 1, line: 'Read by 250 people on Kuwala' },
  { tier: 'gold', label: 'Gold', readers: 1000, books: 2, line: 'Read by 1,000 people on Kuwala' },
]

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
  reached: (label: string) => `You’ve reached ${label}`,
  email: (name: string, label: string, readers: number) =>
    `Congratulations ${name}. ${readers.toLocaleString('en')} readers on Kuwala now have one of your books, which earns you the ${label} plaque. It shows on your author page from today.`,
  claim: (name: string) => `Are you ${name}?`,
  claimLine: 'Claim this page to add your photo and story, and get verified.',
} as const

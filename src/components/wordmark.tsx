import { BRAND } from '#/data/brand'
import { cn } from '#/lib/utils'

/**
 * The official wordmark. `inverse` is for the burgundy header; otherwise the crimson and navy version shows
 * on light pages and the light version takes over in dark mode. Height comes from className.
 */
export function Wordmark({ tone = 'default', className }: { tone?: 'default' | 'inverse'; className?: string }) {
  const size = cn('block h-6 w-auto', className)
  if (tone === 'inverse') return <img src={BRAND.wordmarkLight} alt="Kuwala Books" width={600} height={74} className={size} />
  return (
    <>
      <img src={BRAND.wordmark} alt="Kuwala Books" width={600} height={74} className={cn(size, 'dark:hidden')} />
      <img src={BRAND.wordmarkLight} alt="" aria-hidden width={600} height={74} className={cn(size, 'hidden dark:block')} />
    </>
  )
}

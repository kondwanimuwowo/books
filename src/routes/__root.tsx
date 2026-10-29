import { HeadContent, Link, Outlet, Scripts, createRootRoute, useMatches } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getSiteContext } from '#/functions/catalog.functions'
import { errorMessage } from '#/components/form'
import { BagProvider, CurrencyProvider } from '#/components/providers'
import { SiteFooter, SiteHeader } from '#/components/site-header'
import { TabBar } from '#/components/tab-bar'
import { TermsGate } from '#/components/terms-consent'
import { CookieNotice } from '#/components/cookie-notice'
import { BARE_ROUTES } from '#/data/brand'
import { NO_FOOTER_ROUTES, NO_TAB_ROUTES } from '#/data/navigation'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  loader: () => getSiteContext(),
  // Header data rarely changes; sign-in/out calls router.invalidate() to refresh it.
  staleTime: 5 * 60_000,
  shouldReload: false,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      // The header is deep burgundy in both themes, so the phone's browser bar matches it.
      { name: 'theme-color', content: '#431b20', media: '(prefers-color-scheme: light)' },
      { name: 'theme-color', content: '#2c1518', media: '(prefers-color-scheme: dark)' },
      { title: 'Kuwala Books: buy and sell books in Zambia' },
      { name: 'description', content: 'New and used books from Zambian authors, readers and bookshops. Pay with mobile money, delivered across Zambia.' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@500..800&family=Poppins:wght@400;500;700&display=swap' },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/brand/mark-48.png', sizes: '48x48', type: 'image/png' },
      { rel: 'icon', href: '/brand/mark-32.png', sizes: '32x32', type: 'image/png' },
      { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
    ],
  }),
  shellComponent: RootDocument,
  component: RootLayout,
  notFoundComponent: NotFound,
  errorComponent: RootError,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function RootLayout() {
  const { user, fx, currency } = Route.useLoaderData()
  // Admin brings its own shell (src/components/admin-shell.tsx) and always shows kwacha.
  const isAdmin = useMatches({ select: (matches) => matches.some((m) => m.routeId === '/admin') })
  const bare = useMatches({ select: (matches) => matches.some((m) => BARE_ROUTES.includes(m.routeId)) })
  const tabs = useMatches({ select: (matches) => !matches.some((m) => NO_TAB_ROUTES.includes(m.routeId)) })
  const footer = useMatches({ select: (matches) => !matches.some((m) => NO_FOOTER_ROUTES.includes(m.routeId)) })
  if (isAdmin) {
    return (
      <CurrencyProvider initial="ZMW" rate={null}>
        <Outlet />
      </CurrencyProvider>
    )
  }

  return (
    <CurrencyProvider initial={currency} rate={fx?.rate ?? null} rateDay={fx?.day ?? null}>
      <ServiceWorker />
      <BagProvider>
        {bare ? (
          <main>
            <Outlet />
          </main>
        ) : (
          <div className="flex min-h-dvh flex-col" data-tabbar={tabs}>
            <SiteHeader user={user} tabs={tabs} />
            <main className="flex-1">
              <Outlet />
            </main>
            {footer && <SiteFooter />}
            {tabs && <TabBar signedIn={!!user} seller={!!user?.sellerSlug} />}
            <TermsGate />
            <CookieNotice />
          </div>
        )}
      </BagProvider>
    </CurrencyProvider>
  )
}

// Store only: the admin host never registers it.
function ServiceWorker() {
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
    // A tab opened before a deploy asks for code files the deploy replaced; load the new version instead of failing.
    const onStale = (event: Event) => {
      if (reloadForNewVersion()) event.preventDefault()
    }
    window.addEventListener('vite:preloadError', onStale)
    return () => window.removeEventListener('vite:preloadError', onStale)
  }, [])
  return null
}

const STALE_MESSAGES = ['Failed to fetch dynamically imported module', 'error loading dynamically imported module', 'Importing a module script failed', 'Unable to preload']
const RELOADED_AT = 'kb_reloaded_for_version'
let reloadStarted = false

function isStaleCode(error: unknown) {
  return error instanceof Error && STALE_MESSAGES.some((m) => error.message.startsWith(m))
}

/** Reloads the page the reader was heading to. Returns false if it just did, so a real fault can't loop. */
function reloadForNewVersion() {
  if (reloadStarted) return true
  try {
    const last = Number(sessionStorage.getItem(RELOADED_AT) ?? 0)
    if (Date.now() - last < 15_000) return false
    sessionStorage.setItem(RELOADED_AT, String(Date.now()))
  } catch {
    // Storage blocked: reload anyway; the browser cache can't be stale twice in a row.
  }
  reloadStarted = true
  window.location.reload()
  return true
}

function Reloading() {
  return (
    <div className="flex justify-center py-32" role="status" aria-label="Loading">
      <span aria-hidden className="block size-7 animate-spin rounded-full border-[3px] border-line border-t-accent-ink motion-reduce:animate-none" />
    </div>
  )
}

export function NotFound() {
  return (
    <div className="page rise py-20 text-center sm:py-28">
      {/* A page number, because this is a missing page. */}
      <p aria-hidden className="text-[clamp(5rem,22vw,9rem)] leading-none font-normal tracking-[-0.06em] text-line-strong tabular-nums">
        404
      </p>
      <h1 className="mt-4 text-2xl sm:text-3xl">This page has been torn out</h1>
      <Link to="/" className="btn btn-primary mt-8">
        Back to the shelves
      </Link>
    </div>
  )
}

function RootError({ error, reset }: ErrorComponentProps) {
  const stale = isStaleCode(error)
  const [reloading, setReloading] = useState(stale)
  useEffect(() => {
    if (stale) setReloading(reloadForNewVersion())
  }, [stale])
  if (reloading) return <Reloading />

  // Only blame the connection when the browser says it's actually offline.
  const offline = typeof navigator !== 'undefined' && !navigator.onLine
  return (
    <div className="page rise py-24 text-center">
      <h1 className="text-2xl sm:text-3xl">{offline ? 'You’re offline' : 'This page didn’t load'}</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">{offline ? 'Connect and try again.' : 'It’s on our side, not your connection. Try again in a moment.'}</p>
      {/* Raw errors can contain SQL; only developers see them. */}
      {import.meta.env.DEV && <p className="mx-auto mt-4 max-w-lg text-left font-mono text-xs break-words text-subtle">{errorMessage(error)}</p>}
      <button type="button" onClick={reset} className="btn btn-primary mt-8">
        Load it again
      </button>
    </div>
  )
}

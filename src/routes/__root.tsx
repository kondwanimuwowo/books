import { HeadContent, Link, Outlet, Scripts, createRootRoute, useMatches } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
import { useEffect } from 'react'
import { getSiteContext } from '#/functions/catalog.functions'
import { errorMessage } from '#/components/form'
import { BagProvider, CurrencyProvider } from '#/components/providers'
import { SiteFooter, SiteHeader } from '#/components/site-header'
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
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700&display=swap' },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
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
        <div className="flex min-h-dvh flex-col">
          <SiteHeader user={user} />
          <main className="flex-1">
            <Outlet />
          </main>
          <SiteFooter />
        </div>
      </BagProvider>
    </CurrencyProvider>
  )
}

// Store only: the admin host never registers it.
function ServiceWorker() {
  useEffect(() => {
    if (import.meta.env.PROD && 'serviceWorker' in navigator) void navigator.serviceWorker.register('/sw.js').catch(() => undefined)
  }, [])
  return null
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
  return (
    <div className="page rise py-24 text-center">
      <h1 className="text-2xl sm:text-3xl">This page didn&rsquo;t load</h1>
      <p className="mx-auto mt-2 max-w-md text-muted">Check your connection and try again.</p>
      {/* Raw errors can contain SQL; only developers see them. */}
      {import.meta.env.DEV && <p className="mx-auto mt-4 max-w-lg text-left font-mono text-xs break-words text-subtle">{errorMessage(error)}</p>}
      <button type="button" onClick={reset} className="btn btn-primary mt-8">
        Load it again
      </button>
    </div>
  )
}

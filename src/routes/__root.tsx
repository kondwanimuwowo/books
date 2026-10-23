import { HeadContent, Link, Outlet, Scripts, createRootRoute, useMatches } from '@tanstack/react-router'
import type { ErrorComponentProps } from '@tanstack/react-router'
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
      { name: 'theme-color', content: '#ffffff' },
      { title: 'Kuwala Books: buy and sell books in Zambia' },
      { name: 'description', content: 'New and used books from Zambian authors, readers and bookshops. Pay with mobile money, delivered across Zambia.' },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300..800&display=swap' },
      { rel: 'stylesheet', href: appCss },
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
    <CurrencyProvider initial={currency} rate={fx?.rate ?? null}>
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

export function NotFound() {
  return (
    <div className="page py-24 text-center">
      <h1 className="text-3xl">We couldn&rsquo;t find that page</h1>
      <p className="mt-2 text-neutral-700">It may have been sold, removed or never existed.</p>
      <Link to="/" className="btn btn-primary mt-6">
        Back to the shop
      </Link>
    </div>
  )
}

function RootError({ error, reset }: ErrorComponentProps) {
  return (
    <div className="page py-24 text-center">
      <h1 className="text-3xl">Something went wrong</h1>
      <p className="mt-2 text-neutral-700">{errorMessage(error)}</p>
      <button type="button" onClick={reset} className="btn btn-secondary mt-6">
        Try again
      </button>
    </div>
  )
}

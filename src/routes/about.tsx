import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRightIcon, EnvelopeIcon } from '@heroicons/react/16/solid'
import { getCoverWall } from '#/functions/catalog.functions'
import { ClosingBand, Feature, MarketingHero, ON_BAND_BUTTON, Points } from '#/components/marketing'
import { ABOUT_PAGE as PAGE, ILLUSTRATIONS } from '#/data/marketing'
import { ogMeta } from '#/lib/og'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/about')({
  loader: () => getCoverWall(),
  head: () => ({
    meta: [{ title: `${PAGE.metaTitle} | Kuwala Books` }, { name: 'description', content: PAGE.metaDescription }, ...ogMeta({ title: PAGE.metaTitle, description: PAGE.metaDescription, path: PAGE.path })],
  }),
  component: About,
})

function Browse({ className }: { className?: string }) {
  return (
    <Link to="/search" className={cn(ON_BAND_BUTTON, className)}>
      {PAGE.hero.cta}
    </Link>
  )
}

function About() {
  const wall = Route.useLoaderData()
  return (
    <>
      <MarketingHero wall={wall} title={PAGE.hero.title} titleBold={PAGE.hero.titleBold} line={PAGE.hero.line} action={<Browse />} more={PAGE.hero.secondary} />

      <div className="page-marketing">
        <Feature id="how" image={ILLUSTRATIONS.grandmotherStory}>
          <div>
            <h2 className="text-2xl sm:text-3xl">{PAGE.storyHeading}</h2>
            <div className="mt-6 max-w-prose space-y-4 text-lg leading-relaxed text-muted">
              {PAGE.story.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </div>
        </Feature>

        <Feature image={ILLUSTRATIONS.jacarandaDelivery} flip>
          <Points heading={PAGE.whatHeading} points={PAGE.what} />
        </Feature>

        <section className="grid gap-4 border-t border-line py-16 sm:py-20 md:grid-cols-3" aria-label="Buy, sell or write">
          {PAGE.doors.map((d) => (
            <Link key={d.title} to={d.to} className="card lift group block p-6 no-underline sm:p-8">
              <h2 className="text-xl text-ink">{d.title}</h2>
              <p className="mt-2 text-muted">{d.body}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent-ink">
                {d.link}
                <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </section>

        <section className="border-t border-line py-16 text-center sm:py-20" aria-labelledby="contact-heading">
          <h2 id="contact-heading" className="text-2xl sm:text-3xl">
            {PAGE.contactHeading}
          </h2>
          <p className="mx-auto mt-3 max-w-md text-muted">{PAGE.contactLine}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <a href={PAGE.contact.email.href} className="btn btn-secondary gap-1.5 no-underline">
              <EnvelopeIcon className="size-4" aria-hidden />
              {PAGE.contact.email.label}
            </a>
            <a href={PAGE.contact.whatsapp.href} target="_blank" rel="noopener noreferrer" className="btn gap-1.5 bg-green text-white no-underline hover:bg-green/90 hover:text-white">
              {PAGE.contact.whatsapp.label}
            </a>
          </div>
        </section>
      </div>

      <ClosingBand title={PAGE.closing} action={<Browse className="shrink-0" />} />
    </>
  )
}

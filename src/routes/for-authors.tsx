import { createFileRoute } from '@tanstack/react-router'
import { getCoverWall } from '#/functions/catalog.functions'
import { ClosingBand, Faq, Feature, MarketingHero, Points, StartSellingButton, Steps } from '#/components/marketing'
import { AUTHOR_PAGE as PAGE, ILLUSTRATIONS } from '#/data/marketing'
import { ogMeta } from '#/lib/og'

export const Route = createFileRoute('/for-authors')({
  loader: () => getCoverWall(),
  head: () => ({
    meta: [{ title: `${PAGE.metaTitle} | Kuwala Books` }, { name: 'description', content: PAGE.metaDescription }, ...ogMeta({ title: PAGE.metaTitle, description: PAGE.metaDescription, path: PAGE.path })],
  }),
  component: ForAuthors,
})

function ForAuthors() {
  const wall = Route.useLoaderData()
  return (
    <>
      <MarketingHero
        wall={wall}
        title={PAGE.hero.title}
        titleBold={PAGE.hero.titleBold}
        line={PAGE.hero.line}
        action={<StartSellingButton label={PAGE.hero.cta} />}
        more={PAGE.hero.secondary}
      />

      <div className="page-marketing">
        <Steps heading={PAGE.stepsHeading} steps={PAGE.steps} />

        <Feature image={ILLUSTRATIONS.bookSigning}>
          <Points heading={PAGE.getHeading} points={PAGE.get} />
        </Feature>

        <section className="border-t border-line py-16 sm:py-20" aria-labelledby="launch-heading">
          <div className="rounded-xl bg-sunken p-6 sm:p-10">
            <h2 id="launch-heading" className="text-2xl sm:text-3xl">
              {PAGE.launch.heading}
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-muted">{PAGE.launch.line}</p>
            <ul className="mt-8 grid gap-6 sm:grid-cols-3">
              {PAGE.launch.points.map((p) => (
                <li key={p.title}>
                  <p className="font-bold">{p.title}</p>
                  <p className="mt-1 leading-relaxed text-muted">{p.body}</p>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href={PAGE.launch.email.href} className="btn btn-primary">
                {PAGE.launch.email.label}
              </a>
              <a href={PAGE.launch.whatsapp.href} target="_blank" rel="noreferrer" className="btn btn-secondary">
                {PAGE.launch.whatsapp.label}
              </a>
            </div>
          </div>
        </section>

        <section className="border-t border-line py-16 sm:py-20" aria-labelledby="plaques-heading">
          <h2 id="plaques-heading" className="text-2xl sm:text-3xl">
            {PAGE.plaquesHeading}
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-muted">{PAGE.plaquesLine}</p>
          <ul className="mt-8 grid gap-4 sm:grid-cols-3">
            {PAGE.plaques.map((p) => (
              <li key={p.title} className="card p-6">
                <p className="text-xl font-bold">{p.title}</p>
                <p className="mt-1 text-muted">{p.body}</p>
              </li>
            ))}
          </ul>
        </section>

        <Faq heading={PAGE.faqHeading} items={PAGE.faq} />
      </div>

      <ClosingBand title={PAGE.closing} action={<StartSellingButton label={PAGE.hero.cta} className="shrink-0" />} />
    </>
  )
}

import { Link, createFileRoute } from '@tanstack/react-router'
import { getCoverWall } from '#/functions/catalog.functions'
import { ClosingBand, Faq, Feature, MarketingHero, ON_BAND_BUTTON, Points, Steps } from '#/components/marketing'
import { BUY_PAGE as PAGE, ILLUSTRATIONS } from '#/data/marketing'
import { ogMeta } from '#/lib/og'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/how-it-works')({
  loader: () => getCoverWall(),
  head: () => ({
    meta: [{ title: `${PAGE.metaTitle} | Kuwala Books` }, { name: 'description', content: PAGE.metaDescription }, ...ogMeta({ title: PAGE.metaTitle, description: PAGE.metaDescription, path: PAGE.path })],
  }),
  component: HowItWorks,
})

function Browse({ className }: { className?: string }) {
  return (
    <Link to="/search" className={cn(ON_BAND_BUTTON, className)}>
      {PAGE.hero.cta}
    </Link>
  )
}

function HowItWorks() {
  const wall = Route.useLoaderData()
  return (
    <>
      <MarketingHero wall={wall} title={PAGE.hero.title} titleBold={PAGE.hero.titleBold} line={PAGE.hero.line} action={<Browse />} more={PAGE.hero.secondary} />

      <div className="page-marketing">
        <Steps heading={PAGE.stepsHeading} steps={PAGE.steps} />

        <Feature image={ILLUSTRATIONS.moneyHeld}>
          <Points heading={PAGE.protectionHeading} points={PAGE.protection}>
            <Link to="/legal/$page" params={{ page: 'buyer-protection' }} className="mt-6 inline-block font-medium">
              {PAGE.protectionLink}
            </Link>
          </Points>
        </Feature>

        <Feature image={ILLUSTRATIONS.zambiaMap} flip>
          <div>
            <h2 className="text-2xl sm:text-3xl">{PAGE.deliveryHeading}</h2>
            <dl className="mt-8 divide-y divide-line">
              {PAGE.delivery.map((d) => (
                <div key={d.title} className="grid gap-1 py-4 sm:grid-cols-[10rem_1fr] sm:gap-6">
                  <dt className="font-medium">{d.title}</dt>
                  <dd className="text-muted">{d.body}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 rounded-xl bg-sunken px-5 py-4 font-medium">{PAGE.deliveryNote}</p>
          </div>
        </Feature>

        <Faq heading={PAGE.faqHeading} items={PAGE.faq} />
      </div>

      <ClosingBand title={PAGE.closing} action={<Browse className="shrink-0" />} />
    </>
  )
}

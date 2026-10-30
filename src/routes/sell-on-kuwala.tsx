import { Link, createFileRoute } from '@tanstack/react-router'
import { ChevronRightIcon } from '@heroicons/react/16/solid'
import { getCoverWall } from '#/functions/catalog.functions'
import { ClosingBand, Faq, Feature, MarketingHero, Points, StartSellingButton, Steps } from '#/components/marketing'
import { ILLUSTRATIONS, SELL_PAGE as PAGE } from '#/data/marketing'
import { ogMeta } from '#/lib/og'

export const Route = createFileRoute('/sell-on-kuwala')({
  loader: () => getCoverWall(),
  head: () => ({
    meta: [{ title: `${PAGE.metaTitle} | Kuwala Books` }, { name: 'description', content: PAGE.metaDescription }, ...ogMeta({ title: PAGE.metaTitle, description: PAGE.metaDescription, path: PAGE.path })],
  }),
  component: SellOnKuwala,
})

const Cta = ({ className }: { className?: string }) => <StartSellingButton label={PAGE.hero.cta} className={className} />

function SellOnKuwala() {
  const wall = Route.useLoaderData()
  const faq = PAGE.faq.map((f, i) =>
    i === PAGE.faq.length - 1
      ? {
          q: f.q,
          a: (
            <>
              {f.a}{' '}
              <Link to="/legal/$page" params={{ page: 'seller-agreement' }}>
                Seller agreement
              </Link>
            </>
          ),
        }
      : f,
  )

  return (
    <>
      <MarketingHero wall={wall} title={PAGE.hero.title} titleBold={PAGE.hero.titleBold} line={PAGE.hero.line} action={<Cta />} more={PAGE.hero.secondary} />

      <div className="page-marketing">
        <Steps heading={PAGE.stepsHeading} steps={PAGE.steps} />

        <Feature image={ILLUSTRATIONS.packing}>
          <div>
            <h2 id="costs-heading" className="text-2xl sm:text-3xl">
              {PAGE.costsHeading}
            </h2>
            <dl className="mt-8 divide-y divide-line">
              {PAGE.costs.map((c) => (
                <div key={c.label} className="grid gap-1 py-4 sm:grid-cols-[8rem_1fr] sm:gap-6">
                  <dt className="font-medium">{c.label}</dt>
                  <dd className="text-muted">{c.value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-6 rounded-xl bg-sunken px-5 py-4 font-medium">{PAGE.example}</p>
          </div>
        </Feature>

        <Feature image={ILLUSTRATIONS.bookMarket} flip>
          <Points heading={PAGE.whyHeading} points={PAGE.why} />
        </Feature>

        <section className="grid gap-4 border-t border-line py-16 sm:grid-cols-2 sm:py-20" aria-label="Authors and bookshops">
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

        <Faq heading={PAGE.faqHeading} items={faq} />
      </div>

      <ClosingBand title={PAGE.closing} action={<Cta className="shrink-0" />} />
    </>
  )
}

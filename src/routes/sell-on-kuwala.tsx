import { Link, createFileRoute, useLoaderData } from '@tanstack/react-router'
import { ChevronDownIcon, ChevronRightIcon } from '@heroicons/react/16/solid'
import { getCoverWall } from '#/functions/catalog.functions'
import { CoverWallBackdrop, useCoverReveal } from '#/components/cover-wall'
import { SELL_PAGE as PAGE } from '#/data/marketing'
import { MY_SHOP } from '#/data/navigation'
import { ogMeta } from '#/lib/og'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/sell-on-kuwala')({
  loader: () => getCoverWall(),
  head: () => ({
    meta: [{ title: `${PAGE.metaTitle} | Kuwala Books` }, { name: 'description', content: PAGE.metaDescription }, ...ogMeta({ title: PAGE.metaTitle, description: PAGE.metaDescription, path: PAGE.path })],
  }),
  component: SellOnKuwala,
})

/** The one action on the page: sellers list a book, everyone else starts selling (sign-in comes first if needed). */
function Cta({ className, onBand = false }: { className?: string; onBand?: boolean }) {
  const { user } = useLoaderData({ from: '__root__' })
  const style = onBand ? 'btn bg-on-accent text-deep hover:bg-on-accent/90 hover:text-deep' : 'btn btn-primary'
  return user?.sellerSlug ? (
    <Link to="/sell" className={cn(style, className)}>
      {MY_SHOP.list}
    </Link>
  ) : (
    <Link to="/start-selling" className={cn(style, className)}>
      {PAGE.hero.cta}
    </Link>
  )
}

function SellOnKuwala() {
  const wall = Route.useLoaderData()
  const { reveal, onPointerMove, onPointerLeave } = useCoverReveal()

  return (
    <>
      <section className="band relative overflow-hidden" onPointerMove={wall.length ? onPointerMove : undefined} onPointerLeave={wall.length ? onPointerLeave : undefined}>
        {wall.length > 0 && <CoverWallBackdrop tiles={wall} reveal={reveal} />}
        <div className="page rise relative py-14 sm:py-20">
          <div className={cn(wall.length > 0 && 'frost w-fit max-w-2xl rounded-xl px-6 py-7 sm:px-9 sm:py-9')}>
            <h1 className="max-w-2xl text-[2.25rem] leading-[1.06] font-normal sm:text-6xl">
              {PAGE.hero.title} <span className="block font-bold">{PAGE.hero.titleBold}</span>
            </h1>
            <p className="mt-4 max-w-lg text-lg text-on-deep-muted">{PAGE.hero.line}</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Cta onBand />
              <a href="#how" className="btn frost-pill text-on-accent no-underline hover:text-on-accent">
                {PAGE.hero.secondary}
                <ChevronDownIcon className="size-4" aria-hidden />
              </a>
            </div>
          </div>
        </div>
      </section>

      <div className="page">
        <section id="how" className="scroll-mt-24 py-16 sm:py-20" aria-labelledby="how-heading">
          <h2 id="how-heading" className="text-2xl sm:text-3xl">
            {PAGE.stepsHeading}
          </h2>
          <ol className="mt-10 grid gap-10 md:grid-cols-3 md:gap-8">
            {PAGE.steps.map((step, i) => (
              <li key={step.title}>
                <span className="grid size-10 place-items-center rounded-full bg-accent-soft text-lg font-bold text-accent-soft-ink" aria-hidden>
                  {i + 1}
                </span>
                <h3 className="mt-4 text-xl">{step.title}</h3>
                <p className="mt-2 max-w-sm leading-relaxed text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="grid gap-10 border-t border-line py-16 sm:py-20 lg:grid-cols-2 lg:gap-16" aria-labelledby="costs-heading">
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
          <div>
            <h2 className="text-2xl sm:text-3xl">{PAGE.whyHeading}</h2>
            <ul className="mt-8 space-y-6">
              {PAGE.why.map((w) => (
                <li key={w.title}>
                  <p className="font-bold">{w.title}</p>
                  <p className="mt-1 leading-relaxed text-muted">{w.body}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="grid gap-4 border-t border-line py-16 sm:grid-cols-2 sm:py-20" aria-label="Authors and bookshops">
          {PAGE.doors.map((d) => (
            <Link key={d.title} to="/start-selling" className="card lift group block p-6 no-underline sm:p-8">
              <h2 className="text-xl text-ink">{d.title}</h2>
              <p className="mt-2 text-muted">{d.body}</p>
              <span className="mt-5 inline-flex items-center gap-1 text-sm font-medium text-accent-ink">
                {PAGE.hero.cta}
                <ChevronRightIcon className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
              </span>
            </Link>
          ))}
        </section>

        <section className="border-t border-line py-16 sm:py-20" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-2xl sm:text-3xl">
            {PAGE.faqHeading}
          </h2>
          <div className="mt-8 max-w-3xl divide-y divide-line border-y border-line">
            {PAGE.faq.map((f, i) => (
              <details key={f.q} className="group py-1">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4 font-medium [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDownIcon className="size-5 shrink-0 text-subtle transition-transform group-open:rotate-180" aria-hidden />
                </summary>
                <p className="pb-5 leading-relaxed text-muted">
                  {f.a}
                  {i === PAGE.faq.length - 1 && (
                    <>
                      {' '}
                      <Link to="/legal/$page" params={{ page: 'seller-agreement' }}>
                        Seller agreement
                      </Link>
                    </>
                  )}
                </p>
              </details>
            ))}
          </div>
        </section>
      </div>

      <section className="band">
        <div className="page flex flex-col items-start justify-between gap-6 py-14 sm:flex-row sm:items-center">
          <h2 className="max-w-xl text-2xl sm:text-3xl">{PAGE.closing}</h2>
          <Cta onBand className="shrink-0" />
        </div>
      </section>
    </>
  )
}

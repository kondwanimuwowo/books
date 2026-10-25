import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { LEGAL_ORDER, LEGAL_PAGES, LEGAL_UPDATED } from '#/data/legal'
import type { LegalSlug } from '#/data/legal'
import { cn, formatDate } from '#/lib/utils'

const isSlug = (value: string): value is LegalSlug => (LEGAL_ORDER as string[]).includes(value)

export const Route = createFileRoute('/legal/$page')({
  loader: ({ params }) => {
    if (!isSlug(params.page)) throw notFound()
    return { slug: params.page }
  },
  head: ({ loaderData }) => {
    const page = loaderData ? LEGAL_PAGES[loaderData.slug] : null
    return { meta: page ? [{ title: `${page.title} | Kuwala Books` }, { name: 'description', content: page.summary }] : [] }
  },
  component: LegalPageView,
})

function LegalPageView() {
  const { slug } = Route.useLoaderData()
  const page = LEGAL_PAGES[slug]
  return (
    <div className="page py-10 lg:py-14">
      <div className="lg:grid lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-12">
        <nav aria-label="Legal" className="no-scrollbar -mx-4 mb-8 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:block lg:space-y-0.5 lg:px-0">
          {LEGAL_ORDER.map((s) => (
            <Link
              key={s}
              to="/legal/$page"
              params={{ page: s }}
              className={cn(
                'block shrink-0 rounded-lg px-3 py-2 text-[15px] whitespace-nowrap no-underline',
                s === slug ? 'bg-accent-soft font-medium text-accent-soft-ink' : 'text-muted hover:bg-sunken hover:text-ink',
              )}
            >
              {LEGAL_PAGES[s].title}
            </Link>
          ))}
        </nav>

        <article className="max-w-prose">
          <h1 className="text-4xl sm:text-5xl">{page.title}</h1>
          <p className="mt-3 text-lg text-muted">{page.summary}</p>
          <p className="mt-2 text-sm text-subtle">Last updated {formatDate(LEGAL_UPDATED)}</p>

          <div className="mt-10 space-y-10">
            {page.sections.map((section) => (
              <section key={section.heading}>
                <h2 className="text-xl">{section.heading}</h2>
                <div className="mt-3 space-y-3 leading-relaxed">
                  {section.blocks.map((block, i) =>
                    'p' in block ? (
                      <p key={i}>{block.p}</p>
                    ) : (
                      <ul key={i} className="list-disc space-y-2 pl-5 marker:text-subtle">
                        {block.list.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    ),
                  )}
                </div>
              </section>
            ))}
          </div>
        </article>
      </div>
    </div>
  )
}

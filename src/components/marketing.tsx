import { ChevronDownIcon } from '@heroicons/react/16/solid'
import { useId, useState } from 'react'
import type { ReactNode } from 'react'
import { CoverWallBackdrop, useCoverReveal } from './cover-wall'
import { cn } from '#/lib/utils'
import type { Illustration } from '#/data/marketing'

// The pieces every marketing page is built from, so they read as one family.

/** Light button for the burgundy bands. */
export const ON_BAND_BUTTON = 'btn bg-on-accent text-deep hover:bg-on-accent/90 hover:text-deep'

/** The opening band: the cover wall with its trailing spot, and the words on frosted glass. */
export function MarketingHero({ wall, title, titleBold, line, action, more }: { wall: string[]; title: string; titleBold: string; line: string; action: ReactNode; more: string }) {
  const { reveal, onPointerMove, onPointerLeave } = useCoverReveal()
  return (
    <section className="band relative overflow-hidden" onPointerMove={wall.length ? onPointerMove : undefined} onPointerLeave={wall.length ? onPointerLeave : undefined}>
      {wall.length > 0 && <CoverWallBackdrop tiles={wall} reveal={reveal} />}
      <div className="page-marketing rise relative py-14 sm:py-20">
        <div className={cn(wall.length > 0 && 'frost w-fit max-w-2xl rounded-xl px-6 py-7 sm:px-9 sm:py-9')}>
          <h1 className="max-w-2xl text-[2.25rem] leading-[1.06] font-normal sm:text-6xl">
            {title} <span className="block font-bold">{titleBold}</span>
          </h1>
          <p className="mt-4 max-w-lg text-lg text-on-deep-muted">{line}</p>
          <div className="mt-7 flex flex-wrap gap-3">
            {action}
            <a href="#how" className="btn frost-pill text-on-accent no-underline hover:text-on-accent">
              {more}
              <ChevronDownIcon className="size-4" aria-hidden />
            </a>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Numbered steps; the first section after the hero, which "How it works" jumps to. */
export function Steps({ heading, steps }: { heading: string; steps: readonly { title: string; body: string }[] }) {
  return (
    <section id="how" className="scroll-mt-24 py-16 sm:py-20" aria-labelledby="how-heading">
      <h2 id="how-heading" className="text-2xl sm:text-3xl">
        {heading}
      </h2>
      <ol className={cn('mt-10 grid gap-10 md:gap-12', steps.length === 4 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3')}>
        {steps.map((step, i) => (
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
  )
}

/** A titled list of short points: a bold lead and a line of detail. */
export function Points({ heading, points, children }: { heading: string; points: readonly { title: string; body: string }[]; children?: ReactNode }) {
  return (
    <div>
      <h2 className="text-2xl sm:text-3xl">{heading}</h2>
      <ul className="mt-8 space-y-6">
        {points.map((p) => (
          <li key={p.title}>
            <p className="font-bold">{p.title}</p>
            <p className="mt-1 leading-relaxed text-muted">{p.body}</p>
          </li>
        ))}
      </ul>
      {children}
    </div>
  )
}

/** Questions that open in place. */
export function Faq({ heading, items }: { heading: string; items: readonly { q: string; a: ReactNode }[] }) {
  // One answer open at a time: opening another closes this one.
  const [open, setOpen] = useState<number | null>(null)
  const id = useId()
  return (
    <section className="border-t border-line py-16 sm:py-20" aria-labelledby="faq-heading">
      <h2 id="faq-heading" className="text-center text-2xl sm:text-3xl">
        {heading}
      </h2>
      <div className="mx-auto mt-8 max-w-3xl divide-y divide-line border-y border-line">
        {items.map((f, i) => {
          const isOpen = open === i
          return (
            <div key={f.q} data-open={isOpen}>
              <h3>
                <button
                  type="button"
                  id={`${id}-q${i}`}
                  aria-expanded={isOpen}
                  aria-controls={`${id}-a${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="flex w-full cursor-pointer items-center justify-between gap-4 py-5 text-left font-medium"
                >
                  {f.q}
                  <ChevronDownIcon className="faq-chevron size-5 shrink-0 text-subtle" aria-hidden />
                </button>
              </h3>
              <div id={`${id}-a${i}`} role="region" aria-labelledby={`${id}-q${i}`} className="faq-panel" inert={!isOpen}>
                <div>
                  <p className="faq-answer pb-5 leading-relaxed text-muted">{f.a}</p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

/** The last word: one line and the page's main button, on a burgundy card within the page's margins. */
export function ClosingBand({ title, action }: { title: string; action: ReactNode }) {
  return (
    <section className="page-marketing pb-4">
      <div className="band flex flex-col items-start justify-between gap-6 rounded-xl px-6 py-10 sm:flex-row sm:items-center sm:px-12 sm:py-12">
        <h2 className="max-w-xl text-2xl sm:text-3xl">{title}</h2>
        {action}
      </div>
    </section>
  )
}

/** An illustration in the card frame: 12px corners and a hairline, no shadow. Loads as it scrolls into view. */
export function Picture({ image, className }: { image: Illustration; className?: string }) {
  return (
    <figure className={cn('overflow-hidden rounded-xl bg-sunken ring-1 ring-line', className)}>
      <img src={image.src} alt={image.alt} width={image.width} height={image.height} loading="lazy" decoding="async" className="block h-auto w-full" />
    </figure>
  )
}

/** Words beside a picture; `flip` puts the picture first on wide screens, so a page can alternate. Phones stack, words first. */
export function Feature({ image, flip = false, children }: { image: Illustration; flip?: boolean; children: ReactNode }) {
  return (
    <section className="grid items-center gap-10 border-t border-line py-16 sm:py-20 lg:grid-cols-2 lg:gap-24">
      <div className={cn(flip && 'lg:order-last')}>{children}</div>
      <Picture image={image} />
    </section>
  )
}

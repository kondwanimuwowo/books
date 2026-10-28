import { useRef } from 'react'
import type { PointerEvent, RefObject } from 'react'
import { cn } from '#/lib/utils'

// How far each spot closes the gap to what it follows, per 60fps frame. The clear spot trails the pointer and two
// fainter ones trail it in turn, so a quick flick leaves a short soft trail that settles back into one circle.
const FOLLOW = [0.1, 0.065, 0.04]
const SETTLED_PX = 0.4

/**
 * Drives the clear spot through CSS variables (--x0/--y0 … --x2/--y2) on the reveal layer, from a frame loop that
 * runs only while a spot is still moving, so the cursor never re-renders React. Mouse only; touch keeps the blur.
 */
export function useCoverReveal() {
  const reveal = useRef<HTMLDivElement>(null)
  const state = useRef({ target: { x: 0, y: 0 }, spots: FOLLOW.map(() => ({ x: 0, y: 0 })), frame: 0, last: 0 })

  const paint = () => {
    const el = reveal.current
    if (!el) return
    state.current.spots.forEach((s, i) => {
      el.style.setProperty(`--x${i}`, `${s.x}px`)
      el.style.setProperty(`--y${i}`, `${s.y}px`)
    })
  }

  const tick = (now: number) => {
    const s = state.current
    const steps = Math.min((now - s.last) / (1000 / 60), 4)
    s.last = now
    let moving = false
    s.spots.forEach((spot, i) => {
      const k = 1 - Math.pow(1 - FOLLOW[i], steps)
      spot.x += (s.target.x - spot.x) * k
      spot.y += (s.target.y - spot.y) * k
      if (Math.abs(s.target.x - spot.x) > SETTLED_PX || Math.abs(s.target.y - spot.y) > SETTLED_PX) moving = true
    })
    paint()
    s.frame = moving ? requestAnimationFrame(tick) : 0
  }

  const onPointerMove = (e: PointerEvent<HTMLElement>) => {
    const el = reveal.current
    if (!el || e.pointerType !== 'mouse') return
    const box = e.currentTarget.getBoundingClientRect()
    const s = state.current
    s.target = { x: e.clientX - box.left, y: e.clientY - box.top }
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    // Arriving (or asked for less motion): every spot starts where the pointer is, rather than sweeping in from afar.
    if (el.dataset.active !== 'true' || still) {
      s.spots = s.spots.map(() => ({ ...s.target }))
      el.dataset.still = String(still)
      paint()
    } else if (!s.frame) {
      s.last = performance.now()
      s.frame = requestAnimationFrame(tick)
    }
    el.dataset.active = 'true'
  }

  const onPointerLeave = () => {
    if (reveal.current) reveal.current.dataset.active = 'false'
  }

  return { reveal, onPointerMove, onPointerLeave }
}

/**
 * The cover wall behind a burgundy band: blurred and dimmed so words on top read, with a sharp copy that shows
 * through the clear spot. Place inside a relatively positioned, overflow-hidden parent that carries the pointer handlers.
 */
export function CoverWallBackdrop({ tiles, reveal }: { tiles: string[]; reveal: RefObject<HTMLDivElement | null> }) {
  return (
    <>
      {/* Blurred so the words lead; phones keep it light so the books still show through. */}
      <CoverWall tiles={tiles} className="blur-[2px] sm:blur-[7px]" />
      <div aria-hidden className="absolute inset-0 bg-deep/75" />
      {/* Mouse only: a clear spot that trails the pointer, to look at a book by hovering over it. */}
      <div ref={reveal} aria-hidden data-active="false" className="hero-reveal absolute inset-0">
        <CoverWall tiles={tiles} />
        <div className="absolute inset-0 bg-deep/30" />
      </div>
    </>
  )
}

function CoverWall({ tiles, className }: { tiles: string[]; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        'absolute -inset-6 grid -rotate-[4deg] grid-cols-[repeat(auto-fill,minmax(116px,1fr))] content-start gap-3 sm:grid-cols-[repeat(auto-fill,minmax(152px,1fr))]',
        className,
      )}
    >
      {tiles.map((src, i) => (
        <img key={i} src={src} alt="" loading="lazy" className="aspect-[2/3] w-full rounded-md object-cover" />
      ))}
    </div>
  )
}

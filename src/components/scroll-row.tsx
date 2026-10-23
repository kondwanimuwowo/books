import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { cn } from '#/lib/utils'

const NUDGE_KEY = 'kb_shelf_nudged'
const NUDGE_PX = 56

/**
 * A horizontal scroller that shows it scrolls: the edge with more to see fades out, and on touch
 * screens the first row to come into view nudges sideways once per visit, then settles back.
 */
export function ScrollRow({ className, children }: { className?: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ atStart: true, atEnd: true })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    let frame = 0
    const measure = () => {
      frame = 0
      setEdges({ atStart: el.scrollLeft <= 2, atEnd: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2 })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    el.addEventListener('scroll', schedule, { passive: true })
    const resize = new ResizeObserver(schedule)
    resize.observe(el)
    return () => {
      el.removeEventListener('scroll', schedule)
      resize.disconnect()
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el || !window.matchMedia('(pointer: coarse)').matches || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    try {
      if (sessionStorage.getItem(NUDGE_KEY)) return
    } catch {
      return
    }
    let timer: ReturnType<typeof setTimeout>
    const seen = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || el.scrollWidth <= el.clientWidth) return
        try {
          if (sessionStorage.getItem(NUDGE_KEY)) return seen.disconnect()
          sessionStorage.setItem(NUDGE_KEY, '1')
        } catch {
          return seen.disconnect()
        }
        seen.disconnect()
        el.scrollBy({ left: NUDGE_PX, behavior: 'smooth' })
        timer = setTimeout(() => el.scrollTo({ left: 0, behavior: 'smooth' }), 650)
      },
      { threshold: 0.6 },
    )
    seen.observe(el)
    return () => {
      seen.disconnect()
      clearTimeout(timer)
    }
  }, [])

  return (
    <div ref={ref} data-at-start={edges.atStart} data-at-end={edges.atEnd} className={cn('scroll-row no-scrollbar overflow-x-auto', className)}>
      {children}
    </div>
  )
}

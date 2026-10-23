import { useEffect, useRef, useState } from 'react'

// Same feel as the portfolio header: only hide after a deliberate run down the page, show on any move up.
const HIDE_AFTER_Y = 200
const HIDE_AFTER_RUN = 80

/** True while the header should be tucked away. Ignores scroll while focus is inside `ref` (typing a search). */
export function useHideOnScroll<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    let last = window.scrollY
    let runStart = last
    let frame = 0

    const update = () => {
      frame = 0
      const y = window.scrollY
      const focusedInside = !!ref.current?.contains(document.activeElement)
      if (y < last) {
        runStart = y
        setHidden(false)
      } else if (y > last) {
        if (!focusedInside && y > HIDE_AFTER_Y && y - runStart > HIDE_AFTER_RUN) setHidden(true)
      }
      last = y
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      if (frame) cancelAnimationFrame(frame)
    }
  }, [])

  return { ref, hidden, reveal: () => setHidden(false) }
}

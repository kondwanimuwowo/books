import { useEffect, useRef } from 'react'

const COLOURS = ['--color-accent', '--color-zambia', '--color-gold', '--color-emerald', '--color-copper']
const PIECES = 60
const DURATION_MS = 1600

/** One light burst from the top of its box, in the brand colours. Skipped entirely for reduced motion. */
export function Confetti() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const dpr = window.devicePixelRatio || 1
    const { width, height } = canvas.getBoundingClientRect()
    canvas.width = width * dpr
    canvas.height = height * dpr
    ctx.scale(dpr, dpr)
    const styles = getComputedStyle(document.documentElement)
    const palette = COLOURS.map((c) => styles.getPropertyValue(c).trim()).filter(Boolean)
    const pieces = Array.from({ length: PIECES }, () => ({
      x: width / 2 + (Math.random() - 0.5) * width * 0.3,
      y: height * 0.15,
      vx: (Math.random() - 0.5) * 9,
      vy: -Math.random() * 7 - 3,
      size: Math.random() * 5 + 4,
      spin: Math.random() * Math.PI,
      turn: (Math.random() - 0.5) * 0.3,
      colour: palette[Math.floor(Math.random() * palette.length)] ?? '#722f37',
    }))

    const start = performance.now()
    let frame = 0
    const draw = (now: number) => {
      const t = (now - start) / DURATION_MS
      ctx.clearRect(0, 0, width, height)
      if (t >= 1) return
      ctx.globalAlpha = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
      for (const p of pieces) {
        p.vy += 0.28
        p.vx *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.spin += p.turn
        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.spin)
        ctx.fillStyle = p.colour
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2)
        ctx.restore()
      }
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={ref} aria-hidden className="pointer-events-none absolute inset-0 h-full w-full" />
}

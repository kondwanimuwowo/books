import { Link } from '@tanstack/react-router'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { COOKIE_CATEGORIES, COOKIE_COPY, OPTIONAL_CATEGORIES } from '#/data/cookies'
import type { CookieCategory } from '#/data/cookies'
import { CONSENT_EVENT, readConsent, saveConsent } from '#/lib/consent'
import { cn } from '#/lib/utils'

const EASE_OUT = [0.23, 1, 0.32, 1] as const
// Long enough that the page has settled; the notice shouldn't be the first thing that moves.
const SHOW_AFTER_MS = 900

/**
 * Asks once per device (and again whenever an optional service is added). With nothing optional yet, it's an
 * honest notice with one button; categories become choices as soon as they have a service in them.
 */
export function CookieNotice() {
  const [open, setOpen] = useState(false)
  const [choosing, setChoosing] = useState(false)
  const [choices, setChoices] = useState<Partial<Record<CookieCategory, boolean>>>({})

  useEffect(() => {
    const timer = readConsent() ? undefined : setTimeout(() => setOpen(true), SHOW_AFTER_MS)
    const reopen = (e: Event) => {
      if ((e as CustomEvent).detail !== 'open') return
      setChoices(readConsent()?.choices ?? {})
      setChoosing(OPTIONAL_CATEGORIES.length > 0)
      setOpen(true)
    }
    window.addEventListener(CONSENT_EVENT, reopen)
    return () => {
      clearTimeout(timer)
      window.removeEventListener(CONSENT_EVENT, reopen)
    }
  }, [])

  const decide = (picked: Partial<Record<CookieCategory, boolean>>) => {
    saveConsent(picked)
    setOpen(false)
    setChoosing(false)
  }
  const all = Object.fromEntries(OPTIONAL_CATEGORIES.map((c) => [c.key, true]))
  const hasChoices = OPTIONAL_CATEGORIES.length > 0

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence>
        {open && (
          <motion.section
            role="region"
            aria-label={COOKIE_COPY.title}
            initial={{ opacity: 0, transform: 'translateY(16px)' }}
            animate={{ opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.32, ease: EASE_OUT } }}
            exit={{ opacity: 0, transform: 'translateY(12px)', transition: { duration: 0.18, ease: EASE_OUT } }}
            className="card fixed inset-x-3 bottom-[calc(0.75rem+var(--tabbar-h,env(safe-area-inset-bottom)))] z-40 p-5 shadow-lg sm:inset-x-auto sm:left-5 sm:bottom-5 sm:w-[26rem]"
          >
            <h2 className="flex items-center gap-2 text-base font-bold">
              <CookieIcon className="size-5 shrink-0 text-accent-ink" />
              {COOKIE_COPY.title}
            </h2>
            <p className="mt-1.5 text-sm leading-relaxed text-muted">
              {hasChoices ? COOKIE_COPY.withChoices : COOKIE_COPY.essentialOnly}{' '}
              <Link to="/legal/$page" params={{ page: 'privacy' }} className="whitespace-nowrap">
                {COOKIE_COPY.more}
              </Link>
            </p>

            <AnimatePresence initial={false}>
              {choosing && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto', transition: { duration: 0.28, ease: EASE_OUT } }}
                  exit={{ opacity: 0, height: 0, transition: { duration: 0.18, ease: EASE_OUT } }}
                  className="overflow-hidden"
                >
                  <ul className="mt-4 space-y-3 border-t border-line pt-4">
                    {COOKIE_CATEGORIES.filter((c) => c.required || c.services.length > 0).map((c) => (
                      <li key={c.key} className="flex items-start justify-between gap-4">
                        <span className="min-w-0 text-sm">
                          <span className="block font-medium">{c.label}</span>
                          <span className="block text-xs text-subtle">{c.description}</span>
                        </span>
                        <Switch
                          label={c.label}
                          checked={c.required || choices[c.key] === true}
                          disabled={c.required}
                          onChange={(on) => setChoices((v) => ({ ...v, [c.key]: on }))}
                        />
                      </li>
                    ))}
                  </ul>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="mt-4 flex flex-wrap gap-2">
              {!hasChoices ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => decide({})}>
                  {COOKIE_COPY.ok}
                </button>
              ) : choosing ? (
                <button type="button" className="btn btn-primary btn-sm" onClick={() => decide(choices)}>
                  {COOKIE_COPY.save}
                </button>
              ) : (
                <>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => decide(all)}>
                    {COOKIE_COPY.acceptAll}
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => decide({})}>
                    {COOKIE_COPY.essentialButton}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setChoosing(true)}>
                    {COOKIE_COPY.choose}
                  </button>
                </>
              )}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </MotionConfig>
  )
}

// Heroicons has no cookie; drawn to match its 20px solid set: a disc with a bite out of it and three chips.
function CookieIcon({ className }: { className?: string }) {
  return (
    <svg aria-hidden viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M17.41 6.98A8 8 0 1 1 13.02 2.59 4 4 0 0 0 17.41 6.98ZM8.25 7.25a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Zm4.5 4a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0ZM7.5 14.5a1.25 1.25 0 1 1-2.5 0 1.25 1.25 0 0 1 2.5 0Z"
      />
    </svg>
  )
}

function Switch({ label, checked, disabled, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn('relative mt-0.5 h-6 w-10 shrink-0 rounded-full transition-colors duration-200 disabled:opacity-60', checked ? 'bg-accent' : 'bg-sunken-strong')}
    >
      <span
        aria-hidden
        className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-surface shadow-sm transition-transform duration-200 ease-out', checked && 'translate-x-4')}
      />
    </button>
  )
}

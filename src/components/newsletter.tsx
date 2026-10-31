import { CheckIcon } from '@heroicons/react/16/solid'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import type { ReactNode } from 'react'
import { useId, useState } from 'react'
import { subscribeToNews } from '#/functions/emails.functions'
import { errorMessage } from '#/components/form'
import { NEWSLETTER_COPY as COPY } from '#/data/emails'
import type { NEWSLETTER_SOURCES } from '#/data/emails'
import { cn } from '#/lib/utils'

const EASE_OUT = [0.23, 1, 0.32, 1] as const

// On the burgundy footer the button is white: a burgundy one would vanish into the band.
const TONES = {
  band: {
    title: 'text-on-accent',
    line: 'text-on-deep-muted',
    well: 'bg-black/25 focus-within:ring-on-accent/50',
    input: 'text-on-accent placeholder:text-on-deep-muted/70',
    button: 'bg-on-accent text-deep hover:bg-on-accent/90',
    error: 'text-on-accent',
  },
  page: {
    title: 'text-ink',
    line: 'text-muted',
    well: 'bg-sunken focus-within:ring-accent-ink/40',
    input: 'text-ink placeholder:text-subtle',
    button: 'bg-accent text-on-accent hover:bg-accent-hover',
    error: 'text-danger',
  },
} as const

/** The button's words cross-fade between states, so it reads as one change rather than two swaps. */
function Morph({ state, children }: { state: string; children: ReactNode }) {
  return (
    <span className="relative inline-flex items-center justify-center">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={state}
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
          initial={{ opacity: 0, filter: 'blur(4px)' }}
          animate={{ opacity: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, filter: 'blur(4px)' }}
          transition={{ duration: 0.2, ease: EASE_OUT }}
        >
          {children}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

/** The newsletter sign-up: on the burgundy footer, or on a white page. A confirmation email does the rest. */
export function NewsletterForm({ source, tone = 'page', className }: { source: (typeof NEWSLETTER_SOURCES)[number]; tone?: keyof typeof TONES; className?: string }) {
  const id = useId()
  const t = TONES[tone]
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'done'>('idle')
  const [sentTo, setSentTo] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setState('loading')
    setError(null)
    try {
      await subscribeToNews({ data: { email, source, website } })
      setSentTo(email.trim())
      // The button shows its tick for a moment before the message replaces the form.
      setState('sent')
      setTimeout(() => setState('done'), 900)
    } catch (e) {
      setError(errorMessage(e))
      setState('idle')
    }
  }

  return (
    <div className={className}>
      <label htmlFor={id} className={cn('font-medium', t.title)}>
        {COPY.heading}
      </label>
      <p className={cn('mt-1', t.line)}>{COPY.line}</p>
      <MotionConfig reducedMotion="user">
        <AnimatePresence mode="wait" initial={false}>
          {state !== 'done' ? (
            <motion.form
              key="form"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
              className={cn('mt-3 flex max-w-md items-center rounded-control py-1.5 pr-1.5 pl-4 ring-0 ring-transparent transition-shadow focus-within:ring-2', t.well)}
            >
              <input
                id={id}
                type="email"
                autoComplete="email"
                required
                placeholder={COPY.emailLabel}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={cn('h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none', t.input)}
              />
              <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
              <button
                type="submit"
                disabled={state !== 'idle'}
                className={cn('inline-flex h-9 min-w-28 shrink-0 items-center justify-center rounded-[7px] px-4 text-sm font-medium transition-[background-color,scale] duration-150 active:scale-[0.97] disabled:opacity-80', t.button)}
              >
                <Morph state={state}>
                  {state === 'loading' ? (
                    <>
                      <span aria-hidden className="size-3 animate-spin rounded-full border-2 border-current/30 border-t-current" /> {COPY.sending}
                    </>
                  ) : state === 'sent' ? (
                    <>
                      <CheckIcon className="size-4" aria-hidden /> {COPY.sentShort}
                    </>
                  ) : (
                    COPY.submit
                  )}
                </Morph>
              </button>
            </motion.form>
          ) : (
            <motion.p
              key="done"
              role="status"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, ease: EASE_OUT }}
              className={cn('mt-3 flex max-w-md items-center gap-2.5 rounded-control px-4 py-3 text-sm', t.well, t.title)}
            >
              <span className={cn('flex size-5 shrink-0 items-center justify-center rounded-full', t.button)}>
                <CheckIcon className="size-3" aria-hidden />
              </span>
              {COPY.sent(sentTo)}
            </motion.p>
          )}
        </AnimatePresence>
      </MotionConfig>
      {error && <p className={cn('mt-2 text-sm', t.error)}>{error}</p>}
      {state !== 'done' && <p className={cn('mt-2 text-xs', t.line)}>{COPY.privacy}</p>}
    </div>
  )
}

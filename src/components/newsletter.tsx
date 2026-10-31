import { useId, useState } from 'react'
import { subscribeToNews } from '#/functions/emails.functions'
import { useAction } from '#/components/form'
import { NEWSLETTER_COPY as COPY } from '#/data/emails'
import type { NEWSLETTER_SOURCES } from '#/data/emails'
import { cn } from '#/lib/utils'

/** The newsletter sign-up: on the burgundy footer, or on a white page. A confirmation email does the rest. */
export function NewsletterForm({ source, tone = 'page', className }: { source: (typeof NEWSLETTER_SOURCES)[number]; tone?: 'band' | 'page'; className?: string }) {
  const id = useId()
  const [email, setEmail] = useState('')
  const [website, setWebsite] = useState('')
  const [sentTo, setSentTo] = useState<string | null>(null)
  const action = useAction(async () => {
    await subscribeToNews({ data: { email, source, website } })
    setSentTo(email.trim())
    setEmail('')
  })
  const band = tone === 'band'

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault()
        void action.run()
      }}
    >
      <label htmlFor={id} className={cn('font-medium', band ? 'text-on-accent' : 'text-ink')}>
        {COPY.heading}
      </label>
      <p className={cn('mt-1', band ? 'text-on-deep-muted' : 'text-muted')}>{COPY.line}</p>
      {sentTo ? (
        <p role="status" className={cn('mt-3', band ? 'text-on-accent' : 'text-ink')}>
          {COPY.sent(sentTo)}
        </p>
      ) : (
        <div className="mt-3 flex max-w-sm gap-2">
          <input
            id={id}
            className="input min-w-0 flex-1"
            type="email"
            autoComplete="email"
            placeholder={COPY.emailLabel}
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden className="hidden" value={website} onChange={(e) => setWebsite(e.target.value)} />
          <button type="submit" className={cn('btn shrink-0', band ? 'bg-on-accent text-deep hover:bg-on-accent/90 hover:text-deep' : 'btn-primary')} disabled={action.pending}>
            {action.pending ? 'Sending…' : COPY.submit}
          </button>
        </div>
      )}
      {action.error && <p className={cn('mt-2 text-sm', band ? 'text-on-accent' : 'text-danger')}>{action.error}</p>}
      {!sentTo && <p className={cn('mt-2 text-xs', band ? 'text-on-deep-muted' : 'text-subtle')}>{COPY.privacy}</p>}
    </form>
  )
}

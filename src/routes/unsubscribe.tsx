import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { unsubscribe } from '#/functions/emails.functions'
import { Alert, useAction } from '#/components/form'
import { EMAIL_LISTS, NEWSLETTER_COPY as COPY } from '#/data/emails'

// The link in an alert or newsletter. A button, so mail scanners opening the link don't unsubscribe anyone.
export const Route = createFileRoute('/unsubscribe')({
  validateSearch: z.object({ t: z.string().optional(), list: z.enum(EMAIL_LISTS).catch('news') }),
  head: () => ({ meta: [{ title: 'Unsubscribe | Kuwala Books' }, { name: 'robots', content: 'noindex' }] }),
  component: UnsubscribePage,
})

function UnsubscribePage() {
  const { t, list } = Route.useSearch()
  const [done, setDone] = useState(false)
  const action = useAction(async () => {
    await unsubscribe({ data: { token: t ?? '', list } })
    setDone(true)
  })

  return (
    <div className="page rise max-w-xl py-16">
      <h1 className="text-3xl sm:text-4xl">{COPY.unsubscribeHeading[list]}</h1>
      {done ? (
        <>
          <p className="mt-4 text-lg">{COPY.unsubscribed}</p>
          <p className="mt-2 text-muted">
            <Link to="/account/settings">{COPY.changedMind}</Link>
          </p>
        </>
      ) : !t ? (
        <p className="mt-4 text-lg">{COPY.badToken}</p>
      ) : (
        <>
          <p className="mt-3 text-muted">{COPY.unsubscribeBody[list]}</p>
          {action.error && (
            <div className="mt-6">
              <Alert>{action.error}</Alert>
            </div>
          )}
          <button type="button" className="btn btn-primary mt-6" disabled={action.pending} onClick={() => void action.run()}>
            {action.pending ? 'Unsubscribing…' : COPY.unsubscribeButton}
          </button>
        </>
      )}
    </div>
  )
}

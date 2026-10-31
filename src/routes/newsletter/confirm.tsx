import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { confirmNews } from '#/functions/emails.functions'
import { Alert, useAction } from '#/components/form'
import { NEWSLETTER_COPY as COPY } from '#/data/emails'

// A button rather than confirming on load: mail scanners open links, and only a person should sign up.
export const Route = createFileRoute('/newsletter/confirm')({
  validateSearch: z.object({ t: z.string().optional() }),
  head: () => ({ meta: [{ title: `${COPY.confirmHeading} | Kuwala Books` }, { name: 'robots', content: 'noindex' }] }),
  component: ConfirmPage,
})

function ConfirmPage() {
  const { t } = Route.useSearch()
  const [done, setDone] = useState(false)
  const action = useAction(async () => {
    await confirmNews({ data: { token: t ?? '' } })
    setDone(true)
  })

  return (
    <div className="page rise max-w-xl py-16">
      <h1 className="text-3xl sm:text-4xl">{COPY.confirmHeading}</h1>
      {done ? (
        <p className="mt-4 text-lg">{COPY.confirmed}</p>
      ) : !t ? (
        <p className="mt-4 text-lg">{COPY.badToken}</p>
      ) : (
        <>
          <p className="mt-3 text-muted">{COPY.confirmBody}</p>
          {action.error && (
            <div className="mt-6">
              <Alert>{action.error}</Alert>
            </div>
          )}
          <button type="button" className="btn btn-primary mt-6" disabled={action.pending} onClick={() => void action.run()}>
            {action.pending ? 'Confirming…' : COPY.confirmAction}
          </button>
        </>
      )}
    </div>
  )
}

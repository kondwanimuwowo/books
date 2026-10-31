import { Link, createFileRoute, useLoaderData } from '@tanstack/react-router'
import { useState } from 'react'
import { updatePassword } from '#/functions/auth.functions'
import { deleteMyAccount, getDeletionBlockers } from '#/functions/accounts.functions'
import { getEmailPrefs, saveEmailPref } from '#/functions/emails.functions'
import { Switch } from '#/components/cookie-notice'
import { Alert, Field, useAction } from '#/components/form'
import { Placeholder, RowShapes } from '#/components/placeholder'
import { DELETE_ACCOUNT_COPY as COPY, DELETION_BLOCKERS } from '#/data/accounts'
import { EMAIL_LISTS, EMAIL_PREFS_COPY } from '#/data/emails'
import type { EmailList } from '#/data/emails'

export const Route = createFileRoute('/_authed/account/settings')({
  head: () => ({ meta: [{ title: 'Settings | Kuwala Books' }] }),
  pendingComponent: () => <Placeholder mode="loading" label="Loading settings" shapes={<RowShapes count={3} cover={false} />} />,
  loader: async () => {
    const [blockers, emails] = await Promise.all([getDeletionBlockers(), getEmailPrefs()])
    return { blockers, emails }
  },
  component: SettingsPage,
})

function SettingsPage() {
  return (
    <div className="max-w-lg space-y-12">
      <EmailsSection />
      <PasswordSection />
      <DeleteSection />
    </div>
  )
}

function EmailsSection() {
  const { emails } = Route.useLoaderData()
  const [prefs, setPrefs] = useState(emails)
  const action = useAction(async (list: EmailList, on: boolean) => {
    setPrefs((p) => ({ ...p, [list]: on }))
    try {
      await saveEmailPref({ data: { list, on } })
    } catch (error) {
      setPrefs((p) => ({ ...p, [list]: !on }))
      throw error
    }
  })

  return (
    <section aria-labelledby="emails-heading" className="space-y-5">
      <div>
        <h2 id="emails-heading" className="text-2xl">
          {EMAIL_PREFS_COPY.heading}
        </h2>
        <p className="mt-1 text-sm text-muted">{EMAIL_PREFS_COPY.intro}</p>
      </div>
      {action.error && <Alert>{action.error}</Alert>}
      <ul className="space-y-4">
        {EMAIL_LISTS.map((list) => (
          <li key={list} className="flex items-start justify-between gap-6">
            <div>
              <p className="font-medium">{EMAIL_PREFS_COPY[list].label}</p>
              <p className="mt-0.5 text-sm text-muted">{EMAIL_PREFS_COPY[list].hint}</p>
            </div>
            <Switch label={EMAIL_PREFS_COPY[list].label} checked={prefs[list]} disabled={action.pending} onChange={(on) => void action.run(list, on)} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function PasswordSection() {
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const action = useAction(async () => {
    await updatePassword({ data: { password } })
    setDone(true)
    setPassword('')
  })

  return (
    <form
      className="max-w-sm space-y-5 border-t border-line pt-10"
      onSubmit={(e) => {
        e.preventDefault()
        void action.run()
      }}
    >
      <h2 className="text-2xl">Password</h2>
      {done && <Alert tone="success">Changed.</Alert>}
      {action.error && <Alert>{action.error}</Alert>}
      <Field label="New password" hint="At least 8 characters">
        <input className="input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button type="submit" className="btn btn-primary" disabled={action.pending}>
        {action.pending ? 'Saving…' : 'Save password'}
      </button>
    </form>
  )
}

function DeleteSection() {
  const { blockers } = Route.useLoaderData()
  const { user } = useLoaderData({ from: '__root__' })
  const [email, setEmail] = useState('')
  const matches = !!user && email.trim().toLowerCase() === user.email.toLowerCase()
  const action = useAction(async () => {
    await deleteMyAccount({ data: { confirmEmail: email } })
    // A fresh page load, so nothing from the deleted session survives.
    window.location.assign('/')
  })

  return (
    <section aria-labelledby="delete-heading" className="space-y-4 border-t border-line pt-10">
      <h2 id="delete-heading" className="text-2xl">
        {COPY.heading}
      </h2>
      <p className="text-muted">{COPY.intro}</p>
      <ul className="list-disc space-y-1 pl-5 text-sm">
        {COPY.removes.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
      <p className="text-sm text-muted">{COPY.keeps}</p>

      {blockers.length ? (
        <Alert tone="info">
          <p className="font-medium">{COPY.blocked}</p>
          <ul className="mt-1.5 space-y-1">
            {blockers.map((b) => (
              <li key={b.kind}>
                <Link to={DELETION_BLOCKERS[b.kind].to}>{DELETION_BLOCKERS[b.kind].text(b.count)}</Link>
              </li>
            ))}
          </ul>
        </Alert>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void action.run()
          }}
        >
          {action.error && <Alert>{action.error}</Alert>}
          <Field label={COPY.confirmLabel}>
            <input className="input" type="email" autoComplete="off" spellCheck={false} value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <button type="submit" className="btn bg-danger text-on-accent hover:bg-danger/90 hover:text-on-accent" disabled={!matches || action.pending}>
            {action.pending ? COPY.deleting : COPY.button}
          </button>
        </form>
      )}
    </section>
  )
}

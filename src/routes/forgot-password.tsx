import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { requestPasswordReset } from '#/functions/auth.functions'
import { AuthShell } from '#/components/auth-shell'
import { Alert, Field, useAction } from '#/components/form'

export const Route = createFileRoute('/forgot-password')({
  head: () => ({ meta: [{ title: 'Reset password | Kuwala Books' }] }),
  component: ForgotPassword,
})

function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const action = useAction(async () => {
    await requestPasswordReset({ data: { email } })
    setSent(true)
  })

  return (
    <AuthShell title="Reset your password" subtitle="We'll email you a link to choose a new one.">
      {sent ? (
        <Alert tone="info">If an account exists for {email}, a reset link is on its way.</Alert>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e) => {
            e.preventDefault()
            void action.run()
          }}
        >
          {action.error && <Alert>{action.error}</Alert>}
          <Field label="Email">
            <input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </Field>
          <button type="submit" className="btn btn-primary w-full" disabled={action.pending}>
            Send reset link
          </button>
        </form>
      )}
    </AuthShell>
  )
}

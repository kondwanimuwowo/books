import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { updatePassword } from '#/functions/auth.functions'
import { Alert, Field, useAction } from '#/components/form'

export const Route = createFileRoute('/_authed/account/password')({
  component: PasswordPage,
})

function PasswordPage() {
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const action = useAction(async () => {
    await updatePassword({ data: { password } })
    setDone(true)
    setPassword('')
  })

  return (
    <form
      className="max-w-sm space-y-5"
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

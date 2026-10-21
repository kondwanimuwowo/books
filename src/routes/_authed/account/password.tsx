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
      className="max-w-sm space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void action.run()
      }}
    >
      {done && <Alert tone="success">Password updated.</Alert>}
      {action.error && <Alert>{action.error}</Alert>}
      <Field label="New password" hint="At least 8 characters">
        <input className="input" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <button type="submit" className="btn btn-primary" disabled={action.pending}>
        Update password
      </button>
    </form>
  )
}

import { Link, createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { signIn } from '#/functions/auth.functions'
import { AuthShell } from '#/components/auth-shell'
import { GoogleButton, OrDivider } from '#/components/google-button'
import { AUTH_COPY, authReason } from '#/data/auth'
import { Alert, Field, useAction } from '#/components/form'
import { safeNext } from '#/lib/utils'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ next: z.string().optional(), error: z.string().optional() }),
  head: () => ({ meta: [{ title: 'Sign in | Kuwala Books' }] }),
  component: LoginPage,
})

function LoginPage() {
  const { next, error: linkError } = Route.useSearch()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const action = useAction(async () => {
    await signIn({ data: { email, password } })
    // A fresh page load, so the header and every page are built with the new session.
    window.location.assign(safeNext(next))
  })

  return (
    <AuthShell title="Sign in" subtitle={authReason(next)} mode="signin" next={next}>
      {linkError && (
        <div className="mb-4">
          <Alert>{linkError === 'google' ? AUTH_COPY.googleFailed : AUTH_COPY.linkExpired}</Alert>
        </div>
      )}
      <GoogleButton next={next} />
      <div className="my-6">
        <OrDivider />
      </div>
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
        <Field label="Password">
          <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <button type="submit" className="btn btn-primary w-full" disabled={action.pending}>
          {action.pending ? 'Signing in…' : 'Sign in'}
        </button>
        <Link to="/forgot-password" className="block text-center text-sm">
          Forgot password?
        </Link>
      </form>
    </AuthShell>
  )
}

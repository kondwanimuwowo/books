import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { signIn } from '#/functions/auth.functions'
import { AuthShell } from '#/components/auth-shell'
import { Alert, Field, useAction } from '#/components/form'
import { safeNext } from '#/lib/utils'

export const Route = createFileRoute('/login')({
  validateSearch: z.object({ next: z.string().optional(), error: z.string().optional() }),
  head: () => ({ meta: [{ title: 'Sign in | Kuwala Books' }] }),
  component: LoginPage,
})

function LoginPage() {
  const { next, error: linkError } = Route.useSearch()
  const router = useRouter()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const action = useAction(async () => {
    await signIn({ data: { email, password } })
    await router.invalidate()
    await navigate({ href: safeNext(next) })
  })

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to Kuwala Books."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" search={{ next }} className="font-medium">
            Create an account
          </Link>
        </>
      }
    >
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          void action.run()
        }}
      >
        {linkError && <Alert>That link has expired or was already used. Sign in, or request a new one.</Alert>}
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
          Forgot your password?
        </Link>
      </form>
    </AuthShell>
  )
}

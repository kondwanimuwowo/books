import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { signIn, signOut } from '#/functions/auth.functions'
import { Alert, Field, useAction } from '#/components/form'
import { safeNext } from '#/lib/utils'

export const Route = createFileRoute('/admin/login')({
  validateSearch: z.object({ next: z.string().optional() }),
  beforeLoad: ({ context }) => {
    if (context.admin.user?.isAdmin) throw redirect({ to: '/admin' })
  },
  component: AdminLogin,
})

function AdminLogin() {
  const { admin } = Route.useRouteContext()
  const { next } = Route.useSearch()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const action = useAction(async () => {
    await signIn({ data: { email, password } })
    // A fresh page load, so the header and every page are built with the new session.
    window.location.assign(next ? safeNext(next) : '/admin')
  })
  const leave = useAction(async () => {
    await signOut()
    await router.invalidate()
  })
  // Signed in on this host, but the account has no admin flag.
  const denied = !!admin.user && !admin.user.isAdmin

  return (
    <main className="flex min-h-dvh items-center justify-center px-4 py-12">
      <div className="rise w-full max-w-sm">
        <p className="text-center text-3xl leading-none font-bold tracking-[-0.04em]">
          kuwala<span className="font-normal text-accent-ink">books</span>
        </p>
        <p className="eyebrow mt-2 text-center">Admin</p>

        <div className="card mt-8 p-6 sm:p-8">
          {denied ? (
            <div className="space-y-4">
              <Alert>{admin.user?.email} doesn&rsquo;t have admin access.</Alert>
              <button type="button" className="btn btn-secondary w-full" disabled={leave.pending} onClick={() => void leave.run()}>
                Sign in with another account
              </button>
            </div>
          ) : (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault()
                void action.run()
              }}
            >
              <h1 className="text-xl">Sign in</h1>
              {action.error && <Alert>{action.error}</Alert>}
              <Field label="Email">
                <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Password">
                <input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </Field>
              <button type="submit" className="btn btn-primary w-full" disabled={action.pending}>
                {action.pending ? 'Signing in…' : 'Sign in'}
              </button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-sm">
          <a href={`${admin.appOrigin}/forgot-password`}>Forgot your password?</a>
        </p>
      </div>
    </main>
  )
}

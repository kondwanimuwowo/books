import { Link, createFileRoute } from '@tanstack/react-router'
import { EnvelopeIcon } from '@heroicons/react/20/solid'
import { useState } from 'react'
import { z } from 'zod'
import { signUp } from '#/functions/auth.functions'
import { getClaim } from '#/functions/claims.functions'
import { AuthShell } from '#/components/auth-shell'
import { Alert, Field, useAction } from '#/components/form'
import { safeNext } from '#/lib/utils'

export const Route = createFileRoute('/signup')({
  validateSearch: z.object({ next: z.string().optional(), invite: z.string().max(64).optional() }),
  // An author invited to claim their page arrives with their name and the address we wrote to already filled in.
  loaderDeps: ({ search }) => ({ invite: search.invite }),
  loader: ({ deps }) => (deps.invite ? getClaim({ data: { token: deps.invite } }) : null),
  head: () => ({ meta: [{ title: 'Create an account | Kuwala Books' }] }),
  component: SignupPage,
})

function SignupPage() {
  const { next } = Route.useSearch()
  const invite = Route.useLoaderData()
  const invited = invite?.state === 'open' ? invite : null
  const [form, setForm] = useState({ name: invited?.author.name ?? '', email: invited?.email ?? '', password: '' })
  const [sentTo, setSentTo] = useState<string | null>(null)
  const action = useAction(async () => {
    const result = await signUp({ data: { ...form, next: next ? safeNext(next) : undefined } })
    if (result.needsConfirmation) {
      setSentTo(form.email)
      return
    }
    // A fresh page load, so the header and every page are built with the new session.
    window.location.assign(safeNext(next))
  })

  if (sentTo) {
    return (
      <AuthShell
        title="Check your email"
        footer={
          <>
            Confirmed it?{' '}
            <Link to="/login" search={{ next }} className="font-medium">
              Sign in
            </Link>
          </>
        }
      >
        <div className="flex gap-3 rounded-xl bg-accent-soft p-4 text-accent-soft-ink">
          <EnvelopeIcon className="size-5 shrink-0" aria-hidden />
          <p className="text-sm">
            Open the link we sent to <strong>{sentTo}</strong>.
          </p>
        </div>
      </AuthShell>
    )
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })

  return (
    <AuthShell
      title="Create an account"
      footer={
        <>
          Have an account?{' '}
          <Link to="/login" search={{ next }} className="font-medium">
            Sign in
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
        {action.error && <Alert>{action.error}</Alert>}
        <Field label="Name">
          <input className="input" autoComplete="name" required minLength={2} value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="8+ characters">
          <input className="input" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
        </Field>
        <button type="submit" className="btn btn-primary w-full" disabled={action.pending}>
          {action.pending ? 'Creating…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}

import { Link, createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { MailCheck } from 'lucide-react'
import { useState } from 'react'
import { z } from 'zod'
import { signUp } from '#/functions/auth.functions'
import { AuthShell } from '#/components/auth-shell'
import { Alert, Field, useAction } from '#/components/form'
import { safeNext } from '#/lib/utils'

export const Route = createFileRoute('/signup')({
  validateSearch: z.object({ next: z.string().optional() }),
  head: () => ({ meta: [{ title: 'Create an account | Kuwala Books' }] }),
  component: SignupPage,
})

function SignupPage() {
  const { next } = Route.useSearch()
  const router = useRouter()
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [sentTo, setSentTo] = useState<string | null>(null)
  const action = useAction(async () => {
    const result = await signUp({ data: { ...form, next: next ? safeNext(next) : undefined } })
    if (result.needsConfirmation) {
      setSentTo(form.email)
      return
    }
    await router.invalidate()
    await navigate({ href: safeNext(next) })
  })

  if (sentTo) {
    return (
      <AuthShell title="Check your email">
        <div className="flex gap-3 rounded-xl bg-accent-100 p-4 text-accent-900">
          <MailCheck className="shrink-0" size={20} aria-hidden />
          <p className="text-sm">
            We sent a link to <strong>{sentTo}</strong>. Open it on this device to finish creating your account.
          </p>
        </div>
      </AuthShell>
    )
  }

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [key]: e.target.value })

  return (
    <AuthShell
      title="Create an account"
      subtitle="Buy from sellers across Zambia, or start selling your own books."
      footer={
        <>
          Already have an account?{' '}
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
        <Field label="Your name">
          <input className="input" autoComplete="name" required minLength={2} value={form.name} onChange={set('name')} />
        </Field>
        <Field label="Email">
          <input className="input" type="email" autoComplete="email" required value={form.email} onChange={set('email')} />
        </Field>
        <Field label="Password" hint="At least 8 characters">
          <input className="input" type="password" autoComplete="new-password" required minLength={8} value={form.password} onChange={set('password')} />
        </Field>
        <button type="submit" className="btn btn-primary w-full" disabled={action.pending}>
          {action.pending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}

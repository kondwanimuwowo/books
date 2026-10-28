import { Link, createFileRoute, redirect } from '@tanstack/react-router'
import { CheckIcon } from '@heroicons/react/20/solid'
import { getSessionUser } from '#/functions/auth.functions'
import { GoogleButton, OrDivider } from '#/components/google-button'
import { AUTH_COPY } from '#/data/auth'

// The Account tab for people who aren't signed in, as the apps will have it: one place to join or sign in.
export const Route = createFileRoute('/welcome')({
  beforeLoad: async () => {
    if (await getSessionUser()) throw redirect({ to: '/account' })
  },
  head: () => ({ meta: [{ title: 'Your account | Kuwala Books' }, { name: 'robots', content: 'noindex' }] }),
  component: Welcome,
})

function Welcome() {
  return (
    <div className="page max-w-md py-10 sm:py-16">
      <h1 className="text-3xl sm:text-4xl">{AUTH_COPY.welcomeTitle}</h1>
      <p className="mt-2 text-muted">{AUTH_COPY.welcomeLine}</p>
      <ul className="mt-6 space-y-2.5 text-sm">
        {AUTH_COPY.perks.map((perk) => (
          <li key={perk} className="flex gap-2.5">
            <CheckIcon aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-ink" />
            {perk}
          </li>
        ))}
      </ul>
      <div className="mt-8 space-y-3">
        <Link to="/signup" className="btn btn-primary w-full">
          {AUTH_COPY.createAccount}
        </Link>
        <Link to="/login" className="btn btn-secondary w-full">
          {AUTH_COPY.signIn}
        </Link>
      </div>
      <div className="my-6">
        <OrDivider />
      </div>
      <GoogleButton />
    </div>
  )
}

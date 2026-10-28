import { Link, useLoaderData, useLocation, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { acceptTerms, signOut } from '#/functions/auth.functions'
import { TERMS_VERSION } from '#/data/legal'
import { Alert, useAction } from './form'

/** The box people tick themselves: never pre-ticked, and the links open the documents they're agreeing to. */
export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-start gap-3 text-sm leading-relaxed">
      <input type="checkbox" required className="mt-1 size-4 shrink-0 accent-[var(--color-accent)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>
        I agree to the{' '}
        <Link to="/legal/$page" params={{ page: 'terms' }} target="_blank">
          Terms of use
        </Link>
        ,{' '}
        <Link to="/legal/$page" params={{ page: 'buyer-protection' }} target="_blank">
          Buyer protection
        </Link>{' '}
        rules and{' '}
        <Link to="/legal/$page" params={{ page: 'privacy' }} target="_blank">
          Privacy
        </Link>{' '}
        policy, and confirm I’m 18 or older or have a parent’s or guardian’s permission.
      </span>
    </label>
  )
}

// Reading the documents must stay possible while the box is waiting, and so must deleting the account instead.
const OPEN_PATHS = ['/legal/', '/login', '/signup', '/auth/', '/account/settings']

/**
 * Accounts that haven't accepted the current terms (created before the checkbox, or after a material change)
 * are asked once before they carry on. Signing out is always an option.
 */
export function TermsGate() {
  const { user } = useLoaderData({ from: '__root__' })
  const { pathname } = useLocation()
  const router = useRouter()
  const [agreed, setAgreed] = useState(false)
  const accept = useAction(async () => {
    await acceptTerms({ data: { accept: true } })
    await router.invalidate()
  })
  if (!user || user.termsVersion === TERMS_VERSION || OPEN_PATHS.some((p) => pathname.startsWith(p))) return null

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-deep/60 p-4 backdrop-blur-sm" role="presentation">
      <div role="dialog" aria-modal="true" aria-labelledby="terms-gate-title" className="card rise w-full max-w-md space-y-5 p-6">
        <div>
          <h2 id="terms-gate-title" className="text-2xl">
            {user.termsVersion ? 'We’ve updated our terms' : 'Before you carry on'}
          </h2>
          <p className="mt-2 text-sm text-muted">Please read and accept the rules for buying and selling on Kuwala Books.</p>
        </div>
        <TermsCheckbox checked={agreed} onChange={setAgreed} />
        {accept.error && <Alert>{accept.error}</Alert>}
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" className="btn btn-primary" disabled={!agreed || accept.pending} onClick={() => void accept.run()}>
            {accept.pending ? 'Saving…' : 'Accept and continue'}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={async () => {
              await signOut()
              window.location.assign('/')
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  )
}

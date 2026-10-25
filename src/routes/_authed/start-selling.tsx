import { createFileRoute, useLoaderData, useNavigate, useRouter } from '@tanstack/react-router'
import { ArrowLeftIcon } from '@heroicons/react/16/solid'
import { AnimatePresence, MotionConfig, motion } from 'motion/react'
import { useEffect, useRef } from 'react'
import { z } from 'zod'
import { getMySeller } from '#/functions/sell.functions'
import { getClaimTarget, getMyVerification } from '#/functions/verification.functions'
import { DoneStep, RoleStep, SetupStep } from '#/components/onboarding/steps'
import { emptyVerify, useDraft } from '#/components/onboarding/draft'
import type { Draft } from '#/components/onboarding/draft'
import { VerificationForm } from '#/components/verification-form'
import { Placeholder, RowShapes } from '#/components/placeholder'
import { KIND_COPY, ONBOARDING } from '#/data/onboarding'
import { PROVINCES } from '#/data/zambia'
import type { Province } from '#/data/zambia'

const STEPS = ['role', 'setup', 'verify', 'done'] as const
type Step = (typeof STEPS)[number]

export const Route = createFileRoute('/_authed/start-selling')({
  validateSearch: z.object({ step: z.enum(STEPS).optional(), author: z.string().uuid().optional() }),
  loaderDeps: ({ search }) => ({ author: search.author }),
  loader: async ({ deps }) => {
    const [mine, claim] = await Promise.all([getMySeller(), deps.author ? getClaimTarget({ data: { id: deps.author } }) : null])
    const verification = mine.seller && !mine.seller.verified ? await getMyVerification() : null
    return { ...mine, verification, claim }
  },
  pendingComponent: () => <Placeholder mode="loading" label="Loading" shapes={<RowShapes count={4} cover={false} />} />,
  head: () => ({ meta: [{ title: 'Start selling | Kuwala Books' }] }),
  component: StartSelling,
})

const SLIDE = 24
const EASE_OUT = [0.23, 1, 0.32, 1] as const
const step = {
  enter: (dir: number) => ({ opacity: 0, transform: `translateX(${dir * SLIDE}px)`, filter: 'blur(2px)' }),
  shown: { opacity: 1, transform: 'translateX(0px)', filter: 'blur(0px)', transition: { duration: 0.3, ease: EASE_OUT } },
  leave: (dir: number) => ({ opacity: 0, transform: `translateX(${dir * -SLIDE}px)`, filter: 'blur(2px)', transition: { duration: 0.2, ease: EASE_OUT } }),
}

function StartSelling() {
  const { seller, profile, verification, claim } = Route.useLoaderData()
  const { user } = useLoaderData({ from: '__root__' })
  const search = Route.useSearch()
  const requested = search.step ?? 'role'
  const navigate = useNavigate({ from: Route.fullPath })
  const router = useRouter()
  const { draft, update, updateVerify, clear, ready } = useDraft(user?.id ?? 'guest', {
    kind: null,
    name: profile?.displayName ?? '',
    bio: '',
    phone: profile?.phone ?? '',
    town: profile?.town ?? '',
    province: (PROVINCES.includes(profile?.province as Province) ? profile?.province : '') as Draft['province'],
    photo: null,
    verify: emptyVerify(),
  })

  const kind = seller?.kind ?? draft.kind
  // Once the shop exists only verification and the share screen are left; before it, nothing past setup.
  // Any unverified shop can verify: a reader who turns out to have written a book becomes an author.
  const canVerify = !!seller && !seller.verified && verification?.latest?.status !== 'pending'
  const current: Step = seller ? (requested === 'verify' && canVerify ? 'verify' : 'done') : requested === 'setup' && kind ? 'setup' : 'role'
  const isAuthor = kind === 'author' || current === 'verify'
  const flow: Step[] = isAuthor ? ['role', 'setup', 'verify', 'done'] : ['role', 'setup', 'done']

  // Arriving from "Claim this page": start as that author, with their page already picked.
  const claimed = useRef(false)
  useEffect(() => {
    if (!ready || !claim || claimed.current) return
    claimed.current = true
    updateVerify({ authorId: claim.id })
    if (!seller) {
      update({ kind: 'author', name: claim.name })
      void navigate({ search: { step: 'setup', author: claim.id }, replace: true })
    }
  }, [ready, claim])

  const index = flow.indexOf(current)
  const previous = useRef(index)
  const direction = index >= previous.current ? 1 : -1
  useEffect(() => {
    previous.current = index
  }, [index])

  const go = (to: Step) => void navigate({ search: { step: to, author: search.author } })
  const finish = async (to: Step) => {
    if (to === 'done') clear()
    await router.invalidate()
    go(to)
  }

  const heading = {
    role: { title: ONBOARDING.roleTitle, line: ONBOARDING.roleLine },
    setup: kind ? { title: KIND_COPY[kind].setupTitle, line: KIND_COPY[kind].setupLine } : null,
    verify: { title: ONBOARDING.verifyTitle, line: ONBOARDING.verifyLine },
    done: kind ? { title: KIND_COPY[kind].doneTitle, line: null } : null,
  }[current]

  return (
    <div className="page max-w-2xl py-10 lg:py-14">
      <div className="mb-8 flex items-center gap-4">
        <span className="h-1 flex-1 overflow-hidden rounded-full bg-sunken" aria-hidden>
          <span
            className="block h-full origin-left rounded-full bg-accent transition-transform duration-[400ms] ease-[var(--ease-in-out)]"
            style={{ transform: `scaleX(${(index + 1) / flow.length})` }}
          />
        </span>
        <span className="text-xs text-subtle tabular-nums">
          Step {index + 1} of {flow.length}
        </span>
      </div>

      {!ready ? (
        <RowShapes count={4} cover={false} />
      ) : (
        <MotionConfig reducedMotion="user">
          <AnimatePresence mode="popLayout" initial={false} custom={direction}>
            <motion.div key={current} custom={direction} variants={step} initial="enter" animate="shown" exit="leave">
              {current === 'setup' && (
                <button type="button" onClick={() => go('role')} className="mb-4 inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
                  <ArrowLeftIcon className="size-4" aria-hidden />
                  {kind && KIND_COPY[kind].label}
                </button>
              )}
              {heading && (
                <header className="mb-8">
                  <h1 className="text-4xl sm:text-5xl">{heading.title}</h1>
                  {heading.line && <p className="mt-2 text-muted">{heading.line}</p>}
                </header>
              )}

              {current === 'role' && (
                <RoleStep
                  selected={draft.kind}
                  onPick={(k) => {
                    update({ kind: k })
                    go('setup')
                  }}
                />
              )}
              {current === 'setup' && kind && <SetupStep kind={kind} draft={draft} update={update} onSaved={() => finish(isAuthor ? 'verify' : 'done')} />}
              {current === 'verify' && seller && (
                <VerificationForm
                  storeName={seller.storeName}
                  include={claim?.id}
                  value={draft.verify}
                  onChange={updateVerify}
                  onSubmitted={() => void finish('done')}
                  aside={
                    <button type="button" className="btn btn-ghost" onClick={() => void finish('done')}>
                      {ONBOARDING.verifySkip}
                    </button>
                  }
                />
              )}
              {current === 'done' && seller && (
                <DoneStep
                  seller={seller}
                  verification={isAuthor && !seller.verified ? (verification?.latest?.status === 'pending' ? 'pending' : 'skipped') : null}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </MotionConfig>
      )}
    </div>
  )
}

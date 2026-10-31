import { useNavigate, useRouterState } from '@tanstack/react-router'
import { CheckIcon, PlusIcon } from '@heroicons/react/16/solid'
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline'
import { HeartIcon } from '@heroicons/react/24/solid'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getSavedKeys, saveOrFollow } from '#/functions/favourites.functions'
import { getEmailPrefs, saveEmailPref } from '#/functions/emails.functions'
import { ALERTS_COPY } from '#/data/emails'
import { SAVED_COPY } from '#/data/saved'
import { SAVE_KINDS, savedKey } from '#/schemas/favourites'
import type { SaveKind } from '#/schemas/favourites'
import { cn } from '#/lib/utils'

interface SavedContextValue {
  isSaved: (kind: SaveKind, slug: string) => boolean
  toggle: (kind: SaveKind, slug: string) => void
}

const SavedContext = createContext<SavedContextValue | null>(null)
// A heart or Follow tapped while signed out, done once the person is back from signing in.
const PENDING_KEY = 'kb_save_after_sign_in'
// Set once the alerts prompt has been answered either way, so it never asks twice.
const NUDGED_KEY = 'kb_alerts_nudged'

function parseKey(key: string): [SaveKind, string] | null {
  const at = key.indexOf(':')
  const kind = key.slice(0, at) as SaveKind
  return at > 0 && SAVE_KINDS.includes(kind) ? [kind, key.slice(at + 1)] : null
}

/** Saved books and follows. Pages may be publicly cached, so who saved what is fetched here, on the client. */
export function SavedProvider({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set())
  // One request at a time per thing, in tap order, so the last tap is the one that sticks.
  const queues = useRef(new Map<string, Promise<unknown>>())
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })
  const [nudge, setNudge] = useState<'ask' | 'done' | null>(null)
  const nudgeChecked = useRef(false)

  // After the first save or follow, offer alerts if they're off.
  const maybeNudge = useCallback(() => {
    if (nudgeChecked.current) return
    nudgeChecked.current = true
    try {
      if (localStorage.getItem(NUDGED_KEY)) return
    } catch {
      return
    }
    getEmailPrefs()
      .then((prefs) => !prefs.alerts && setNudge('ask'))
      .catch(() => {})
  }, [])

  const mark = useCallback((key: string, on: boolean) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (on) next.add(key)
      else next.delete(key)
      return next
    })
  }, [])

  const persist = useCallback(
    (kind: SaveKind, slug: string, on: boolean) => {
      const key = savedKey(kind, slug)
      const queued = (queues.current.get(key) ?? Promise.resolve()).then(() =>
        saveOrFollow({ data: { kind, slug, saved: on } })
          .then(() => on && maybeNudge())
          .catch(() => mark(key, !on)),
      )
      queues.current.set(key, queued)
    },
    [mark, maybeNudge],
  )

  useEffect(() => {
    if (!signedIn) return
    let pending: [SaveKind, string] | null = null
    try {
      pending = parseKey(sessionStorage.getItem(PENDING_KEY) ?? '')
      sessionStorage.removeItem(PENDING_KEY)
    } catch {
      // Storage blocked: the button just needs tapping again.
    }
    if (pending) {
      mark(savedKey(...pending), true)
      persist(...pending, true)
    }
    getSavedKeys()
      .then((keys) => setSaved((prev) => new Set([...keys, ...prev])))
      .catch(() => {})
  }, [signedIn, mark, persist])

  const value = useMemo<SavedContextValue>(
    () => ({
      isSaved: (kind, slug) => saved.has(savedKey(kind, slug)),
      toggle: (kind, slug) => {
        const key = savedKey(kind, slug)
        if (!signedIn) {
          try {
            sessionStorage.setItem(PENDING_KEY, key)
          } catch {
            // Storage blocked: they sign in and tap again.
          }
          void navigate({ to: '/login', search: { next: href } })
          return
        }
        // The button changes now; the database catches up, and a failure puts it back.
        const on = !saved.has(key)
        mark(key, on)
        persist(kind, slug, on)
      },
    }),
    [saved, signedIn, navigate, href, mark, persist],
  )

  const answer = (on: boolean) => {
    try {
      localStorage.setItem(NUDGED_KEY, '1')
    } catch {
      // Storage blocked: it may ask again next visit.
    }
    if (!on) return setNudge(null)
    setNudge('done')
    saveEmailPref({ data: { list: 'alerts', on: true } }).catch(() => setNudge('ask'))
  }

  return (
    <SavedContext.Provider value={value}>
      {children}
      {nudge && <AlertsNudge state={nudge} onAnswer={answer} onClose={() => setNudge(null)} />}
    </SavedContext.Provider>
  )
}

function AlertsNudge({ state, onAnswer, onClose }: { state: 'ask' | 'done'; onAnswer: (on: boolean) => void; onClose: () => void }) {
  useEffect(() => {
    if (state !== 'done') return
    const timer = setTimeout(onClose, 4000)
    return () => clearTimeout(timer)
  }, [state, onClose])
  return (
    <div role="status" className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-xl border border-line bg-surface p-4 shadow-lg sm:right-6 sm:left-auto sm:mx-0">
      {state === 'done' ? (
        <p className="text-sm">{ALERTS_COPY.nudgeDone}</p>
      ) : (
        <>
          <p className="text-sm">{ALERTS_COPY.nudge}</p>
          <div className="mt-3 flex gap-2">
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onAnswer(true)}>
              {ALERTS_COPY.nudgeOn}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onAnswer(false)}>
              {ALERTS_COPY.nudgeDismiss}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function useSaved() {
  const ctx = useContext(SavedContext)
  if (!ctx) throw new Error('useSaved must be used inside SavedProvider')
  return ctx
}

/** The heart: a round button on a cover's corner, or beside a book's title. */
export function SaveHeart({ slug, title, className }: { slug: string; title: string; className?: string }) {
  const { isSaved, toggle } = useSaved()
  const saved = isSaved('book', slug)
  const [popping, setPopping] = useState(false)
  const Icon = saved ? HeartIcon : HeartOutline
  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? SAVED_COPY.unsave(title) : SAVED_COPY.save(title)}
      title={saved ? SAVED_COPY.savedTitle : SAVED_COPY.saveTitle}
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        setPopping(!saved)
        toggle('book', slug)
      }}
      className={cn('heart grid cursor-pointer place-items-center rounded-full bg-surface/90 text-ink transition-colors hover:bg-surface', saved && 'text-accent', className)}
    >
      <Icon className={cn('size-[58%]', popping && 'heart-pop')} onAnimationEnd={() => setPopping(false)} aria-hidden />
    </button>
  )
}

/** Follow an author, shop or publisher: filled until followed, then quiet. */
export function FollowButton({ kind, slug, name }: { kind: Exclude<SaveKind, 'book'>; slug: string; name: string }) {
  const { isSaved, toggle } = useSaved()
  const following = isSaved(kind, slug)
  const Icon = following ? CheckIcon : PlusIcon
  return (
    <button
      type="button"
      aria-pressed={following}
      aria-label={following ? SAVED_COPY.unfollow(name) : undefined}
      onClick={() => toggle(kind, slug)}
      className={cn('btn btn-sm gap-1.5', following ? 'btn-secondary' : 'btn-primary')}
    >
      <Icon className="size-4" aria-hidden />
      {following ? SAVED_COPY.following : SAVED_COPY.follow}
    </button>
  )
}

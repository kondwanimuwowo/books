import { useNavigate, useRouterState } from '@tanstack/react-router'
import { HeartIcon as HeartOutline } from '@heroicons/react/24/outline'
import { HeartIcon } from '@heroicons/react/24/solid'
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { getSavedSlugs, saveBook } from '#/functions/favourites.functions'
import { SAVED_COPY } from '#/data/saved'
import { cn } from '#/lib/utils'

interface SavedContextValue {
  isSaved: (slug: string) => boolean
  toggle: (slug: string) => void
}

const SavedContext = createContext<SavedContextValue | null>(null)
// A heart tapped while signed out, saved once the person is back from signing in.
const PENDING_KEY = 'kb_save_after_sign_in'

/** Saved books for the hearts. Pages may be publicly cached, so who saved what is fetched here, on the client. */
export function SavedProvider({ signedIn, children }: { signedIn: boolean; children: ReactNode }) {
  const [saved, setSaved] = useState<ReadonlySet<string>>(new Set())
  // One request at a time per book, in tap order, so the last tap is the one that sticks.
  const queues = useRef(new Map<string, Promise<unknown>>())
  const navigate = useNavigate()
  const href = useRouterState({ select: (s) => s.location.href })

  const mark = useCallback((slug: string, on: boolean) => {
    setSaved((prev) => {
      const next = new Set(prev)
      if (on) next.add(slug)
      else next.delete(slug)
      return next
    })
  }, [])

  const persist = useCallback(
    (slug: string, on: boolean) => {
      const queued = (queues.current.get(slug) ?? Promise.resolve()).then(() =>
        saveBook({ data: { slug, saved: on } }).catch(() => mark(slug, !on)),
      )
      queues.current.set(slug, queued)
    },
    [mark],
  )

  useEffect(() => {
    if (!signedIn) return
    let pending: string | null = null
    try {
      pending = sessionStorage.getItem(PENDING_KEY)
      sessionStorage.removeItem(PENDING_KEY)
    } catch {
      // Storage blocked: the heart just needs tapping again.
    }
    if (pending) {
      mark(pending, true)
      persist(pending, true)
    }
    getSavedSlugs()
      .then((slugs) => setSaved((prev) => new Set([...slugs, ...prev])))
      .catch(() => {})
  }, [signedIn, mark, persist])

  const value = useMemo<SavedContextValue>(
    () => ({
      isSaved: (slug) => saved.has(slug),
      toggle: (slug) => {
        if (!signedIn) {
          try {
            sessionStorage.setItem(PENDING_KEY, slug)
          } catch {
            // Storage blocked: they sign in and tap again.
          }
          void navigate({ to: '/login', search: { next: href } })
          return
        }
        // The heart changes now; the database catches up, and a failure puts it back.
        const on = !saved.has(slug)
        mark(slug, on)
        persist(slug, on)
      },
    }),
    [saved, signedIn, navigate, href, mark, persist],
  )

  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>
}

export function useSaved() {
  const ctx = useContext(SavedContext)
  if (!ctx) throw new Error('useSaved must be used inside SavedProvider')
  return ctx
}

/** The heart: a round button on a cover's corner, or beside a book's title. */
export function SaveHeart({ slug, title, className }: { slug: string; title: string; className?: string }) {
  const { isSaved, toggle } = useSaved()
  const saved = isSaved(slug)
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
        toggle(slug)
      }}
      className={cn('heart grid cursor-pointer place-items-center rounded-full bg-surface/90 text-ink transition-colors hover:bg-surface', saved && 'text-accent', className)}
    >
      <Icon className={cn('size-[58%]', popping && 'heart-pop')} onAnimationEnd={() => setPopping(false)} aria-hidden />
    </button>
  )
}

import { useEffect, useState } from 'react'
import type { SellerKind } from '#/data/listing-options'
import type { Province } from '#/data/zambia'

export interface VerifyDraft {
  /** A catalogue author page; null for a new page; undefined until they choose. */
  authorId?: string | null
  legalName: string
  id: string | null
  selfie: string | null
  extra: string | null
}

export interface Draft {
  kind: SellerKind | null
  name: string
  bio: string
  phone: string
  town: string
  province: Province | ''
  photo: { key: string; url: string } | null
  verify: VerifyDraft
}

export const emptyVerify = (): VerifyDraft => ({ legalName: '', id: null, selfie: null, extra: null })

const key = (userId: string) => `kuwala:onboarding:${userId}`

function load(userId: string): Partial<Draft> | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key(userId)) ?? 'null')
    return parsed && typeof parsed === 'object' ? (parsed as Partial<Draft>) : null
  } catch {
    return null
  }
}

/** The half-filled form survives a reload or a trip back; uploads are kept as keys, never files. */
export function useDraft(userId: string, initial: Draft) {
  const [draft, setDraft] = useState(initial)
  // Read after mount so the server render and the first client render agree.
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const saved = load(userId)
    if (saved) setDraft((d) => ({ ...d, ...saved, verify: { ...d.verify, ...saved.verify } }))
    setReady(true)
  }, [userId])

  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(key(userId), JSON.stringify(draft))
    } catch {
      // Private mode or full storage: the form still works, it just won't be remembered.
    }
  }, [draft, ready, userId])

  const update = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }))
  const clear = () => {
    try {
      localStorage.removeItem(key(userId))
    } catch {
      // Nothing to clear.
    }
  }
  return { draft, update, clear, ready }
}

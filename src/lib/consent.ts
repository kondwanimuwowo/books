import { CONSENT_VERSION } from '#/data/cookies'
import type { CookieCategory } from '#/data/cookies'

// The visitor's cookie choices, kept in a first-party cookie so the server can read them too.
const COOKIE = 'kb_consent'
const MAX_AGE = 60 * 60 * 24 * 365
export const CONSENT_EVENT = 'kuwala:consent'

export interface Consent {
  version: string
  choices: Partial<Record<CookieCategory, boolean>>
  at: string
}

export function readConsent(): Consent | null {
  if (typeof document === 'undefined') return null
  try {
    const raw = document.cookie.split('; ').find((c) => c.startsWith(`${COOKIE}=`))
    if (!raw) return null
    const parsed = JSON.parse(decodeURIComponent(raw.slice(COOKIE.length + 1))) as Consent
    return parsed.version === CONSENT_VERSION ? parsed : null
  } catch {
    return null
  }
}

export function saveConsent(choices: Consent['choices']) {
  const consent: Consent = { version: CONSENT_VERSION, choices, at: new Date().toISOString() }
  document.cookie = `${COOKIE}=${encodeURIComponent(JSON.stringify(consent))}; Max-Age=${MAX_AGE}; Path=/; SameSite=Lax; Secure`
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT))
}

/** Gate for anything optional: load an analytics or marketing script only when this is true. Essential is always allowed. */
export function hasConsent(category: CookieCategory) {
  if (category === 'essential') return true
  return readConsent()?.choices[category] === true
}

/** Opens the banner again, e.g. from "Cookie settings" in the footer. */
export function openCookieSettings() {
  window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: 'open' }))
}

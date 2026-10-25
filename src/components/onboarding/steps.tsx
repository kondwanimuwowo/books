import { Link } from '@tanstack/react-router'
import { CheckIcon, LinkIcon } from '@heroicons/react/16/solid'
import { MotionConfig, motion } from 'motion/react'
import { useState } from 'react'
import { saveSellerProfile } from '#/functions/sell.functions'
import { KIND_COPY, KIND_ORDER, ONBOARDING } from '#/data/onboarding'
import type { SellerKind } from '#/data/listing-options'
import { SHARE_COPY, SITE_URL } from '#/data/share'
import { cn } from '#/lib/utils'
import { CoverUpload } from '../cover-upload'
import { Alert, Field, useAction } from '../form'
import { ShareOnWhatsApp } from '../share'
import { TownField } from '../town-field'
import type { Draft } from './draft'
import { PhotoFallback } from '../photo-fallback'

export function RoleStep({ selected, onPick }: { selected: SellerKind | null; onPick: (kind: SellerKind) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {KIND_ORDER.map((kind) => (
        <button
          key={kind}
          type="button"
          aria-pressed={selected === kind}
          onClick={() => onPick(kind)}
          className={cn(
            'rounded-xl p-5 text-left transition-[box-shadow,transform] duration-150 ease-out active:scale-[0.98]',
            selected === kind ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent-ink)]' : 'bg-surface shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
          )}
        >
          <span className="block text-lg font-bold">{KIND_COPY[kind].label}</span>
          <span className="mt-1 block text-sm text-muted">{KIND_COPY[kind].line}</span>
        </button>
      ))}
    </div>
  )
}

export function SetupStep({ kind, draft, update, onSaved }: { kind: SellerKind; draft: Draft; update: (patch: Partial<Draft>) => void; onSaved: () => Promise<void> }) {
  const copy = KIND_COPY[kind]
  const [uploading, setUploading] = useState(false)
  const save = useAction(async () => {
    if (copy.photoRequired && !draft.photo) throw new Error('Add a photo of yourself')
    if (!draft.province) throw new Error('Choose your town')
    await saveSellerProfile({
      data: { storeName: draft.name, kind, bio: draft.bio || undefined, phone: draft.phone, town: draft.town, province: draft.province, photoKey: draft.photo?.key },
    })
    await onSaved()
  })

  return (
    <form
      className="flex flex-col gap-8 sm:flex-row"
      onSubmit={(e) => {
        e.preventDefault()
        void save.run()
      }}
    >
      <div className="shrink-0">
        <CoverUpload
          shape={copy.photoShape}
          label={copy.photoLabel}
          current={draft.photo?.url ?? null}
          onBusy={setUploading}
          onChange={(p) => update({ photo: p && { key: p.key, url: p.url } })}
        />
        <p className="mt-2 max-w-32 text-xs text-subtle">{copy.photoRequired ? 'Required. A clear photo of your face.' : 'Optional. You can add one later.'}</p>
      </div>
      <div className="min-w-0 flex-1 space-y-5">
        <Field label={copy.nameLabel} hint={copy.nameHint}>
          <input className="input" required minLength={2} maxLength={60} value={draft.name} onChange={(e) => update({ name: e.target.value })} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Phone number" hint="For buyers’ deliveries. Never shown publicly.">
            <input className="input" type="tel" inputMode="tel" autoComplete="tel" required value={draft.phone} onChange={(e) => update({ phone: e.target.value })} placeholder="097 123 4567" />
          </Field>
          <TownField label="Town you send from" value={draft} onChange={(place) => update(place)} />
        </div>
        <Field label={copy.bioLabel}>
          <textarea
            className="input"
            rows={4}
            maxLength={600}
            required={kind === 'author'}
            placeholder={copy.bioPlaceholder}
            value={draft.bio}
            onChange={(e) => update({ bio: e.target.value })}
          />
        </Field>
        {save.error && <Alert>{save.error}</Alert>}
        <button type="submit" className="btn btn-primary" disabled={uploading || save.pending}>
          {uploading ? 'Uploading photo…' : save.pending ? 'Saving…' : 'Continue'}
        </button>
      </div>
    </form>
  )
}

interface DoneSeller {
  slug: string
  storeName: string
  kind: SellerKind
  photoUrl: string | null
}

const SETTLE = { type: 'spring', duration: 0.6, bounce: 0.15 } as const
const item = {
  hidden: { opacity: 0, transform: 'translateY(8px)' },
  shown: { opacity: 1, transform: 'translateY(0px)', transition: { duration: 0.4, ease: [0.23, 1, 0.32, 1] } },
} as const

/** The one celebratory screen in selling: their card, their link, and the way to share it. */
export function DoneStep({ seller, verification }: { seller: DoneSeller; verification: 'pending' | 'skipped' | null }) {
  const copy = KIND_COPY[seller.kind]
  const path = `/sellers/${seller.slug}`
  const [copied, setCopied] = useState(false)
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${SITE_URL}${path}`)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked; the link is on screen to copy by hand.
    }
  }

  return (
    <MotionConfig reducedMotion="user">
      <motion.div initial="hidden" animate="shown" transition={{ staggerChildren: 0.06, delayChildren: 0.15 }} className="space-y-8">
        <motion.div
          initial={{ opacity: 0, transform: 'scale(0.96)' }}
          animate={{ opacity: 1, transform: 'scale(1)' }}
          transition={SETTLE}
          className="card flex items-center gap-5 p-5 sm:p-6"
        >
          {seller.photoUrl ? (
            <img src={seller.photoUrl} alt="" className={cn('w-20 shrink-0 object-cover shadow-md', copy.photoShape === 'cover' ? 'aspect-[2/3] rounded-md' : 'aspect-square rounded-xl')} />
          ) : (
            <PhotoFallback
              kind={seller.kind === 'individual' || seller.kind === 'author' ? 'person' : 'shop'}
              className={cn('w-20', copy.photoShape === 'cover' ? 'aspect-[2/3] rounded-md' : 'aspect-square rounded-xl')}
            />
          )}
          <div className="min-w-0">
            <p className="eyebrow">{copy.label}</p>
            <p className="mt-1 truncate text-2xl font-bold">{seller.storeName}</p>
            <button type="button" onClick={() => void copyLink()} className="mt-1 inline-flex max-w-full items-center gap-1.5 text-sm text-muted hover:text-ink">
              {copied ? <CheckIcon className="size-4 shrink-0 text-success" aria-hidden /> : <LinkIcon className="size-4 shrink-0" aria-hidden />}
              <span className="truncate">{copied ? 'Link copied' : `kuwalabooks.com${path}`}</span>
            </button>
          </div>
        </motion.div>

        {verification && (
          <motion.p variants={item} className="rounded-lg bg-accent-soft px-4 py-3 text-sm text-accent-soft-ink">
            {verification === 'pending' ? (
              ONBOARDING.inReview
            ) : (
              <>
                Get verified any time from <Link to="/account/shop">your shop settings</Link>. Until then your page has no verified mark.
              </>
            )}
          </motion.p>
        )}

        <motion.div variants={item} className="space-y-3">
          <p className="text-muted">{ONBOARDING.shareLine}</p>
          <ShareOnWhatsApp path={path} text={SHARE_COPY.shop({ storeName: seller.storeName, inStock: 0 })} />
        </motion.div>

        <motion.div variants={item} className="flex flex-wrap gap-3">
          <Link to="/sell" className="btn btn-primary">
            {ONBOARDING.firstBook}
          </Link>
          <Link to="/sellers/$slug" params={{ slug: seller.slug }} className="btn btn-ghost">
            See it as buyers do
          </Link>
        </motion.div>
      </motion.div>
    </MotionConfig>
  )
}

import { useRouter } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { savePayoutDetails, saveSellerProfile } from '#/functions/sell.functions'
import { SELLER_KINDS } from '#/data/listing-options'
import type { SellerKind } from '#/data/listing-options'
import { PROVINCES } from '#/data/zambia'
import type { Province } from '#/data/zambia'
import { SHIPPING_METHODS, shippingLabel } from '#/data/shipping'
import type { ActiveShippingMethod, ShippingMethod } from '#/data/shipping'
import { getBookDescription, saveDeliverySettings } from '#/functions/sell.functions'
import { TownField } from './town-field'
import { CoverUpload } from './cover-upload'
import { KIND_COPY } from '#/data/onboarding'
import { detectOperator, OPERATOR_LABELS } from '#/lib/phone'
import type { Operator } from '#/lib/phone'
import { cn } from '#/lib/utils'
import { Alert, Field, useAction } from './form'

interface SellerDefaults {
  storeName: string
  kind: SellerKind
  bio: string | null
  phone: string | null
  town: string | null
  province: string | null
  photoUrl: string | null
}

export function SellerProfileForm({ defaults, submitLabel, onSaved, primary = true }: { defaults: SellerDefaults; submitLabel: string; onSaved?: () => void; primary?: boolean }) {
  const router = useRouter()
  const [form, setForm] = useState({
    storeName: defaults.storeName,
    kind: defaults.kind,
    bio: defaults.bio ?? '',
    phone: defaults.phone ?? '',
    town: defaults.town ?? '',
    province: (PROVINCES.includes(defaults.province as Province) ? defaults.province : '') as Province | '',
  })
  const [photo, setPhoto] = useState<{ key: string } | null>(null)
  const [uploading, setUploading] = useState(false)
  const [saved, setSaved] = useState(false)
  const action = useAction(async () => {
    if (!form.province) throw new Error('Choose your province')
    await saveSellerProfile({ data: { ...form, province: form.province, bio: form.bio || undefined, photoKey: photo?.key } })
    setSaved(true)
    await router.invalidate()
    onSaved?.()
  })
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setForm({ ...form, [key]: e.target.value })

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        void action.run()
      }}
    >
      {action.error && <Alert>{action.error}</Alert>}
      {saved && !onSaved && <Alert tone="success">Saved.</Alert>}
      <fieldset>
        <legend className="field-label">I am a</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SELLER_KINDS.map((k) => (
            <label
              key={k.value}
              className={cn(
                'cursor-pointer rounded-lg p-3 text-sm transition-shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink',
                form.kind === k.value ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
              )}
            >
              <input type="radio" className="sr-only" name="kind" checked={form.kind === k.value} onChange={() => setForm({ ...form, kind: k.value })} />
              <span className="block font-medium">{k.label}</span>
              <span className="block text-xs text-subtle">{k.note}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-col gap-5 sm:flex-row">
        <CoverUpload
          shape={KIND_COPY[form.kind].photoShape}
          label={KIND_COPY[form.kind].photoLabel}
          current={defaults.photoUrl}
          onBusy={setUploading}
          onChange={(p) => (setPhoto(p), setSaved(false))}
          className="shrink-0"
        />
        <Field label="Shop name" className="flex-1">
          <input className="input" required minLength={2} maxLength={60} value={form.storeName} onChange={set('storeName')} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Phone number">
          <input className="input" type="tel" inputMode="tel" required value={form.phone} onChange={set('phone')} placeholder="097 123 4567" />
        </Field>
        <TownField label="Town you ship from" value={form} onChange={(place) => setForm({ ...form, ...place })} />
      </div>
      <Field label="About (optional)">
        <textarea className="input" rows={3} maxLength={600} value={form.bio} onChange={set('bio')} />
      </Field>
      <button type="submit" className={cn('btn', primary ? 'btn-primary' : 'btn-secondary')} disabled={uploading || action.pending}>
        {uploading ? 'Uploading photo…' : action.pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}

export function PayoutForm({ current, primary = true }: { current: { phone: string | null; operator: Operator | null; accountName: string | null }; primary?: boolean }) {
  const router = useRouter()
  const [phone, setPhone] = useState(current.phone ?? '')
  const [operator, setOperator] = useState<Operator | null>(current.operator ?? detectOperator(current.phone ?? ''))
  const [saved, setSaved] = useState(current.accountName && current.phone ? { name: current.accountName, phone: current.phone, operator: current.operator } : null)
  const [editing, setEditing] = useState(!saved)
  const action = useAction(async () => {
    if (!operator) throw new Error('Choose your network')
    const result = await savePayoutDetails({ data: { phone, operator } })
    setSaved({ name: result.accountName, phone, operator })
    setEditing(false)
    await router.invalidate()
  })

  if (saved && !editing) {
    return (
      <div className="space-y-3">
        {/* The name the network has on file, so the seller can see the money goes to them. */}
        <div className="rise max-w-sm rounded-xl bg-deep p-5 text-on-accent shadow-md">
          <p className="eyebrow text-on-deep-muted">{saved.operator ? OPERATOR_LABELS[saved.operator] : 'Mobile money'}</p>
          <p className="mt-6 text-xl font-bold tracking-[-0.02em] uppercase">{saved.name}</p>
          <p className="mt-1 text-sm text-on-deep-muted tabular-nums">{saved.phone}</p>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditing(true)}>
          Change number
        </button>
      </div>
    )
  }

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void action.run()
      }}
    >
      {action.error && <Alert>{action.error}</Alert>}
      <Field label="Mobile money number" hint="We check who it is registered to.">
        <span className="relative block max-w-xs">
          <input
            className="input pr-20"
            type="tel"
            inputMode="tel"
            required
            value={phone}
            onChange={(e) => {
              setPhone(e.target.value)
              setOperator(detectOperator(e.target.value))
            }}
          />
          {operator && (
            <span className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent-soft-ink">{OPERATOR_LABELS[operator]}</span>
          )}
        </span>
      </Field>
      {!operator && phone.replace(/\D/g, '').length >= 3 && (
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Network">
          {(Object.keys(OPERATOR_LABELS) as Operator[]).map((op) => (
            <button key={op} type="button" role="radio" aria-checked={false} onClick={() => setOperator(op)} className="pill bg-sunken hover:bg-sunken-strong">
              {OPERATOR_LABELS[op]}
            </button>
          ))}
        </div>
      )}
      <div className="flex gap-2">
        <button type="submit" className={cn('btn', primary ? 'btn-primary' : 'btn-secondary')} disabled={action.pending || !operator}>
          {action.pending ? 'Checking…' : 'Save number'}
        </button>
        {saved && (
          <button type="button" className="btn btn-ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}

const METHOD_NOTES: Record<ActiveShippingMethod, string> = {
  yango: 'Bike delivery in Lusaka, Kitwe, Ndola and Livingstone',
  platinum: 'You drop it at Platinum; reaches all of Zambia',
  mercury: 'Premium courier, in town and between towns',
  bus_parcel: 'You drop it at the bus station',
  collect: 'Buyers in your town meet you',
}

export function DeliveryForm({ current }: { current: { deliveryMethods: ShippingMethod[]; freeDeliveryOverNgwee: number | null } }) {
  const router = useRouter()
  const [methods, setMethods] = useState<ActiveShippingMethod[]>(current.deliveryMethods.filter((m): m is ActiveShippingMethod => (SHIPPING_METHODS as readonly ShippingMethod[]).includes(m)))
  const [free, setFree] = useState(current.freeDeliveryOverNgwee !== null)
  const [over, setOver] = useState(current.freeDeliveryOverNgwee !== null ? String(current.freeDeliveryOverNgwee / 100) : '300')
  const [saved, setSaved] = useState(false)
  const action = useAction(async () => {
    await saveDeliverySettings({ data: { methods, freeOverKwacha: free ? Number(over) : null } })
    setSaved(true)
    await router.invalidate()
  })
  const toggle = (m: ActiveShippingMethod) => {
    setSaved(false)
    setMethods(methods.includes(m) ? methods.filter((x) => x !== m) : [...methods, m])
  }

  return (
    <form
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault()
        void action.run()
      }}
    >
      {action.error && <Alert>{action.error}</Alert>}
      {saved && <Alert tone="success">Saved.</Alert>}
      <fieldset>
        <legend className="field-label">How you send books</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {SHIPPING_METHODS.map((m) => (
            <label
              key={m}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-lg p-3 text-sm transition-shadow has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink',
                methods.includes(m) ? 'bg-accent-soft shadow-[inset_0_0_0_1.5px_var(--color-accent-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
              )}
            >
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--color-accent)]" checked={methods.includes(m)} onChange={() => toggle(m)} />
              <span>
                <span className="block font-medium">{shippingLabel(m)}</span>
                <span className="block text-xs text-subtle">{METHOD_NOTES[m]}</span>
              </span>
            </label>
          ))}
        </div>
        <p className="mt-2 text-xs text-subtle">Delivery prices are set by Kuwala, so buyers see the same fee from every shop.</p>
      </fieldset>
      <div className="space-y-3">
        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={free} onChange={(e) => (setFree(e.target.checked), setSaved(false))} />
          Free delivery on bigger orders
        </label>
        {free && (
          <Field label="When the books come to (K)" hint="Use 0 to always deliver free. You cover the fee.">
            <input className="input max-w-40" type="number" inputMode="decimal" min={0} step={10} required value={over} onChange={(e) => (setOver(e.target.value), setSaved(false))} />
          </Field>
        )}
      </div>
      <button type="submit" className="btn btn-secondary" disabled={action.pending || !methods.length}>
        {action.pending ? 'Saving…' : 'Save delivery'}
      </button>
    </form>
  )
}

export interface OfferSettingsValue {
  open: boolean
  floor: string
}

export function OfferSettings({ value, onChange }: { value: OfferSettingsValue; onChange: (value: OfferSettingsValue) => void }) {
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-3 text-sm font-medium">
        <input type="checkbox" className="size-4 accent-[var(--color-accent)]" checked={value.open} onChange={(e) => onChange({ ...value, open: e.target.checked })} />
        Open to offers
      </label>
      {value.open && (
        <Field label="Lowest you’ll take (optional)" hint="Buyers never see this. Offers below it are declined for you.">
          <div className="relative max-w-40">
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-subtle">K</span>
            <input className="input pl-7 tabular-nums" type="number" inputMode="decimal" min={5} step="0.5" value={value.floor} onChange={(e) => onChange({ ...value, floor: e.target.value })} />
          </div>
        </Field>
      )}
    </div>
  )
}

export function offerSettingsData(value: OfferSettingsValue) {
  return { acceptsOffers: value.open, offerFloorKwacha: value.open && value.floor ? Number(value.floor) : null }
}

/**
 * For a book saved without a description: looks one up online, and lets the seller edit it or write one.
 * The server only ever fills an empty description with this.
 */
export function MissingDescription({ isbn, value, onChange }: { isbn: string | null; value: string; onChange: (value: string) => void }) {
  // A description read from the seller's back-cover photo is already the book's own; no need to look online.
  const [fromPhoto] = useState(value !== '')
  const [state, setState] = useState<'looking' | 'found' | 'none'>(isbn && !fromPhoto ? 'looking' : 'none')
  useEffect(() => {
    if (!isbn || fromPhoto) return
    let cancelled = false
    getBookDescription({ data: { isbn } })
      .then(({ description }) => {
        if (cancelled) return
        if (description) onChange(description)
        setState(description ? 'found' : 'none')
      })
      .catch(() => !cancelled && setState('none'))
    return () => {
      cancelled = true
    }
    // Looked up once per book; onChange is a state setter.
  }, [isbn])

  if (state === 'looking') return <p className="text-sm text-subtle">Looking for a description…</p>
  return (
    <Field
      label="Description"
      hint={
        fromPhoto ? 'Read from your back cover. Check it matches.' : state === 'found' ? 'Found online. Shown on the book’s page; edit it if needed.' : 'This book has none yet. Yours will show on its page.'
      }
    >
      <textarea className="input" rows={5} maxLength={8000} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  )
}

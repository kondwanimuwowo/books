import { useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { savePayoutDetails, saveSellerProfile } from '#/functions/sell.functions'
import { SELLER_KINDS } from '#/data/listing-options'
import type { SellerKind } from '#/data/listing-options'
import { MAJOR_TOWNS, PROVINCES } from '#/data/zambia'
import type { Province } from '#/data/zambia'
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
}

export function SellerProfileForm({ defaults, submitLabel, onSaved }: { defaults: SellerDefaults; submitLabel: string; onSaved?: () => void }) {
  const router = useRouter()
  const [form, setForm] = useState({
    storeName: defaults.storeName,
    kind: defaults.kind,
    bio: defaults.bio ?? '',
    phone: defaults.phone ?? '',
    town: defaults.town ?? '',
    province: (PROVINCES.includes(defaults.province as Province) ? defaults.province : '') as Province | '',
  })
  const [saved, setSaved] = useState(false)
  const action = useAction(async () => {
    if (!form.province) throw new Error('Choose your province')
    await saveSellerProfile({ data: { ...form, province: form.province, bio: form.bio || undefined } })
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
      {saved && !onSaved && <Alert tone="success">Shop details saved.</Alert>}
      <fieldset>
        <legend className="field-label">I am a</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SELLER_KINDS.map((k) => (
            <label key={k.value} className={cn('cursor-pointer rounded-lg border p-3 text-sm transition-colors', form.kind === k.value ? 'border-accent-700 bg-accent-100' : 'border-neutral-300 hover:border-neutral-400')}>
              <input type="radio" className="sr-only" name="kind" checked={form.kind === k.value} onChange={() => setForm({ ...form, kind: k.value })} />
              <span className="block font-medium">{k.label}</span>
              <span className="block text-xs text-neutral-600">{k.note}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <Field label="Shop name" hint="Shown to buyers next to every book you sell">
        <input className="input" required minLength={2} maxLength={60} value={form.storeName} onChange={set('storeName')} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Phone number">
          <input className="input" type="tel" inputMode="tel" required value={form.phone} onChange={set('phone')} placeholder="097 123 4567" />
        </Field>
        <Field label="Province">
          <select className="input" required value={form.province} onChange={set('province')}>
            <option value="">Choose&hellip;</option>
            {PROVINCES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </Field>
        <Field label="Town you ship from">
          <input className="input" list="seller-towns" required value={form.town} onChange={set('town')} />
          <datalist id="seller-towns">
            {(form.province ? MAJOR_TOWNS[form.province] : Object.values(MAJOR_TOWNS).flat()).map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </Field>
      </div>
      <Field label="About your shop (optional)">
        <textarea className="input" rows={3} maxLength={600} value={form.bio} onChange={set('bio')} />
      </Field>
      <button type="submit" className="btn btn-primary" disabled={action.pending}>
        {action.pending ? 'Saving…' : submitLabel}
      </button>
    </form>
  )
}

export function PayoutForm({ current }: { current: { phone: string | null; operator: Operator | null; accountName: string | null } }) {
  const router = useRouter()
  const [phone, setPhone] = useState(current.phone ?? '')
  const [operator, setOperator] = useState<Operator | null>(current.operator)
  const [accountName, setAccountName] = useState(current.accountName)
  const action = useAction(async () => {
    if (!operator) throw new Error('Choose your network')
    const result = await savePayoutDetails({ data: { phone, operator } })
    setAccountName(result.accountName)
    await router.invalidate()
  })

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        void action.run()
      }}
    >
      {accountName && (
        <Alert tone="success">
          Payouts go to <strong>{accountName}</strong> ({current.phone ?? phone}).
        </Alert>
      )}
      {action.error && <Alert>{action.error}</Alert>}
      <Field label="Mobile money number" hint="We check the registered name before saving">
        <input
          className="input max-w-xs"
          type="tel"
          inputMode="tel"
          required
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value)
            const detected = detectOperator(e.target.value)
            if (detected) setOperator(detected)
          }}
        />
      </Field>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(OPERATOR_LABELS) as Operator[]).map((op) => (
          <button key={op} type="button" onClick={() => setOperator(op)} aria-pressed={operator === op} className={cn('pill', operator === op ? 'bg-accent-700 text-white' : 'bg-neutral-100 hover:bg-neutral-200')}>
            {OPERATOR_LABELS[op]}
          </button>
        ))}
      </div>
      <button type="submit" className="btn btn-primary" disabled={action.pending}>
        {action.pending ? 'Checking…' : 'Save payout number'}
      </button>
    </form>
  )
}

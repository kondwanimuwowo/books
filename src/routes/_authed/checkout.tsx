import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getCheckoutDefaults, placeOrder } from '#/functions/orders.functions'
import { CheckoutSteps } from '#/components/checkout-steps'
import { Alert, Field, useAction } from '#/components/form'
import { Price, useBag, useCurrency } from '#/components/providers'
import { useBagQuote } from '#/components/use-bag-quote'
import { PROVINCES } from '#/data/zambia'
import type { Province } from '#/data/zambia'
import { etaLabel } from '#/data/shipping'
import type { ActiveShippingMethod, ShippingOption } from '#/data/shipping'
import { TownField } from '#/components/town-field'
import { ShieldCheckIcon } from '@heroicons/react/20/solid'
import { SAFETY } from '#/data/safety'

export const Route = createFileRoute('/_authed/checkout')({
  loader: () => getCheckoutDefaults(),
  head: () => ({ meta: [{ title: 'Checkout | Kuwala Books' }] }),
  component: Checkout,
})

function isProvince(value: string | null): value is Province {
  return PROVINCES.includes(value as Province)
}



/** One dropdown per parcel: courier, price and days on each line, the chosen one explained underneath. */
function DeliveryChoice({ options, value, onChange }: { options: ShippingOption[]; value: ActiveShippingMethod | undefined; onChange: (method: ActiveShippingMethod) => void }) {
  const { format } = useCurrency()
  const chosen = options.find((o) => o.method === value)
  if (!options.length) return <p className="mt-2 text-sm text-danger">This shop doesn’t deliver to your town yet.</p>
  return (
    <div className="mt-2">
      <select className="input" aria-label="Delivery" value={value ?? ''} onChange={(e) => onChange(e.target.value as ActiveShippingMethod)}>
        {options.map((o) => (
          <option key={o.method} value={o.method}>
            {`${o.label} · ${o.totalNgwee ? format(o.totalNgwee) : 'Free'} · ${etaLabel(o.etaDays)}`}
          </option>
        ))}
      </select>
      {chosen && <p className="mt-2 text-sm text-muted">{chosen.description}</p>}
    </div>
  )
}

function Checkout() {
  const defaults = Route.useLoaderData()
  const navigate = useNavigate()
  const { lines, clear } = useBag()
  const [form, setForm] = useState({
    name: defaults.name,
    phone: defaults.phone ?? '',
    address: '',
    town: defaults.town ?? '',
    province: isProvince(defaults.province) ? defaults.province : ('' as const),
  })
  const [methods, setMethods] = useState<Record<string, ActiveShippingMethod>>({})

  // Only re-quote once the destination is complete.
  const destination = form.town.trim().length >= 2 && form.province ? { town: form.town.trim(), province: form.province } : null
  const quote = useBagQuote(destination)

  // Default each seller to their first (cheapest-to-arrange) option when options change.
  useEffect(() => {
    if (!quote) return
    setMethods((prev) => {
      const next: Record<string, ActiveShippingMethod> = {}
      for (const g of quote.groups) {
        const keep = g.options.find((o) => o.method === prev[g.seller.id])
        if (g.options.length) next[g.seller.id] = keep ? keep.method : g.options[0].method
      }
      return next
    })
  }, [quote])

  const action = useAction(async () => {
    if (!form.province) throw new Error('Choose your province')
    const { number } = await placeOrder({ data: { lines, shipTo: { ...form, province: form.province }, methods } })
    clear()
    await navigate({ to: '/orders/$number', params: { number } })
  })

  if (quote && !quote.groups.length) {
    return (
      <div className="page rise py-24 text-center">
        <h1 className="text-3xl">Your bag is empty</h1>
        <Link to="/search" className="btn btn-primary mt-8">
          Find a book
        </Link>
      </div>
    )
  }

  const groups = quote?.groups ?? []
  const subtotal = groups.reduce((n, g) => n + g.subtotalNgwee, 0)
  const shipping = groups.reduce((n, g) => n + (g.options.find((o) => o.method === methods[g.seller.id])?.totalNgwee ?? 0), 0)
  const ready = !!destination && groups.length > 0 && groups.every((g) => methods[g.seller.id])
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value })
  const step = destination ? 1 : 0

  const submit = (
    <button type="submit" className="btn btn-primary w-full" disabled={!ready || action.pending}>
      {action.pending ? 'Placing order…' : 'Continue to payment'}
    </button>
  )

  return (
    <form
      className="page py-8 pb-32 lg:pb-8"
      onSubmit={(e) => {
        e.preventDefault()
        void action.run()
      }}
    >
      <CheckoutSteps current={step} />

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_340px] lg:gap-10">
        <div className="min-w-0 space-y-6">
          <section className="card p-5 sm:p-6" aria-labelledby="address-heading">
            <h2 id="address-heading" className="text-xl">
              Where to?
            </h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Field label="Full name">
                <input className="input" autoComplete="name" required value={form.name} onChange={set('name')} />
              </Field>
              <Field label="Phone" hint="For the courier">
                <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="097 123 4567" required value={form.phone} onChange={set('phone')} />
              </Field>
              <TownField label="Town" value={form} onChange={(place) => setForm({ ...form, ...place })} />
              <Field label="Address or landmark" className="sm:col-span-2">
                <input className="input" autoComplete="street-address" placeholder="Plot 12, near the market" required value={form.address} onChange={set('address')} />
              </Field>
            </div>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="delivery-heading">
            <h2 id="delivery-heading" className="text-xl">
              Delivery
            </h2>
            {!destination ? (
              <p className="mt-2 text-sm text-subtle">Add your town to see options.</p>
            ) : (
              <div className="rise mt-5 space-y-6">
                {quote?.problems.length ? <Alert>{quote.problems.join('. ')}.</Alert> : null}
                {groups.map((g, i) => (
                  <fieldset key={g.seller.id}>
                    <legend className="text-sm">
                      {groups.length > 1 && <span className="eyebrow mr-2">{`Parcel ${i + 1}`}</span>}
                      <span className="font-medium">{g.seller.storeName}</span>
                      <span className="text-subtle"> · from {g.seller.town}</span>
                    </legend>
                    <DeliveryChoice options={g.options} value={methods[g.seller.id]} onChange={(method) => setMethods({ ...methods, [g.seller.id]: method })} />
                  </fieldset>
                ))}
                <p className="flex gap-2 text-sm text-muted">
                  <ShieldCheckIcon className="mt-0.5 size-4 shrink-0 text-success" aria-hidden />
                  {SAFETY.checkout}
                </p>
              </div>
            )}
          </section>
        </div>

        <aside className="hidden lg:block">
          <div className="card sticky top-28 space-y-3 p-5">
            <Totals subtotal={subtotal} shipping={destination ? shipping : null} />
            {action.error && <Alert>{action.error}</Alert>}
            {submit}
          </div>
        </aside>
      </div>

      <div className="glass-bar fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] lg:hidden">
        <div className="page space-y-2 py-3">
          {action.error && <Alert>{action.error}</Alert>}
          <div className="flex items-center justify-between gap-4">
            <div>
              <Price ngwee={subtotal + shipping} className="text-lg font-bold tracking-[-0.02em] tabular-nums" />
              <p className="text-xs text-subtle">{destination ? 'Including delivery' : 'Plus delivery'}</p>
            </div>
            <div className="w-48">{submit}</div>
          </div>
        </div>
      </div>
    </form>
  )
}

function Totals({ subtotal, shipping }: { subtotal: number; shipping: number | null }) {
  return (
    <>
      <div className="flex justify-between text-sm">
        <span className="text-muted">Books</span>
        <Price ngwee={subtotal} className="tabular-nums" />
      </div>
      <div className="flex justify-between text-sm">
        <span className="text-muted">Delivery</span>
        {shipping === null ? <span className="text-subtle">&ndash;</span> : <Price ngwee={shipping} className="tabular-nums" />}
      </div>
      <div className="flex items-baseline justify-between border-t border-line pt-3">
        <span className="font-medium">Total</span>
        <Price ngwee={subtotal + (shipping ?? 0)} className="text-xl font-bold tracking-[-0.02em] tabular-nums" />
      </div>
    </>
  )
}

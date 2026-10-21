import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { getCheckoutDefaults, placeOrder } from '#/functions/orders.functions'
import { Alert, Field, useAction } from '#/components/form'
import { Price, useBag } from '#/components/providers'
import { useBagQuote } from '#/components/use-bag-quote'
import { MAJOR_TOWNS, PROVINCES } from '#/data/zambia'
import type { Province } from '#/data/zambia'
import type { ShippingMethod } from '#/data/shipping'
import { cn } from '#/lib/utils'

export const Route = createFileRoute('/_authed/checkout')({
  loader: () => getCheckoutDefaults(),
  head: () => ({ meta: [{ title: 'Checkout | Kuwala Books' }] }),
  component: Checkout,
})

function isProvince(value: string | null): value is Province {
  return PROVINCES.includes(value as Province)
}

function etaLabel([min, max]: [number, number]) {
  if (max === 0) return 'Today'
  return min === max ? `${max} days` : `${Math.max(min, 1)}–${max} days`
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
  const [methods, setMethods] = useState<Record<string, ShippingMethod>>({})

  // Only re-quote once the destination is complete.
  const destination = form.town.trim().length >= 2 && form.province ? { town: form.town.trim(), province: form.province } : null
  const quote = useBagQuote(destination)

  // Default each seller to their first (cheapest-to-arrange) option when options change.
  useEffect(() => {
    if (!quote) return
    setMethods((prev) => {
      const next: Record<string, ShippingMethod> = {}
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
      <div className="page py-24 text-center">
        <h1 className="text-2xl">Your bag is empty</h1>
        <Link to="/search" className="btn btn-primary mt-6">
          Browse books
        </Link>
      </div>
    )
  }

  const groups = quote?.groups ?? []
  const subtotal = groups.reduce((n, g) => n + g.subtotalNgwee, 0)
  const shipping = groups.reduce((n, g) => n + (g.options.find((o) => o.method === methods[g.seller.id])?.totalNgwee ?? 0), 0)
  const ready = destination && groups.length > 0 && groups.every((g) => methods[g.seller.id])
  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm({ ...form, [key]: e.target.value })
  const towns = isProvince(form.province) ? MAJOR_TOWNS[form.province] : Object.values(MAJOR_TOWNS).flat()

  return (
    <form
      className="page grid gap-8 py-8 lg:grid-cols-[1fr_360px]"
      onSubmit={(e) => {
        e.preventDefault()
        void action.run()
      }}
    >
      <div className="space-y-8">
        <h1 className="text-3xl">Checkout</h1>

        <section className="card p-5">
          <h2 className="text-lg">Where should we send it?</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input className="input" autoComplete="name" required value={form.name} onChange={set('name')} />
            </Field>
            <Field label="Phone number" hint="Sellers and couriers will call this number">
              <input className="input" type="tel" inputMode="tel" autoComplete="tel" placeholder="097 123 4567" required value={form.phone} onChange={set('phone')} />
            </Field>
            <Field label="Province">
              <select className="input" required value={form.province} onChange={set('province')}>
                <option value="">Choose&hellip;</option>
                {PROVINCES.map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
            <Field label="Town">
              <input className="input" list="towns" autoComplete="address-level2" required value={form.town} onChange={set('town')} />
              <datalist id="towns">
                {towns.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </Field>
            <Field label="Address or landmark" className="sm:col-span-2" hint="Area, street, house number, or a landmark the courier can find">
              <input className="input" autoComplete="street-address" required value={form.address} onChange={set('address')} />
            </Field>
          </div>
        </section>

        <section className="card p-5">
          <h2 className="text-lg">Delivery</h2>
          {!destination ? (
            <p className="mt-2 text-sm text-neutral-700">Enter your town and province to see delivery options.</p>
          ) : (
            <div className="mt-4 space-y-6">
              {quote?.problems.length ? <Alert>{quote.problems.join('. ')}.</Alert> : null}
              {groups.map((g) => (
                <div key={g.seller.id}>
                  <p className="text-sm">
                    <span className="font-semibold">{g.seller.storeName}</span>
                    <span className="text-neutral-600">
                      {' '}
                      · {g.itemCount} {g.itemCount === 1 ? 'book' : 'books'} from {g.seller.town}
                    </span>
                  </p>
                  <div className="mt-2 grid gap-2 sm:grid-cols-2">
                    {g.options.map((o) => {
                      const selected = methods[g.seller.id] === o.method
                      return (
                        <label
                          key={o.method}
                          className={cn('flex cursor-pointer gap-3 rounded-lg border p-3 transition-colors', selected ? 'border-accent-700 bg-accent-100' : 'border-neutral-300 hover:border-neutral-400')}
                        >
                          <input type="radio" className="mt-1 accent-accent-700" name={`ship-${g.seller.id}`} checked={selected} onChange={() => setMethods({ ...methods, [g.seller.id]: o.method })} />
                          <span className="min-w-0 flex-1">
                            <span className="flex justify-between gap-2 font-medium">
                              {o.label}
                              {o.totalNgwee ? <Price ngwee={o.totalNgwee} /> : <span>Free</span>}
                            </span>
                            <span className="block text-sm text-neutral-700">{o.description}</span>
                            <span className="block text-xs text-neutral-600">{etaLabel(o.etaDays)}</span>
                          </span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <aside className="lg:pt-14">
        <div className="card sticky top-28 space-y-3 p-5">
          <h2 className="text-lg">Order summary</h2>
          <div className="flex justify-between text-sm">
            <span>Items</span>
            <Price ngwee={subtotal} className="tabular-nums" />
          </div>
          <div className="flex justify-between text-sm">
            <span>Delivery</span>
            {destination ? <Price ngwee={shipping} className="tabular-nums" /> : <span className="text-neutral-600">&ndash;</span>}
          </div>
          <div className="flex justify-between border-t border-neutral-200 pt-3 font-semibold">
            <span>Total</span>
            <Price ngwee={subtotal + shipping} className="tabular-nums" />
          </div>
          {action.error && <Alert>{action.error}</Alert>}
          <button type="submit" className="btn btn-primary w-full" disabled={!ready || action.pending}>
            {action.pending ? 'Placing order…' : 'Continue to payment'}
          </button>
          <p className="text-xs text-neutral-600">You&rsquo;ll pay with mobile money or card on the next step. You&rsquo;re charged in kwacha.</p>
        </div>
      </aside>
    </form>
  )
}

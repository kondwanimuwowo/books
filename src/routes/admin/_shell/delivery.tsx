import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { listDeliveryRates, saveDeliveryRate } from '#/functions/admin.functions'
import { Empty, PageHeader } from '#/components/admin'
import { Alert, useAction } from '#/components/form'
import { Placeholder, RowShapes } from '#/components/placeholder'
import { BAND_LABELS, DELIVERY_BANDS, SHIPPING_METHODS, shippingLabel } from '#/data/shipping'
import type { ActiveShippingMethod, DeliveryRate } from '#/data/shipping'
import { YANGO_TOWNS } from '#/data/zambia'

export const Route = createFileRoute('/admin/_shell/delivery')({
  pendingComponent: () => <Placeholder mode="loading" label="Loading delivery prices" shapes={<RowShapes cover={false} />} />,
  loader: () => listDeliveryRates(),
  component: Delivery,
})

function Delivery() {
  const rates = Route.useLoaderData()
  return (
    <div className="space-y-8">
      <PageHeader
        title="Delivery"
        description={`Prices buyers pay, by how far the parcel travels. Sellers can switch methods off or deliver free, never charge more. Yango runs only within ${YANGO_TOWNS.join(', ')}.`}
      />
      {rates.length ? (
        DELIVERY_BANDS.map((band) => {
          const rows = rates
            .filter((r): r is DeliveryRate & { method: ActiveShippingMethod } => r.band === band && (SHIPPING_METHODS as readonly string[]).includes(r.method))
            .sort((a, b) => SHIPPING_METHODS.indexOf(a.method) - SHIPPING_METHODS.indexOf(b.method))
          return (
            rows.length > 0 && (
              <section key={band} aria-labelledby={`band-${band}`}>
                <h2 id={`band-${band}`} className="mb-3 text-lg">
                  {BAND_LABELS[band]}
                </h2>
                <ul className="space-y-3">
                  {rows.map((r) => (
                    <RateRow key={r.method} rate={r} />
                  ))}
                </ul>
              </section>
            )
          )
        })
      ) : (
        <Empty>No delivery prices. Run the latest migration.</Empty>
      )}
    </div>
  )
}

function RateRow({ rate }: { rate: DeliveryRate & { method: ActiveShippingMethod } }) {
  const router = useRouter()
  const initial = {
    fee: String(rate.feeNgwee / 100),
    extra: String(rate.extraItemNgwee / 100),
    min: String(rate.etaMinDays),
    max: String(rate.etaMaxDays),
  }
  const [form, setForm] = useState(initial)
  const dirty = JSON.stringify(form) !== JSON.stringify(initial)
  const save = useAction(async () => {
    await saveDeliveryRate({
      data: {
        method: rate.method,
        band: rate.band,
        feeKwacha: Number(form.fee),
        extraItemKwacha: Number(form.extra),
        etaMinDays: Number(form.min),
        etaMaxDays: Number(form.max),
      },
    })
    await router.invalidate()
  })
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value })
  const input = 'input mt-1 h-9 w-24 tabular-nums'

  return (
    <li className="card p-4">
      <form
        className="flex flex-wrap items-end gap-x-4 gap-y-3"
        onSubmit={(e) => {
          e.preventDefault()
          void save.run()
        }}
      >
        <p className="w-full font-medium sm:w-40 sm:self-center">{shippingLabel(rate.method)}</p>
        <label className="text-xs text-subtle">
          Fee (K)
          <input className={input} type="number" min={0} step="0.5" required value={form.fee} onChange={set('fee')} />
        </label>
        <label className="text-xs text-subtle">
          Each extra book (K)
          <input className={input} type="number" min={0} step="0.5" required value={form.extra} onChange={set('extra')} />
        </label>
        <label className="text-xs text-subtle">
          Days, from
          <input className={input} type="number" min={0} max={60} required value={form.min} onChange={set('min')} />
        </label>
        <label className="text-xs text-subtle">
          to
          <input className={input} type="number" min={0} max={60} required value={form.max} onChange={set('max')} />
        </label>
        <button type="submit" className="btn btn-primary btn-sm" disabled={!dirty || save.pending}>
          {save.pending ? 'Saving…' : 'Save'}
        </button>
      </form>
      {save.error && (
        <div className="mt-3">
          <Alert>{save.error}</Alert>
        </div>
      )}
    </li>
  )
}

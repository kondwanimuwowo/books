import { useState } from 'react'
import { PROVINCES, TOWNS, listedTown } from '#/data/zambia'
import type { Province } from '#/data/zambia'
import { Field } from './form'

export interface Place {
  town: string
  province: Province | ''
}

const OTHER = 'other'

/** One pick sets both town and province; towns not on the list fall back to typing the town and choosing a province. */
export function TownField({ label, value, onChange }: { label: string; value: Place; onChange: (place: Place) => void }) {
  const listed = value.province ? listedTown(value.town, value.province) : null
  const [other, setOther] = useState(!!value.town && !listed)
  const selected = other ? OTHER : listed ? `${value.province}|${listed}` : ''

  return (
    <>
      <Field label={label}>
        <select
          className="input"
          required
          autoComplete="address-level2"
          value={selected}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setOther(true)
              onChange({ town: '', province: value.province })
              return
            }
            setOther(false)
            const [province, town] = e.target.value.split('|') as [Province, string]
            onChange({ town, province })
          }}
        >
          <option value="">Choose</option>
          {PROVINCES.map((p) => (
            <optgroup key={p} label={p}>
              {TOWNS[p].map((t) => (
                <option key={t} value={`${p}|${t}`}>
                  {t}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={OTHER}>Another town</option>
        </select>
      </Field>
      {other && (
        <>
          <Field label="Town name">
            <input className="input" required minLength={2} maxLength={60} value={value.town} onChange={(e) => onChange({ ...value, town: e.target.value })} />
          </Field>
          <Field label="Province">
            <select className="input" required value={value.province} onChange={(e) => onChange({ ...value, province: e.target.value as Province })}>
              <option value="">Choose</option>
              {PROVINCES.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </Field>
        </>
      )}
    </>
  )
}

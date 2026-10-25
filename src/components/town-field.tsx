import { useState } from 'react'
import { PROVINCES, TOWNS, listedTown } from '#/data/zambia'
import type { Province } from '#/data/zambia'
import { Field } from './form'
import { Select } from './select'

export interface Place {
  town: string
  province: Province | ''
}

const OTHER = 'other'

const TOWN_GROUPS = [
  ...PROVINCES.map((p) => ({ label: p, options: TOWNS[p].map((t) => ({ value: `${p}|${t}`, label: t })) })),
  { label: '', options: [{ value: OTHER, label: 'Another town' }] },
]
const PROVINCE_OPTIONS = PROVINCES.map((p) => ({ value: p, label: p }))

/** One pick sets both town and province; towns not on the list fall back to typing the town and choosing a province. */
export function TownField({ label, value, onChange }: { label: string; value: Place; onChange: (place: Place) => void }) {
  const listed = value.province ? listedTown(value.town, value.province) : null
  const [other, setOther] = useState(!!value.town && !listed)
  const selected = other ? OTHER : listed ? `${value.province}|${listed}` : ''

  return (
    <>
      <Field label={label}>
        <Select
          required
          value={selected}
          groups={TOWN_GROUPS}
          onChange={(picked) => {
            if (picked === OTHER) {
              setOther(true)
              onChange({ town: '', province: value.province })
              return
            }
            setOther(false)
            const [province, town] = picked.split('|') as [Province, string]
            onChange({ town, province })
          }}
        />
      </Field>
      {other && (
        <>
          <Field label="Town name">
            <input className="input" required minLength={2} maxLength={60} value={value.town} onChange={(e) => onChange({ ...value, town: e.target.value })} />
          </Field>
          <Field label="Province">
            <Select required value={value.province} options={PROVINCE_OPTIONS} onChange={(province) => onChange({ ...value, province })} />
          </Field>
        </>
      )}
    </>
  )
}

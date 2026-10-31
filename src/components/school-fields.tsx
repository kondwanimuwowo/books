import { Field } from '#/components/form'
import { Select } from '#/components/select'
import { AGE_BANDS, CURRICULA, LEVEL_GROUPS, SCHOOL_COPY as COPY, SUBJECTS, curriculumFor, schoolLine } from '#/data/school'
import type { SchoolFields as Fields } from '#/data/listing-types'
import type { AgeBand } from '#/data/school'
import { cn } from '#/lib/utils'

export interface SchoolValue {
  ageBands: AgeBand[]
  levels: string[]
  subject: string
  // Only asked when the grades don't settle it; 'both' is saved as no curriculum.
  curriculum: '' | '2023' | '2013' | 'both'
}

export const emptySchool: SchoolValue = { ageBands: [], levels: [], subject: '', curriculum: '' }

const chip = (on: boolean) =>
  cn(
    'inline-flex h-9 cursor-pointer items-center rounded-full px-3.5 text-sm font-medium transition-shadow select-none has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-ink',
    on ? 'bg-accent-soft text-accent-ink shadow-[inset_0_0_0_1.5px_var(--color-accent-ink)]' : 'shadow-[inset_0_0_0_1px_var(--color-line)] hover:shadow-[inset_0_0_0_1px_var(--color-line-strong)]',
  )

const toggle = <T extends string>(list: T[], value: T) => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

/** What the form sends: null where nothing was picked. */
export function schoolData(fields: Fields | undefined, value: SchoolValue) {
  if (!fields) return undefined
  return fields === 'age'
    ? { ageBands: value.ageBands, levels: [], subject: null, curriculum: null }
    : {
        ageBands: [],
        levels: value.levels,
        subject: value.subject || null,
        curriculum: value.curriculum === '2023' || value.curriculum === '2013' ? value.curriculum : null,
      }
}

/** The form can't be sent until these are answered. */
export function schoolProblem(fields: Fields | undefined, value: SchoolValue) {
  if (fields === 'age' && !value.ageBands.length) return `${COPY.age}: ${COPY.ageHint}`
  if (fields !== 'levels') return null
  if (!value.levels.length) return `${COPY.levels}: ${COPY.levelsHint}`
  const curriculum = curriculumFor(value.levels)
  if (curriculum === 'mixed') return COPY.mixed
  if (curriculum === 'ask' && !value.curriculum) return `${COPY.curriculum}: ${COPY.curriculumHint}`
  if (!value.subject) return `Choose the ${COPY.subject.toLowerCase()}`
  return null
}

/** Age for children's books; grade or form, curriculum and subject for textbooks. */
export function SchoolFields({ fields, value, onChange }: { fields: Fields; value: SchoolValue; onChange: (value: SchoolValue) => void }) {
  const set = (patch: Partial<SchoolValue>) => onChange({ ...value, ...patch })

  if (fields === 'age') {
    return (
      <fieldset>
        <legend className="field-label">{COPY.age}</legend>
        <p className="-mt-1 mb-2 text-sm text-subtle">{COPY.ageHint}</p>
        <div className="flex flex-wrap gap-2">
          {AGE_BANDS.map((a) => (
            <label key={a.value} className={chip(value.ageBands.includes(a.value))}>
              <input type="checkbox" className="sr-only" checked={value.ageBands.includes(a.value)} onChange={() => set({ ageBands: toggle(value.ageBands, a.value) })} />
              {a.label}
            </label>
          ))}
        </div>
      </fieldset>
    )
  }

  const curriculum = curriculumFor(value.levels)
  return (
    <div className="space-y-5">
      <fieldset>
        <legend className="field-label">{COPY.levels}</legend>
        <p className="-mt-1 mb-2 text-sm text-subtle">{COPY.levelsHint}</p>
        <div className="space-y-3">
          {LEVEL_GROUPS.map((g) => (
            <div key={g.label}>
              <p className="mb-1.5 text-xs text-subtle">
                {g.label}
                {g.note && <span> · {g.note}</span>}
              </p>
              <div className="flex flex-wrap gap-2">
                {g.levels.map((l) => (
                  <label key={l.value} className={chip(value.levels.includes(l.value))}>
                    <input type="checkbox" className="sr-only" checked={value.levels.includes(l.value)} onChange={() => set({ levels: toggle(value.levels, l.value) })} />
                    {l.label}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
        {curriculum === 'mixed' && <p className="mt-2 text-sm text-danger">{COPY.mixed}</p>}
      </fieldset>

      {curriculum === 'ask' && value.levels.length > 0 && (
        <fieldset>
          <legend className="field-label">{COPY.curriculum}</legend>
          <p className="-mt-1 mb-2 text-sm text-subtle">{COPY.curriculumHint}</p>
          <div className="flex flex-wrap gap-2">
            {[...CURRICULA.map((c) => ({ value: c.value, label: `${c.label} (${c.note.toLowerCase()})` })), { value: 'both' as const, label: COPY.bothCurricula }].map((c) => (
              <label key={c.value} className={chip(value.curriculum === c.value)}>
                <input type="radio" className="sr-only" name="curriculum" checked={value.curriculum === c.value} onChange={() => set({ curriculum: c.value })} />
                {c.label}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <Field label={COPY.subject} className="max-w-xs">
        <Select value={value.subject} options={SUBJECTS.map((s) => ({ value: s.value, label: s.label }))} onChange={(subject) => set({ subject })} />
      </Field>
    </div>
  )
}

/** A book already on Kuwala that has its details: shown, not asked again. */
export function SchoolSummary({ details }: { details: { ageBands: string[]; levels: string[]; subject: string | null; curriculum: string | null } }) {
  return (
    <p className="text-sm text-muted">
      {COPY.already} <span className="font-medium text-ink">{schoolLine(details)}</span>
    </p>
  )
}

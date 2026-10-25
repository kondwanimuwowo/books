import { Select as Base } from '@base-ui/react/select'
import { CheckIcon, ChevronDownIcon } from '@heroicons/react/16/solid'
import { cn } from '#/lib/utils'
import { useFieldLabelId } from './form'

export interface SelectOption<V extends string = string> {
  value: V
  label: string
}

export interface SelectGroup<V extends string = string> {
  label: string
  options: SelectOption<V>[]
}

type Props<V extends string> = {
  /** '' shows the placeholder, unless an option itself has the value '' (e.g. "None"). */
  value: V | ''
  onChange: (value: V) => void
  placeholder?: string
  required?: boolean
  name?: string
  'aria-label'?: string
  /** `field` matches text inputs; `pill` sits in toolbars like the sort control. */
  variant?: 'field' | 'pill'
  className?: string
} & ({ options: SelectOption<V>[]; groups?: never } | { groups: SelectGroup<V>[]; options?: never })

const TRIGGER = {
  field: 'input flex cursor-pointer items-center justify-between gap-2 text-left data-[popup-open]:border-accent-ink',
  pill: 'pill cursor-pointer gap-1.5 bg-sunken text-ink hover:bg-sunken-strong data-[popup-open]:bg-sunken-strong',
}

/** Kuwala's dropdown: styled like the rest of the forms, with keyboard, typeahead and screen reader support from Base UI. */
export function Select<V extends string>({ value, onChange, placeholder = 'Choose', required, name, variant = 'field', className, ...props }: Props<V>) {
  const labelId = useFieldLabelId()
  const groups = props.groups ?? [{ label: '', options: props.options ?? [] }]
  const items = Object.fromEntries(groups.flatMap((g) => g.options.map((o) => [o.value, o.label])))

  return (
    <Base.Root<V>
      value={value === '' && !('' in items) ? null : (value as V)}
      onValueChange={(v) => v !== null && onChange(v)}
      items={items}
      required={required}
      name={name}
    >
      <Base.Trigger aria-label={props['aria-label']} aria-labelledby={props['aria-label'] ? undefined : labelId} className={cn(TRIGGER[variant], className)}>
        <Base.Value placeholder={placeholder} className="min-w-0 truncate data-[placeholder]:text-subtle" />
        <Base.Icon className="shrink-0 text-subtle">
          <ChevronDownIcon className="size-4" aria-hidden />
        </Base.Icon>
      </Base.Trigger>
      <Base.Portal>
        <Base.Positioner sideOffset={6} alignItemWithTrigger={false} collisionPadding={12} className="z-50 outline-none">
          <Base.Popup className="select-popup card max-h-[min(var(--available-height),22rem)] min-w-[var(--anchor-width)] overflow-y-auto overscroll-contain py-1 outline-none">
            {groups.map((g) =>
              g.label ? (
                <Base.Group key={g.label}>
                  <Base.GroupLabel className="eyebrow px-3 pt-3 pb-1">{g.label}</Base.GroupLabel>
                  {g.options.map((o) => (
                    <Item key={o.value} option={o} />
                  ))}
                </Base.Group>
              ) : (
                g.options.map((o) => <Item key={o.value} option={o} />)
              ),
            )}
          </Base.Popup>
        </Base.Positioner>
      </Base.Portal>
    </Base.Root>
  )
}

function Item<V extends string>({ option }: { option: SelectOption<V> }) {
  return (
    <Base.Item
      value={option.value}
      label={option.label}
      className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-[15px] text-ink outline-none select-none data-[highlighted]:bg-sunken data-[selected]:font-medium"
    >
      <Base.ItemText className="min-w-0 flex-1">{option.label}</Base.ItemText>
      <Base.ItemIndicator className="shrink-0 text-accent-ink">
        <CheckIcon className="size-4" aria-hidden />
      </Base.ItemIndicator>
    </Base.Item>
  )
}

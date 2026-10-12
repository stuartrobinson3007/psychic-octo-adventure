import { cn } from "cn"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type FilterOption = { value: string; label: string; description?: string }

function FilterOptionLabel({ item }: { item: FilterOption }) {
  return (
    <span className="flex min-w-0 flex-1 items-baseline gap-2">
      <span>{item.label}</span>
      {item.description && (
        <span className="ml-auto text-right text-xs text-muted-foreground">
          ({item.description})
        </span>
      )}
    </span>
  )
}

export function ResearchFilterSelect({
  className,
  label,
  name,
  value,
  onChange,
  items,
}: {
  className?: string
  label: string
  name: string
  value: string
  onChange: (value: string) => void
  items: Array<FilterOption>
}) {
  const selected = items.find((item) => item.value === value)
  return (
    <Field className={cn("min-w-0 flex-1", className)}>
      <FieldLabel htmlFor={name} className="sr-only">
        {label}
      </FieldLabel>
      <Select
        name={name}
        items={items}
        value={value}
        onValueChange={(next) => onChange(next ?? "")}
      >
        <SelectTrigger
          id={name}
          size="sm"
          className="w-full"
          aria-label={label}
        >
          <SelectValue>
            {selected && <FilterOptionLabel item={selected} />}
          </SelectValue>
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          <SelectGroup>
            {items.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                <FilterOptionLabel item={item} />
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  )
}

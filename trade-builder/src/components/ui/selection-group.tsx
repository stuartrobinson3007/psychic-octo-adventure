import * as React from "react"
import { badgeVariants } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldLabel, FieldSet } from "@/components/ui/field"
import { cn } from "@/lib/utils"

interface SelectionState {
  value: string[]
  onValueChange: (value: string[]) => void
  min: number
  max: number
  disabled: boolean
}
const SelectionContext = React.createContext<SelectionState | null>(null)
function useSelectionGroup() {
  const context = React.useContext(SelectionContext)
  if (!context)
    throw new Error("Selection group parts must be inside SelectionGroup.")
  return context
}
function SelectionGroup({
  value,
  onValueChange,
  min = 1,
  max,
  disabled = false,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<typeof FieldSet>, "onChange" | "disabled"> &
  Omit<SelectionState, "min" | "disabled"> & {
    min?: number
    disabled?: boolean
  }) {
  return (
    <SelectionContext value={{ value, onValueChange, min, max, disabled }}>
      <FieldSet
        data-slot="selection-group"
        data-selection={min === max ? "exactly" : "up-to"}
        disabled={disabled}
        className={cn("gap-0", className)}
        {...props}
      >
        {children}
      </FieldSet>
    </SelectionContext>
  )
}
function SelectionGroupItem({
  value,
  label,
  children,
  className,
  ...props
}: React.ComponentProps<typeof Field> & { value: string; label: string }) {
  const { value: selected, onValueChange, max, disabled } = useSelectionGroup()
  const id = React.useId(),
    checked = selected.includes(value)
  const unavailable = disabled || (!checked && selected.length >= max)
  return (
    <Field
      data-slot="selection-group-item"
      orientation="horizontal"
      data-selected={checked}
      data-disabled={unavailable}
      className={cn(
        "group/choice relative block w-full gap-0 border-b border-border/70 last:border-b-0",
        className
      )}
      {...props}
    >
      <FieldLabel
        htmlFor={id}
        className="absolute inset-0 h-full w-full cursor-pointer group-data-[disabled=true]/field:cursor-default group-data-[selected=true]/field:bg-primary/5 hover:bg-muted/50"
      >
        <span className="sr-only">{label}</span>
      </FieldLabel>
      <Checkbox
        id={id}
        aria-label={label}
        checked={checked}
        disabled={unavailable}
        onCheckedChange={(next) =>
          onValueChange(
            next
              ? [...selected, value]
              : selected.filter((item) => item !== value)
          )
        }
        className="absolute top-6 left-4 size-5"
      />
      {children}
    </Field>
  )
}
function SelectionGroupCounter({
  className,
  ...props
}: React.ComponentProps<"span">) {
  const { value, min, max } = useSelectionGroup()
  return (
    <span
      data-slot="selection-group-counter"
      role="status"
      aria-label={`${value.length} of ${max} selected. Choose ${min === max ? "exactly" : "up to"} ${max}.`}
      className={cn(
        badgeVariants({ variant: "secondary" }),
        "ml-auto h-6 rounded-md text-muted-foreground tabular-nums",
        className
      )}
      {...props}
    >
      {value.length}/{max}
    </span>
  )
}
export { SelectionGroup, SelectionGroupItem, SelectionGroupCounter }

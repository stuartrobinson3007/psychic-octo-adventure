import { useImperativeHandle, useRef } from "react"
import type { ComponentProps } from "react"
import { Cancel01Icon, Search01Icon } from "@hugeicons/core-free-icons"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Icon } from "./icons"

type SearchInputProps = Omit<
  ComponentProps<typeof InputGroupInput>,
  "value" | "defaultValue" | "onChange" | "type" | "role" | "children"
> & {
  value: string
  onValueChange: (value: string) => void
  clearLabel: string
}

/** Consistent search and clear controls; callers own filtering and labels. */
export function SearchInput({
  value,
  onValueChange,
  clearLabel,
  className,
  disabled,
  ref,
  ...props
}: SearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  useImperativeHandle(ref, () => inputRef.current!)

  return (
    <InputGroup className={className} data-disabled={disabled}>
      <InputGroupInput
        autoComplete="off"
        {...props}
        ref={inputRef}
        type="text"
        role="searchbox"
        value={value}
        disabled={disabled}
        onChange={(event) => onValueChange(event.target.value)}
      />
      <InputGroupAddon align="inline-start">
        <Icon icon={Search01Icon} />
      </InputGroupAddon>
      {value && (
        <InputGroupAddon align="inline-end">
          <InputGroupButton
            size="icon-xs"
            aria-label={clearLabel}
            disabled={disabled}
            onClick={() => {
              onValueChange("")
              inputRef.current?.focus()
            }}
          >
            <Icon icon={Cancel01Icon} />
          </InputGroupButton>
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}

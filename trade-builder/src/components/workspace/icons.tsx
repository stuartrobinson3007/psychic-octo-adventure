import { HugeiconsIcon } from "@hugeicons/react"
import type { ComponentProps } from "react"

export function Icon(props: ComponentProps<typeof HugeiconsIcon>) {
  return <HugeiconsIcon strokeWidth={1.7} aria-hidden="true" {...props} />
}

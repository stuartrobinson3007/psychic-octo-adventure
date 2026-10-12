import type { ComponentProps } from "react"
import { cn } from "cn"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Icon } from "./icons"

export function ResearchAction({
  label,
  icon,
  disabled,
  loading = false,
  onClick,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "children"> & {
  label: string
  icon: ComponentProps<typeof Icon>["icon"]
  loading?: boolean
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={cn("relative", className)}
            aria-label={label}
            aria-disabled={disabled || loading || undefined}
            aria-busy={loading || undefined}
            onClick={disabled || loading ? undefined : onClick}
            {...props}
          />
        }
      >
        {loading ? (
          <Spinner data-icon="inline-start" />
        ) : (
          <Icon icon={icon} data-icon="inline-start" />
        )}
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
        />
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}

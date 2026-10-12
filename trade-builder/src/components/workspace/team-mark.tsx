import { cn } from "cn"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { teamLogo } from "@/lib/player-research"
import type { Team } from "@/lib/trade/types"

export function TeamMark({
  team,
  size = "small",
  className,
}: {
  team?: Team
  size?: "compact" | "small" | "large"
  className?: string
}) {
  const logo = team ? teamLogo(team) : undefined
  return (
    <Avatar
      variant="logo"
      className={cn(
        "team-mark size-10",
        size === "compact" && "size-5",
        size === "large" && "size-13",
        className
      )}
      aria-hidden="true"
      render={(props, state) => (
        <span
          {...props}
          data-team-logo-status={logo ? state.imageLoadingStatus : "empty"}
        />
      )}
    >
      {logo && <AvatarImage src={logo} alt="" />}
      <AvatarFallback>
        <span className="size-full rounded-full bg-muted" />
      </AvatarFallback>
    </Avatar>
  )
}

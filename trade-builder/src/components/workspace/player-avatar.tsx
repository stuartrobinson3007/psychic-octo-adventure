import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getNamedPlayerPhoto, getPlayerPhoto } from "@/lib/trade/player-photos"
import type { Player, Team } from "@/lib/trade/types"
import { TeamMark } from "./team-mark"

/** Portraits start at 48px; compact references use names. */
export function PlayerAvatar({
  player,
  team,
  size = "default",
  showTeamBadge = size !== "default",
}: {
  player: Pick<Player, "name"> & Partial<Pick<Player, "id" | "signingStatus">>
  team?: Team
  size?: "default" | "lg" | "xl"
  showTeamBadge?: boolean
}) {
  const photo =
    player.id === undefined
      ? getNamedPlayerPhoto(player.name)
      : getPlayerPhoto(player.id)
  const initials = player.name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")

  return (
    <span
      className="player-avatar group/player-avatar relative inline-flex size-12 shrink-0 align-middle data-[size=lg]:size-16 data-[size=xl]:size-24"
      data-size={size}
      aria-hidden="true"
    >
      <Avatar className="size-full bg-muted">
        {photo.hasPhoto && (
          <AvatarImage
            src={photo.src}
            alt=""
            loading="lazy"
            decoding="async"
            style={{ objectPosition: photo.objectPosition }}
          />
        )}
        <AvatarFallback className="text-xs">{initials}</AvatarFallback>
      </Avatar>
      {team && player.signingStatus !== "free-agent" && showTeamBadge && (
        <span className="player-team-badge absolute -right-0.5 -bottom-0.5 flex size-10 items-center justify-center rounded-full bg-background p-1 group-data-[size=default]/player-avatar:size-5 group-data-[size=default]/player-avatar:p-0.5 group-data-[size=lg]/player-avatar:size-6 group-data-[size=lg]/player-avatar:p-0.5">
          <TeamMark
            team={team}
            size={size === "lg" ? "compact" : "small"}
            className="size-full"
          />
        </span>
      )}
    </span>
  )
}

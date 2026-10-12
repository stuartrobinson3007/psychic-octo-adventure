import type { Catalogue, DraftPick, AssetTransfer } from "./types.ts"

export function pickLabel(
  pick: DraftPick,
  catalogue: Pick<Catalogue, "teams">
) {
  const origin = catalogue.teams.find((team) => team.id === pick.originalTeamId)
  return `${origin?.abbreviation ?? `Team ${pick.originalTeamId}`} ${pick.year} ${pick.round === 1 ? "first" : "second"}-round pick`
}
export function pickDetails(pick: DraftPick) {
  if (pick.isSwap)
    return pick.protectionDetails
      ? `Swap rights · ${pick.protectionDetails}`
      : "Swap rights"
  if (pick.isProtected) return pick.protectionDetails ?? "Protected"
  return pick.protectionDetails ?? "Unprotected"
}
export function assetLabel(transfer: AssetTransfer, catalogue: Catalogue) {
  if (transfer.assetType === "player")
    return (
      catalogue.players.find((player) => player.id === transfer.assetId)
        ?.name ?? "Unavailable player"
    )
  if (transfer.assetType === "draft_right")
    return `${catalogue.draftRights?.find((item) => item.id === transfer.assetId)?.playerName ?? "Unavailable player"} draft rights`
  const pick = catalogue.draftPicks?.find(
    (item) => item.id === transfer.assetId
  )
  return pick
    ? pickLabel(pick, catalogue)
    : `Unavailable pick ${transfer.assetId}`
}
export function assetCount(
  transfers: Array<AssetTransfer>,
  additionalPlayers = 0
) {
  const players =
    transfers.filter((item) => item.assetType === "player").length +
    additionalPlayers
  const picks = transfers.filter((item) => item.assetType === "pick").length
  const rights = transfers.filter(
    (item) => item.assetType === "draft_right"
  ).length
  return (
    [
      players ? `${players} player${players === 1 ? "" : "s"}` : "",
      picks ? `${picks} pick${picks === 1 ? "" : "s"}` : "",
      rights ? `${rights} draft right${rights === 1 ? "" : "s"}` : "",
    ]
      .filter(Boolean)
      .join(" · ") || "No assets"
  )
}

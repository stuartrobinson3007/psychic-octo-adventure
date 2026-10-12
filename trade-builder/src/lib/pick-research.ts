import { pickDetails, pickLabel } from "./trade/picks.ts"
import type { Catalogue, DraftPick } from "./trade/types.ts"

export function pickUnavailableReason(pick: DraftPick): string | null {
  if (pick.isSwap) return "This pick is tied to a swap and can’t be added."
  if (!pick.isTradable)
    return `Unavailable to trade.${pick.protectionDetails ? ` ${pick.protectionDetails}` : ""}`
  return null
}

export function searchDraftPicks(
  catalogue: Catalogue,
  filters: {
    query: string
    owner: string
    origin: string
    year: string
    round: string
    availability: string
    sort: string
  }
): Array<DraftPick> {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim()
  const terms = normalize(filters.query).split(/\s+/).filter(Boolean)
  const teams = new Map(catalogue.teams.map((team) => [team.id, team]))
  return (catalogue.draftPicks ?? [])
    .filter((pick) => !pick.isSwap)
    .filter((pick) => {
      const owner = teams.get(pick.currentTeamId)
      const origin = teams.get(pick.originalTeamId)
      const text = normalize(
        [
          pickLabel(pick, catalogue),
          pickDetails(pick),
          pick.round === 1 ? "first 1st round 1" : "second 2nd round 2",
          owner?.city,
          owner?.name,
          owner?.abbreviation,
          origin?.city,
          origin?.name,
          origin?.abbreviation,
        ].join(" ")
      )
      const available = !pickUnavailableReason(pick)
      return (
        terms.every((term) =>
          text.split(" ").some((word) => word.startsWith(term))
        ) &&
        (!filters.owner || pick.currentTeamId === Number(filters.owner)) &&
        (!filters.origin || pick.originalTeamId === Number(filters.origin)) &&
        (!filters.year || pick.year === Number(filters.year)) &&
        (!filters.round || pick.round === Number(filters.round)) &&
        (!filters.availability ||
          (filters.availability === "available" ? available : !available))
      )
    })
    .sort((a, b) => {
      const teamName = (id: number) => teams.get(id)?.abbreviation ?? String(id)
      const grouping =
        filters.sort === "owner"
          ? teamName(a.currentTeamId).localeCompare(teamName(b.currentTeamId))
          : filters.sort === "origin"
            ? teamName(a.originalTeamId).localeCompare(
                teamName(b.originalTeamId)
              )
            : 0
      return (
        grouping ||
        a.year - b.year ||
        a.round - b.round ||
        teamName(a.originalTeamId).localeCompare(teamName(b.originalTeamId)) ||
        a.id - b.id
      )
    })
}

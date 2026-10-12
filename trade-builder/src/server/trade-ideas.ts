import { TradeDomainError } from "./trade-errors.ts"
import { assetLabel } from "../lib/trade/picks.ts"
import { searchCatalogue, SearchExpired } from "./search-catalogue.ts"
import { discoverySpace } from "./trade-discovery.ts"
import { repairSpace } from "./trade-repair.ts"
import { proposalKey, searchKey } from "./conversation-records.ts"
import type { SearchRecord } from "./conversation-records.ts"
import type { TradeSession } from "./trade-session.ts"
import type {
  ClarificationOption,
  TradeIdeaPage,
  TradeProposal,
  TradeSnapshot,
} from "../lib/trade/types.ts"

const localScanLimit = 50_000
// A bounded, disposable index avoids recounting a saved search on every page.
// Large spaces retain bounded paging rather than delaying the picker for a count.
const ideaIndexes = new Map<string, number[]>()

export function ideaSpace(
  search: SearchRecord,
  catalogue = searchCatalogue(search)
) {
  const spec = search.specification
  if (spec.kind === "discovery") return discoverySpace(spec.request, catalogue)
  if (!search.base)
    throw new TradeDomainError("The proposal for this search is unavailable.")
  return repairSpace({ ...spec.request, snapshot: search.base }, catalogue)
}
function canonicalProposal(
  search: SearchRecord,
  proposal: TradeProposal,
  ordinal: number
): TradeProposal {
  return {
    ...proposal,
    proposalId: `${search.id}_${ordinal}`,
    revision: search.revision,
    createdAt: search.createdAt!,
  }
}
export function ideaOption(
  search: SearchRecord,
  proposal: TradeProposal,
  catalogue = searchCatalogue(search)
): ClarificationOption {
  const perspectiveTeamId =
    search.specification.request.sourceTeamId ?? proposal.teamIds[0]
  const incoming = proposal.transfers.filter(
    (t) => t.toTeamId === perspectiveTeamId
  )
  const outgoing = proposal.transfers.filter(
    (t) => t.fromTeamId === perspectiveTeamId
  )
  const names = (items: typeof incoming) =>
    items.map((t) => assetLabel(t, catalogue)).join(" + ")
  const label = `${names(outgoing)} for ${names(incoming)}`
  const reference = proposalKey(proposal)
  return {
    id: reference,
    label,
    value: label,
    searchText: proposal.transfers
      .map((t) => {
        const player = catalogue.players.find((p) => p.id === t.assetId)
        const team = catalogue.teams.find(
          (candidate) => candidate.id === t.fromTeamId
        )
        return `${assetLabel(t, catalogue)} ${player?.name ?? ""} ${team?.city ?? ""} ${team?.name ?? ""} ${team?.abbreviation ?? ""}`
      })
      .join(" "),
    tradeIdea: { reference, proposal, perspectiveTeamId },
  }
}
/** The ordinal belongs to a pinned roster and search version. Clients never supply a proposal. */
export function resolveIdeaReference(
  session: TradeSession,
  reference: string
): TradeSnapshot | null {
  const match = /^proposal:([a-zA-Z0-9-]+)_(\d+)@(\d+)$/.exec(reference)
  if (!match) return null
  const search = session.records?.searches.find(
    (s) => s.id === match[1] && s.revision === Number(match[3])
  )
  if (!search) return null
  let space
  try {
    space = ideaSpace(search)
  } catch (error) {
    if (error instanceof SearchExpired) return null
    throw error
  }
  const ordinal = Number(match[2])
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= space.total)
    return null
  const proposal = space.at(ordinal)
  return proposal
    ? { proposal: canonicalProposal(search, proposal, ordinal), verdict: null }
    : null
}
/** Bounded local paging keeps very large combination spaces out of chat payloads. */
export function browseIdeas(
  search: SearchRecord,
  cursor = 0,
  query = ""
): TradeIdeaPage {
  let catalogue
  try {
    catalogue = searchCatalogue(search)
  } catch (error) {
    if (error instanceof SearchExpired)
      return {
        status: "expired",
        options: [],
        nextCursor: null,
        expiresAt: search.expiresAt,
      }
    throw error
  }
  const space = ideaSpace(search, catalogue)
  if (space.invalid) throw new TradeDomainError(space.invalid)
  const browseOrder =
    search.browseOrder ??
    (search.pageCursor === undefined ? "varied" : "canonical")
  const ordinalAt = (position: number) =>
    browseOrder === "varied"
      ? (space.browseOrdinal?.(position) ?? position)
      : position
  const options: ClarificationOption[] = []
  const terms = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean)
  const matchesQuery = (proposal: TradeProposal) => {
    if (!terms.length) return true
    const text = ideaOption(
      search,
      proposal,
      catalogue
    ).searchText!.toLocaleLowerCase()
    return terms.every((term) => text.includes(term))
  }
  if (space.total <= localScanLimit) {
    const key = JSON.stringify([
      searchKey(search),
      catalogue.fetchedAt,
      browseOrder,
      terms,
    ])
    let positions = ideaIndexes.get(key)
    if (!positions) {
      positions = []
      for (let position = 0; position < space.total; position++) {
        const ordinal = ordinalAt(position)
        const proposal = space.at(ordinal)
        if (proposal && matchesQuery(proposal)) positions.push(position)
      }
      if (ideaIndexes.size >= 32)
        ideaIndexes.delete(ideaIndexes.keys().next().value!)
      ideaIndexes.set(key, positions)
    }
    const start = positions.findIndex((position) => position >= cursor)
    const page = start < 0 ? [] : positions.slice(start, start + 30)
    return {
      options: page.map((position) => {
        const ordinal = ordinalAt(position)
        return ideaOption(
          search,
          canonicalProposal(search, space.at(ordinal)!, ordinal),
          catalogue
        )
      }),
      total: positions.length,
      expiresAt: search.expiresAt,
      nextCursor:
        start >= 0 && start + page.length < positions.length
          ? page.at(-1)! + 1
          : null,
    }
  }
  let position = cursor
  const end = Math.min(space.total, cursor + localScanLimit)
  for (; position < end && options.length < 30; position++) {
    const ordinal = ordinalAt(position)
    const proposal = space.at(ordinal)
    if (!proposal) continue
    const option = ideaOption(
      search,
      canonicalProposal(search, proposal, ordinal),
      catalogue
    )
    if (
      terms.every((term) =>
        option.searchText!.toLocaleLowerCase().includes(term)
      )
    )
      options.push(option)
  }
  return {
    options,
    total: null,
    expiresAt: search.expiresAt,
    nextCursor: position < space.total ? position : null,
  }
}
export function expandIdeaAnswer(session: TradeSession, ids: string[]) {
  const question = [...(session.records?.questions ?? [])]
    .reverse()
    .find(
      (q) =>
        q.status === "open" && q.clarification.purpose === "trade_selection"
    )
  if (!question?.clarification.tradeSearch || ids.length > 5) return
  const search = session.records!.searches.find(
    (s) => searchKey(s) === question.clarification.tradeSearch!.reference
  )
  if (!search) return
  for (const id of ids) {
    if (question.clarification.options.some((o) => o.id === id)) continue
    const idea = resolveIdeaReference(session, id)
    if (
      idea &&
      idea.proposal.proposalId.startsWith(`${search.id}_`) &&
      idea.proposal.revision === search.revision
    )
      question.clarification.options.push(ideaOption(search, idea.proposal))
  }
}

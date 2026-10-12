import { transactionStatus } from "./trade/signings.ts"
import type { TradeSnapshot } from "./trade/types.ts"

/** Brief evidence-based introduction for card-only replies and older history. */
export function cardResponseSummary(snapshots: Array<TradeSnapshot>): string {
  if (!snapshots.length) return ""
  const noun = snapshots.every((item) => item.proposal.transfers.length)
    ? "trade"
    : snapshots.every(
          (item) =>
            !item.proposal.transfers.length && item.proposal.signings?.length
        )
      ? "signing"
      : "scenario"
  const statuses = snapshots.map(transactionStatus)
  const passed = statuses.filter((status) => status === "valid").length
  const rejected = statuses.filter(
    (status) => status === "invalid_trade" || status === "invalid_proposal"
  ).length
  const unchecked = snapshots.length - passed - rejected
  if (snapshots.length === 1) {
    if (passed)
      return noun === "trade"
        ? "This trade passes the salary and roster checks."
        : noun === "signing"
          ? "This signing passes the contract and roster checks."
          : "This scenario passes the payroll and roster checks."
    if (rejected) return `This ${noun} needs changes before it can work.`
    return statuses[0] === "validation_incomplete"
      ? `I could only check part of this ${noun}.`
      : `I couldn’t finish checking this ${noun}.`
  }
  const total = snapshots.length
  if (passed === total)
    return noun === "trade"
      ? `All ${total} trades pass the salary and roster checks.`
      : `All ${total} ${noun}s pass the checks.`
  const outcomes = [
    ...(passed ? [`${passed} ${passed === 1 ? "passes" : "pass"}`] : []),
    ...(rejected
      ? [`${rejected} ${rejected === 1 ? "needs" : "need"} changes`]
      : []),
    ...(unchecked ? [`${unchecked} couldn’t be fully checked`] : []),
  ]
  return `Of these ${total} ${noun}s, ${new Intl.ListFormat("en", {
    type: "conjunction",
  }).format(outcomes)}.`
}

export const tradeValueMessage =
  "I can compare contracts, age and position, but I don’t have the performance and team-fit information needed to judge whether this is a good deal for either team. Passing salary and roster checks alone does not establish basketball value."

/** Refresh previously saved assistant copy without changing trade evidence. */
export function tradeResponseCopy(message: string): string {
  return message
    .replace(
      "A selected player is no longer in the catalogue.",
      "A selected player is no longer available."
    )
    .replace("was not found in the catalogue", "was not found")
    .replace(
      /This trade passes bball-GM's checks for its synthetic ([\d–-]+) dataset\./g,
      "This trade passes the $1 salary and roster checks."
    )
    .replace(/ These checks use bball-GM's synthetic [\d–-]+ dataset\./g, "")
    .replace(
      / These are checks against bball-GM's synthetic [\d–-]+ dataset, not assessments of basketball value or whether teams would accept\./g,
      " These options pass salary and roster checks; team fit and willingness to trade need a separate assessment."
    )
    .replace(/are outside this demo's scope/g, "aren’t supported yet")
    .replace(
      /is outside this demo's trade scope/g,
      "isn’t supported for trades yet"
    )
    .replace(
      /consent is outside this demo's scope/g,
      "consent must be resolved before this trade can be checked"
    )
    .replace(
      "This catalogue provides contracts, age and position, but no performance or team-fit evidence. I can compare those recorded facts, but cannot determine whether this is a good or fair deal for either team from this data alone. Passing the trade engine's salary and roster checks does not establish basketball value.",
      tradeValueMessage
    )
}

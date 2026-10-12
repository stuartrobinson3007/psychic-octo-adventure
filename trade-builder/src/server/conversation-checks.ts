import { Effect } from "effect"
import type {
  Catalogue,
  TradeSnapshot,
  TradeVerdict,
} from "../lib/trade/types.ts"
import { proposalKey } from "./conversation-records.ts"
import type { TradeSession } from "./trade-session.ts"
import { CatalogueError, evaluateProposal, loadCatalogue } from "./trade-api.ts"
import { TradeServiceRequestError } from "./trade-service-http.ts"

/** Repair imported/older missing evidence once, without creating a user task or new revision. */
export async function checkUncheckedProposals(
  session: TradeSession,
  signal?: AbortSignal
) {
  const known = new Map<string, TradeSnapshot>()
  const snapshots = [
    ...session.revisions,
    ...session.candidates,
    ...session.messages.flatMap((message) => [
      ...(message.snapshots ?? []),
      ...(message.candidates ?? []),
    ]),
    ...(session.snapshot ? [session.snapshot] : []),
  ]
  if (snapshots.every((snapshot) => snapshot.verdict)) return false
  for (const snapshot of snapshots) {
    const key = proposalKey(snapshot.proposal)
    if (!known.has(key) || snapshot.verdict) known.set(key, snapshot)
  }
  const missing = [...known.values()].filter((snapshot) => !snapshot.verdict)
  if (missing.length) {
    // Stay within the conversation lease, even for large archives or a slow service.
    let catalogue: Catalogue | null = null
    const unavailable = (snapshot: TradeSnapshot): TradeVerdict => ({
      proposalId: snapshot.proposal.proposalId,
      revision: snapshot.proposal.revision,
      status: "validation_unavailable",
      summary: "This proposal could not be checked. Retry the check.",
      teams: [],
      appliedRules: [],
      issues: [],
      evaluatedAt: new Date().toISOString(),
      dataFetchedAt: catalogue?.fetchedAt ?? "",
      season: catalogue?.cap.season ?? "",
      source: "bball-gm",
    })
    await Effect.runPromise(
      Effect.gen(function* () {
        catalogue = yield* Effect.tryPromise({
          try: (checkSignal) => loadCatalogue(false, checkSignal),
          catch: (cause) => cause,
        }).pipe(
          Effect.catch((cause) =>
            cause instanceof CatalogueError ||
            cause instanceof TradeServiceRequestError
              ? Effect.succeed(null)
              : Effect.die(cause)
          )
        )
        const currentCatalogue = catalogue
        yield* Effect.forEach(
          missing,
          (snapshot) =>
            Effect.tryPromise({
              try: (checkSignal) =>
                currentCatalogue
                  ? evaluateProposal(
                      snapshot.proposal,
                      currentCatalogue,
                      checkSignal
                    )
                  : Promise.resolve(unavailable(snapshot)),
              catch: (cause) => cause,
            }).pipe(
              Effect.orDie,
              Effect.tap((verdict) =>
                Effect.sync(() => {
                  known.set(proposalKey(snapshot.proposal), {
                    ...snapshot,
                    verdict,
                  })
                })
              )
            ),
          { concurrency: 4 }
        )
      }).pipe(
        Effect.timeout("45 seconds"),
        Effect.catchTag("TimeoutError", () => Effect.void)
      ),
      { signal }
    )
    for (const snapshot of missing)
      if (!known.get(proposalKey(snapshot.proposal))?.verdict)
        known.set(proposalKey(snapshot.proposal), {
          ...snapshot,
          verdict: unavailable(snapshot),
        })
  }
  const checked = (snapshot: TradeSnapshot) =>
    structuredClone(known.get(proposalKey(snapshot.proposal)) ?? snapshot)
  session.revisions = session.revisions.map(checked)
  session.candidates = session.candidates.map(checked)
  for (const message of session.messages) {
    message.snapshots = message.snapshots?.map(checked)
    message.candidates = message.candidates?.map(checked)
  }
  if (session.snapshot) session.snapshot = checked(session.snapshot)
  return true
}

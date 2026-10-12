import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { executeSearch } from "./conversation-search.ts"
import { browseIdeas, resolveIdeaReference } from "./trade-ideas.ts"
import { getSession } from "./trade-session.ts"
import { getConversationStore } from "./conversation-store.ts"
import { records } from "./conversation-records.ts"
import type { SearchRecord } from "./conversation-records.ts"
import type { Catalogue } from "../lib/trade/types.ts"

test("saved search pages share a durable catalogue, expire safely and restart with the same scope", () => {
  const catalogue: Catalogue = JSON.parse(
    readFileSync(
      new URL("../lib/trade/catalogue-snapshot.json", import.meta.url),
      "utf8"
    )
  )
  catalogue.fetchedAt = new Date().toISOString()
  const player = catalogue.players.find(
    (item) => item.name === "Derrick White"
  )!
  const session = getSession(crypto.randomUUID())
  const create = (): SearchRecord => ({
    id: crypto.randomUUID(),
    revision: 1,
    goal: "Find trades for Derrick White",
    messageId: crypto.randomUUID(),
    specification: {
      kind: "discovery",
      request: {
        sourceTeamId: player.teamId,
        outgoingPlayerIds: [player.id],
        outgoingCount: 1,
        incomingCount: 1,
        constraints: { minSalarySavings: 0 },
      },
    },
  })
  const first = create(),
    second = create()
  const state = records(session)
  state.searches.push(first, second)
  const start = (search: SearchRecord, data = catalogue) =>
    executeSearch({
      session,
      search,
      catalogue: data,
      signal: new AbortController().signal,
      introduction: "Trade ideas",
    })
  const initial = start(first)
  start(second)
  assert.equal(initial.status, "found")
  assert.equal(first.catalogueId, second.catalogueId)
  assert.equal(first.catalogue, undefined)
  const store = getConversationStore()
  store.claim(session.id, "search-test")
  store.save(
    session.id,
    0,
    JSON.stringify({ records: session.records }),
    "search-test"
  )
  store.release(session.id, "search-test")
  const persisted = JSON.parse(store.read(session.id)!.payload!)
  assert(
    persisted.records.searches.every(
      (search: SearchRecord) => search.catalogueId && !search.catalogue
    )
  )
  const restored = { ...session, records: persisted.records }
  const opening = browseIdeas(restored.records.searches[0])
  assert.equal(opening.options.length, 30)
  assert.notEqual(opening.nextCursor, null)
  const next = browseIdeas(restored.records.searches[0], opening.nextCursor!)
  const seen = new Set(opening.options.map((option) => option.id))
  assert(next.options.every((option) => !seen.has(option.id)))
  const selected = opening.options[0]
  assert.deepEqual(
    resolveIdeaReference(restored, selected.id)?.proposal,
    selected.tradeIdea!.proposal
  )
  // A refreshed roster must not silently reinterpret an option's old reference.
  const updated = structuredClone(catalogue)
  updated.fetchedAt = new Date(Date.now() + 1).toISOString()
  updated.players.find((item) => item.id === player.id)!.salary += 1_000_000
  const newer = create()
  state.searches.push(newer)
  start(newer, updated)
  assert.deepEqual(
    resolveIdeaReference(restored, selected.id)?.proposal,
    selected.tradeIdea!.proposal
  )
  const expired = restored.records.searches[0] as SearchRecord
  expired.expiresAt = "2000-01-01T00:00:00.000Z"
  assert.equal(browseIdeas(expired, opening.nextCursor!).status, "expired")
  assert.equal(resolveIdeaReference(restored, selected.id), null)
  const refreshed: SearchRecord = {
    ...expired,
    revision: 2,
    createdAt: new Date().toISOString(),
    catalogueId: undefined,
    expiresAt: undefined,
    pageCursor: undefined,
    messageId: crypto.randomUUID(),
  }
  state.searches.push(refreshed)
  assert.equal(start(refreshed, updated).status, "found")
  assert.deepEqual(refreshed.specification, first.specification)
  assert.notEqual(refreshed.catalogueId, first.catalogueId)
  assert.equal(browseIdeas(refreshed).options.length, 30)
})

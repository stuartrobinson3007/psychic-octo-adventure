// Import recorded conversations, never raw tool traces or credentials.
import { readFile, writeFile } from "node:fs/promises"

const merge = process.argv.includes("--merge")
const paths = process.argv.slice(2).filter((path) => path !== "--merge")
if (!paths.length)
  throw new Error(
    "Usage: node scripts/import-chat-review.mjs [--merge] <report.json> [more reports.json]"
  )
// Later reports replace whole conversations, never append another session's
// turns to the same journey (for example a focused rerun after a full refresh).
const conversations = new Map()
const briefs = new Map(
  JSON.parse(
    await readFile(new URL("./ux-review-cases.json", import.meta.url), "utf8")
  ).map((brief) => [brief.name, brief])
)
for (const path of paths) {
  const report = JSON.parse(await readFile(path, "utf8"))
  const reportTurns = new Map()
  if (!Array.isArray(report.results)) throw new Error(`No results in ${path}`)
  for (const definition of report.definitions ?? []) {
    const count = report.results.filter(
      (row) => row.scenario === definition.name
    ).length
    if (count !== definition.turnCount)
      throw new Error(
        `${definition.name}: incomplete recording (${count}/${definition.turnCount}); resume the recording before importing`
      )
  }
  for (const row of report.results) {
    if (
      (!row.passed && !row.captured) ||
      typeof row.scenario !== "string" ||
      typeof row.input !== "string" ||
      !Array.isArray(row.result?.snapshots) ||
      typeof row.result.message !== "string"
    )
      throw new Error(`Invalid or failing recorded turn in ${path}`)
    const {
      status,
      message,
      snapshot,
      snapshots,
      changes,
      candidates,
      clarification,
      pendingClarification,
      toolCalls,
      workDurationMs,
    } = row.result
    const turn = {
      ...(row.backendRevision ? { backendRevision: row.backendRevision } : {}),
      scenario: row.scenario,
      ...(row.scenarioTitle ? { scenarioTitle: row.scenarioTitle } : {}),
      ...(row.scenarioDescription
        ? { scenarioDescription: row.scenarioDescription }
        : {}),
      ...(row.scenarioTags ? { scenarioTags: row.scenarioTags } : {}),
      input: row.input,
      recordedAt: row.recordedAt ?? report.checkedAt,
      ...(row.selectedPlayerIds
        ? { selectedPlayerIds: row.selectedPlayerIds }
        : {}),
      ...(row.selection ? { selection: row.selection } : {}),
      ...(row.selections ? { selections: row.selections } : {}),
      ...(row.conversation ? { conversation: row.conversation } : {}),
      ...(row.ideaOptions ? { ideaOptions: row.ideaOptions } : {}),
      result: {
        status,
        message,
        snapshot,
        snapshots,
        changes,
        ...(candidates !== undefined ? { candidates } : {}),
        ...(clarification !== undefined ? { clarification } : {}),
        ...(pendingClarification !== undefined ? { pendingClarification } : {}),
        ...(workDurationMs !== undefined ? { workDurationMs } : {}),
        ...(toolCalls !== undefined
          ? {
              toolCalls: toolCalls.map(
                ({ id, label, state, visible, activeLabel, details }) => ({
                  id,
                  label,
                  state,
                  ...(visible !== undefined ? { visible } : {}),
                  ...(activeLabel !== undefined ? { activeLabel } : {}),
                  ...(details !== undefined ? { details } : {}),
                })
              ),
            }
          : {}),
      },
    }
    if (!reportTurns.has(row.scenario)) reportTurns.set(row.scenario, [])
    reportTurns.get(row.scenario).push(turn)
  }
  for (const [name, turns] of reportTurns) conversations.set(name, turns)
}
const turns = [...conversations.values()].flat()
const target = new URL(
  "../src/lib/ux-review/conversations.json",
  import.meta.url
)
const replaced = new Set(turns.map((turn) => turn.scenario))
const existing = merge ? JSON.parse(await readFile(target, "utf8")) : []
const combined = [
  ...existing.filter((turn) => !replaced.has(turn.scenario)),
  ...turns,
].map((turn) => {
  const brief = briefs.get(turn.scenario)
  return brief
    ? {
        ...turn,
        scenarioTitle: brief.title,
        scenarioDescription: brief.description,
        scenarioTags: [
          ...new Set([...(turn.scenarioTags ?? []), ...brief.tags]),
        ],
      }
    : turn
})
await writeFile(target, `${JSON.stringify(combined, null, 2)}\n`)
console.log(
  `Imported ${turns.length} recorded turns; ${combined.length} total. No model calls were made.`
)

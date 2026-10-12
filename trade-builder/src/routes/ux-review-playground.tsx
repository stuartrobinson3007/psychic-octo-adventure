import { createFileRoute } from "@tanstack/react-router"
import { WorkspaceLayout } from "@/components/workspace/workspace-layout"
import { tradeRecord } from "@/components/workspace/trade-card"
import { messagePlayerReferences } from "@/lib/message-player-references"
import catalogueData from "@/lib/ux-review/catalogue.json"
import type { Catalogue } from "@/lib/trade/types"
import { useReviewScenario } from "@/lib/ux-review/data"
import { checkpointCount, reviewEntries } from "@/lib/ux-review/model"

export const Route = createFileRoute("/ux-review-playground")({
  validateSearch: (search: Record<string, unknown>) => ({
    scenario: typeof search.scenario === "string" ? search.scenario : "",
    step: Number.isInteger(Number(search.step))
      ? Math.max(0, Number(search.step))
      : 0,
  }),
  head: () => ({ meta: [{ title: "Gambit · review conversation" }] }),
  component: Playground,
})

const catalogue = catalogueData as Catalogue
function Playground() {
  const search = Route.useSearch()
  const { scenario, error } = useReviewScenario(search.scenario)
  if (!import.meta.env.DEV)
    return <p>Local review is available in development.</p>
  if (error) return <p role="alert">{error}</p>
  if (!scenario && search.scenario) return <p>Loading preview…</p>
  if (
    !scenario ||
    (scenario.source === "fixture" && scenario.fixture !== "welcome")
  )
    return (
      <p>
        This checkpoint is an authored UI fixture and cannot be opened as a
        conversation.
      </p>
    )
  const step = Math.min(search.step, checkpointCount(scenario) - 1)
  const turns = scenario.turns.slice(0, step + 1)
  const entries = reviewEntries(turns, catalogue).map(
    ({ snapshot, ...entry }) => ({
      ...entry,
      playerReferences: messagePlayerReferences(entry.text, catalogue.players),
      ...(snapshot ? { trade: tradeRecord(snapshot, catalogue) } : {}),
    })
  )
  return (
    <WorkspaceLayout
      key={`${scenario.id}:${step}`}
      preview={{
        entries,
        snapshot: turns.at(-1)?.result.snapshot ?? null,
        sessionKey: `${scenario.id}:${step}`,
      }}
    />
  )
}

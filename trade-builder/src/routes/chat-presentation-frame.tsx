import { createFileRoute } from "@tanstack/react-router"
import { useMemo } from "react"
import { ChatPreview } from "@/components/ux-review/chat-preview"
import { presentOptionSelections } from "@/lib/chat-presentation-scenario"
import { useReviewScenario } from "@/lib/ux-review/data"

export const Route = createFileRoute("/chat-presentation-frame")({
  validateSearch: (search: Record<string, unknown>) => ({
    scenario: typeof search.scenario === "string" ? search.scenario : "",
    step: Number.isInteger(Number(search.step))
      ? Math.max(0, Number(search.step))
      : 0,
    phase:
      search.phase === "input" ? ("input" as const) : ("response" as const),
  }),
  component: PresentationFrame,
})

function PresentationFrame() {
  const search = Route.useSearch()
  const { scenario: recorded, error } = useReviewScenario(search.scenario)
  const scenario = useMemo(
    () => (recorded ? presentOptionSelections(recorded) : null),
    [recorded]
  )
  if (!import.meta.env.DEV)
    return <p>Available on the local development server.</p>
  if (error) return <p role="alert">{error}</p>
  if (!scenario) return <p>Loading conversation…</p>
  const step = Math.min(search.step, Math.max(0, scenario.turns.length - 1))
  return (
    <ChatPreview
      key={`${scenario.id}:${step}:${search.phase}`}
      scenario={scenario}
      step={step}
      phase={search.phase}
    />
  )
}

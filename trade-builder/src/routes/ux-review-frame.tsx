import { SelectionRepliesPreview } from "@/components/ux-review/selection-replies-preview"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { ChatPreview } from "@/components/ux-review/chat-preview"
import { useReviewScenario } from "@/lib/ux-review/data"
import { checkpointCount } from "@/lib/ux-review/model"
import { reviewSheetSize, reviewViewports } from "@/lib/ux-review/viewports"
import catalogueData from "@/lib/ux-review/catalogue.json"
import type { Catalogue, TradeClarification } from "@/lib/trade/types"

export const Route = createFileRoute("/ux-review-frame")({
  validateSearch: (search: Record<string, unknown>) => ({
    scenario: typeof search.scenario === "string" ? search.scenario : "",
    sheet: search.sheet === true || search.sheet === "true",
    phase:
      search.phase === "input" ? ("input" as const) : ("response" as const),
    variant:
      search.variant === "player-options" ||
      search.variant === "selection-replies"
        ? search.variant
        : "",
    step: Number.isInteger(Number(search.step))
      ? Math.max(0, Number(search.step))
      : 0,
  }),
  component: PreviewRoute,
})

function PreviewRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { scenario, scenarios, error } = useReviewScenario(search.scenario)
  useEffect(() => {
    if (!import.meta.env.DEV) return
    const index = scenarios.findIndex((item) => item.id === search.scenario)
    if (index < 0) return
    const nextStep = search.phase === "input" ? search.step : search.step + 1
    const nextScenario =
      nextStep < scenarios[index].checkpoints
        ? scenarios[index]
        : scenarios[(index + 1) % scenarios.length]
    const next: typeof search = {
      scenario: nextScenario.id,
      step: nextScenario.id === search.scenario ? nextStep : 0,
      variant: search.variant,
      sheet: search.sheet,
      phase:
        search.phase === "input"
          ? "response"
          : nextScenario.inputs
            ? "input"
            : "response",
    }
    document.documentElement.dataset.reviewNext = `${next.scenario}:${next.step}:${next.phase}`
    const move = (event: KeyboardEvent) => {
      if (!event.ctrlKey || !event.altKey || event.key !== "ArrowRight") return
      event.preventDefault()
      void navigate({ search: next, replace: true })
    }
    window.addEventListener("keydown", move)
    return () => {
      window.removeEventListener("keydown", move)
      delete document.documentElement.dataset.reviewNext
    }
  }, [
    navigate,
    scenarios,
    search.scenario,
    search.step,
    search.variant,
    search.sheet,
    search.phase,
  ])
  if (!import.meta.env.DEV)
    return <p>Local review is available in development.</p>
  if (search.variant === "selection-replies") return <SelectionRepliesPreview />
  if (error) return <p role="alert">{error}</p>
  if (!scenario)
    return (
      <p>
        {search.scenario
          ? "Loading preview…"
          : "Choose a conversation in the review tool."}
      </p>
    )
  const step = Math.min(search.step, checkpointCount(scenario) - 1)
  const phase = scenario.source === "recorded" ? search.phase : "response"
  if (search.sheet)
    return (
      <div className="flex gap-4 bg-white" style={reviewSheetSize}>
        {reviewViewports.map((viewport) => (
          <iframe
            key={viewport.name}
            title={`${viewport.name} preview`}
            data-review-viewport={viewport.name}
            width={viewport.width}
            height={viewport.height}
            style={{ border: 0, flexShrink: 0 }}
            src={`/ux-review-frame?scenario=${encodeURIComponent(scenario.id)}&step=${step}&phase=${phase}`}
          />
        ))}
      </div>
    )
  // Local component fixture: exercise package badges without changing a recording.
  const catalogue = catalogueData as Catalogue
  const white = catalogue.players.find(
    (player) => player.name === "Derrick White"
  )
  const wiggins = catalogue.players.find(
    (player) => player.name === "Andrew Wiggins"
  )
  const clarificationOverride: TradeClarification | undefined =
    search.variant === "player-options" && white && wiggins
      ? {
          question: "Which package did you mean?",
          options: [
            {
              id: "package",
              label: `${white.name} and ${wiggins.name}`,
              value: `${white.name} and ${wiggins.name}`,
            },
            {
              id: `player-${white.id}`,
              label: white.name,
              value: white.name,
              playerId: white.id,
            },
          ],
        }
      : undefined
  return (
    <ChatPreview
      key={`${scenario.id}:${step}:${phase}:${search.variant}`}
      scenario={scenario}
      step={step}
      phase={phase}
      onRecordedSubmit={() =>
        void navigate({
          search: { ...search, phase: "response" },
          replace: true,
        })
      }
      clarificationOverride={clarificationOverride}
    />
  )
}

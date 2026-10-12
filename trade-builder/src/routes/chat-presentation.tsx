import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useMemo, useRef, useState } from "react"
import { ScenarioView } from "@/components/chat-presentation/scenario-view"
import { presentationScenarios } from "@/components/chat-presentation/scenarios"
import { rememberPresentationScenario } from "@/lib/chat-presentation-cache"
import "@/components/chat-presentation/presentation.css"

export const Route = createFileRoute("/chat-presentation")({
  head: () => ({ meta: [{ title: "Gambit — Conversation walkthrough" }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    scenario: presentationScenarios.some((item) => item.id === search.scenario)
      ? String(search.scenario)
      : presentationScenarios[0].id,
  }),
  component: PresentationRoute,
})

function PresentationRoute() {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const selected = presentationScenarios.find(
    (item) => item.id === search.scenario
  )!
  const [recent, setRecent] = useState<readonly string[]>([selected.id])
  const cachedIds = useMemo(
    () => rememberPresentationScenario(recent, selected.id),
    [recent, selected.id]
  )
  useEffect(() => {
    setRecent(cachedIds)
  }, [cachedIds])
  const scenariosNav = useRef<HTMLElement>(null)
  useEffect(() => {
    const mobile = matchMedia("(max-width: 767px)")
    const revealSelection = () => {
      if (mobile.matches)
        scenariosNav.current
          ?.querySelector<HTMLElement>("[aria-current]")
          ?.scrollIntoView({
            block: "nearest",
            inline: "nearest",
            behavior: "instant",
          })
    }
    revealSelection()
    mobile.addEventListener("change", revealSelection)
    return () => mobile.removeEventListener("change", revealSelection)
  }, [selected.id])

  if (!import.meta.env.DEV)
    return (
      <p className="p-6">
        The conversation walkthrough is available on the local development
        server.
      </p>
    )
  return (
    <main className="presentation-viewer">
      <aside className="presentation-sidebar">
        <h1>Gambit</h1>
        <nav ref={scenariosNav} aria-label="Presentation scenarios">
          {presentationScenarios.map((item) => (
            <button
              key={item.id}
              aria-current={selected.id === item.id ? "page" : undefined}
              onClick={() =>
                void navigate({
                  search: { scenario: item.id },
                  resetScroll: false,
                })
              }
            >
              {item.title}
            </button>
          ))}
        </nav>
      </aside>
      <section className="presentation-main" aria-label={selected.title}>
        {/* Stable DOM order prevents cached iframe documents from being reinserted. */}
        {presentationScenarios
          .filter((item) => cachedIds.includes(item.id))
          .map((item) => (
            <ScenarioView
              key={item.id}
              id={item.id}
              title={item.title}
              active={item.id === selected.id}
            />
          ))}
      </section>
    </main>
  )
}

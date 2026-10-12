import { useCallback, useMemo, useRef, useState } from "react"
import { presentationCheckpoints } from "@/lib/chat-presentation-scenario"
import type { ReviewScenario } from "@/lib/ux-review/model"
import { ConversationStage } from "./conversation-stage"

/** A fresh scenario owns a fresh queue; only its first pending screen can load. */
export function ConversationTimeline({
  scenario,
  title,
  active,
}: {
  scenario: ReviewScenario
  title: string
  active: boolean
}) {
  const stages = useMemo(() => presentationCheckpoints(scenario), [scenario])
  const [pending, setPending] = useState(() => stages.map((_, index) => index))
  const timeline = useRef<HTMLDivElement>(null)
  const horizontalScroll = useCallback((delta: number) => {
    timeline.current?.scrollBy({ left: delta, behavior: "instant" })
  }, [])
  const settled = useCallback((index: number) => {
    setPending((current) => (current[0] === index ? current.slice(1) : current))
  }, [])
  const retry = useCallback((index: number) => {
    setPending((current) =>
      current.includes(index) ? current : [...current, index]
    )
  }, [])

  return (
    <div
      ref={timeline}
      className="presentation-timeline"
      role="region"
      aria-label="Conversation stages"
      tabIndex={0}
    >
      {stages.map(({ step, phase }, index) => (
        <article className="presentation-stage" key={`${step}:${phase}`}>
          <ConversationStage
            scenarioId={scenario.id}
            step={step}
            phase={phase}
            title={`${title}, ${phase === "input" ? "message" : "reply"} ${step + 1}`}
            stageIndex={index}
            load={active && pending[0] === index}
            onSettled={settled}
            onRetry={retry}
            onHorizontalScroll={horizontalScroll}
          />
        </article>
      ))}
    </div>
  )
}

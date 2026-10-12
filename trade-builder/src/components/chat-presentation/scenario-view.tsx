import { useReviewScenario } from "@/lib/ux-review/data"
import { ConversationTimeline } from "./conversation-timeline"

/** Keep cached documents and scroll positions mounted at their original size. */
export function ScenarioView({
  id,
  title,
  active,
}: {
  id: string
  title: string
  active: boolean
}) {
  const { scenario, error } = useReviewScenario(id)
  return (
    <div
      className="presentation-cached-scenario"
      data-presentation-scenario={id}
      aria-hidden={!active}
      inert={!active}
    >
      {error ? (
        <p role="alert" className="presentation-error">
          Couldn't load the conversation.{" "}
          <button onClick={() => location.reload()}>Try again</button>
        </p>
      ) : !scenario ? (
        <p role="status" className="presentation-error">
          Loading conversation…
        </p>
      ) : (
        <ConversationTimeline
          scenario={scenario}
          title={title}
          active={active}
        />
      )}
    </div>
  )
}

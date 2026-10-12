import { useEffect, useState } from "react"
import type { ReviewScenario } from "./model"

interface ScenarioIndex {
  id: string
  checkpoints: number
  inputs: boolean
}
interface ReviewData {
  id: string
  scenario: ReviewScenario | null
  scenarios: ScenarioIndex[]
  error: string | null
}
const empty: ReviewData = { id: "", scenario: null, scenarios: [], error: null }

async function readReviewData<T>(
  file: string,
  signal: AbortSignal
): Promise<T> {
  const response = await fetch(
    `/__ux-review-assets/${encodeURIComponent(file)}`,
    {
      signal,
      cache: "no-store",
    }
  )
  if (!response.ok)
    throw new Error("The preview could not load. Refresh the atlas and reload.")
  return response.json() as Promise<T>
}

/** Each preview loads one conversation, never the full recording collection. */
export function useReviewScenario(id: string) {
  const [data, setData] = useState(empty)
  useEffect(() => {
    if (!import.meta.env.DEV || !id) return
    const controller = new AbortController()
    void Promise.all([
      readReviewData<ReviewScenario>(`scenario-${id}.json`, controller.signal),
      readReviewData<ScenarioIndex[]>("scenario-index.json", controller.signal),
    ])
      .then(([scenario, scenarios]) => {
        if (!controller.signal.aborted)
          setData({ id, scenario, scenarios, error: null })
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setData({
            id,
            scenario: null,
            scenarios: [],
            error:
              error instanceof Error
                ? error.message
                : "The preview could not load. Reload to try again.",
          })
      })
    return () => controller.abort()
  }, [id])
  return data.id === id ? data : empty
}

import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"

export const Route = createFileRoute("/ux-review")({
  head: () => ({ meta: [{ title: "Gambit — Chat UX review" }] }),
  component: ReviewRoute,
})

function ReviewRoute() {
  useEffect(() => {
    if (import.meta.env.DEV)
      location.replace(
        `/ux-review/index.html${location.search}${location.hash}`
      )
  }, [])
  return (
    <p>
      {import.meta.env.DEV
        ? "Opening the visual reviewer…"
        : "Local review is available in development."}
    </p>
  )
}

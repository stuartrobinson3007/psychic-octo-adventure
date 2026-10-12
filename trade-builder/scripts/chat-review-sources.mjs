import { createHash } from "node:crypto"
import { readFile, readdir } from "node:fs/promises"
const root = new URL("../", import.meta.url)
const hash = (data) => createHash("sha256").update(data).digest("hex")
async function sources(directory) {
  const entries = await readdir(new URL(directory, root), {
    withFileTypes: true,
  })
  const nested = await Promise.all(
    entries.map((entry) =>
      entry.isDirectory()
        ? sources(`${directory}/${entry.name}`)
        : /\.(tsx?|css|json)$/.test(entry.name) &&
            !entry.name.includes(".test.")
          ? [`${directory}/${entry.name}`]
          : []
    )
  )
  return nested.flat()
}
export async function reviewSourceRevision() {
  const files = [
    ...(await sources("src/components/workspace")),
    ...(await sources("src/components/ux-review")),
    ...(await sources("src/components/ai-elements")),
    ...(await sources("src/components/ui")),
    ...(await sources("src/lib/ux-review")),
    "src/styles.css",
    "src/lib/conversation-entries.ts",
    "src/lib/trade-response-copy.ts",
    "src/lib/trade-clarification.ts",
    "src/lib/clarification-selection.ts",
    "src/lib/tool-activity.ts",
    "src/lib/player-research.ts",
    "src/lib/pick-research.ts",
    "src/lib/message-pick-references.ts",
    "src/lib/message-player-references.ts",
    ...(await sources("src/lib/trade")).filter(
      (file) => file !== "src/lib/trade/catalogue-snapshot.json"
    ),
    "src/lib/trade/catalogue-snapshot.json",
    "src/routes/ux-review-frame.tsx",
    "scripts/ux-review-cases.json",
  ].sort()
  const digests = await Promise.all(
    files.map(
      async (file) => `${file}:${hash(await readFile(new URL(file, root)))}`
    )
  )
  return hash(digests.join("\n"))
}

// Backend recordings and UI captures have independent freshness boundaries.
export async function reviewBackendRevision() {
  const files = [
    ...(await sources("src/server")),
    ...(await sources("src/lib")).filter(
      (file) => !file.startsWith("src/lib/ux-review/")
    ),
    "package-lock.json",
  ].sort()
  const digests = await Promise.all(
    files.map(
      async (file) => `${file}:${hash(await readFile(new URL(file, root)))}`
    )
  )
  return hash(digests.join("\n"))
}

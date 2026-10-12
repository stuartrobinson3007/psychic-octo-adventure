import { spawn } from "node:child_process"
import { mkdir, readFile } from "node:fs/promises"

const directory = new URL("../.ux-review/", import.meta.url)
await mkdir(directory, { recursive: true })
const report = process.argv[2] ?? ".ux-review/backend-refresh.json"
const saved = await readFile(report, "utf8").then(
  (text) => JSON.parse(text),
  (error) => {
    if (error.code !== "ENOENT") throw error
    return null
  }
)
const complete =
  saved?.definitions?.length &&
  saved.definitions.every(
    (definition) =>
      saved.results.filter((row) => row.scenario === definition.name).length ===
      definition.turnCount
  )
const resume = saved && !complete ? ["--resume"] : []

async function run(script, ...args) {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      stdio: "inherit",
    })
    child.on("error", reject)
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(new Error(`${script} exited with ${code}`))
    )
  })
}

await run(
  "scripts/record-chat-review.mjs",
  report,
  ...resume,
  "--concurrency=6"
)
await run("scripts/import-chat-review.mjs", "--merge", report)
await run("scripts/prepare-chat-atlas.mjs")
await run("scripts/verify-chat-atlas.mjs", "--require-recordings")

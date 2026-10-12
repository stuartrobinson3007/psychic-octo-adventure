import { createHash } from "node:crypto"
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises"
import {
  reviewSourceRevision,
  reviewBackendRevision,
} from "./chat-review-sources.mjs"
import {
  reviewScenarios,
  checkpointCount,
  reviewCheckpoints,
  reviewInput,
} from "../src/lib/ux-review/model.ts"
import { checkpointContext } from "../src/lib/ux-review/checkpoint-context.ts"
import { reviewViewports as viewports } from "../src/lib/ux-review/viewports.ts"

const root = new URL("../", import.meta.url)
const directory = new URL("../.ux-review/", import.meta.url)
await mkdir(directory, { recursive: true })
const scenarios = reviewScenarios(
  JSON.parse(
    await readFile(
      new URL("src/lib/ux-review/conversations.json", root),
      "utf8"
    )
  ),
  JSON.parse(
    await readFile(new URL("scripts/ux-review-cases.json", root), "utf8")
  )
)
const capabilities = JSON.parse(
  await readFile(new URL("scripts/ux-review-capabilities.json", root), "utf8")
)
for (const scenario of scenarios)
  if (scenario.fixture?.startsWith("ideas-") && !scenario.turns.length)
    throw new Error(
      "Refresh ‘Incoming guard selection and five checks’ before preparing trade-picker fixtures."
    )
const scenarioData = await Promise.all(
  scenarios.map(async (scenario) => {
    const file = `scenario-${scenario.id}.json`
    const body = JSON.stringify(scenario)
    await writeFile(new URL(encodeURIComponent(file), directory), body)
    return {
      id: scenario.id,
      file,
      sha256: createHash("sha256").update(body).digest("hex"),
    }
  })
)
await writeFile(
  new URL("scenario-index.json", directory),
  JSON.stringify(
    scenarios.map((scenario) => ({
      id: scenario.id,
      checkpoints: checkpointCount(scenario),
      inputs: scenario.source === "recorded",
    }))
  )
)
const idFor = (name) => name.replaceAll(" ", "-")
const coverage = capabilities.map((capability) => {
  const ids = [
    ...(capability.scenarios ?? []).map(idFor),
    ...(capability.fixtures ?? []),
  ]
  return {
    ...capability,
    scenarioIds: ids,
    missingScenarios: ids.filter(
      (id) => !scenarios.some((scenario) => scenario.id === id)
    ),
  }
})
const hash = (value) => createHash("sha256").update(value).digest("hex")
const revision = await reviewSourceRevision()
const backendRevision = await reviewBackendRevision()
const recorded = scenarios.filter((scenario) => scenario.source === "recorded")
const staleScenarioIds = recorded
  .filter((scenario) =>
    scenario.turns.some((turn) => turn.backendRevision !== backendRevision)
  )
  .map((scenario) => scenario.id)
const recordings = {
  backendRevision,
  total: recorded.length,
  current: recorded.length - staleScenarioIds.length,
  staleScenarioIds,
}
const available = new Set(
  (await readdir(directory)).map((file) => file.normalize("NFC"))
)
const artifact = (name) => new URL(encodeURIComponent(name), directory)
const frames = []
for (const scenario of scenarios)
  for (const [checkpointIndex, { step, phase }] of reviewCheckpoints(
    scenario
  ).entries())
    for (const viewport of viewports) {
      const turnId = `turn-${String(step + 1).padStart(2, "0")}`
      const stepId = phase === "input" ? `${turnId}-input` : turnId
      const id = `${scenario.id}--${stepId}--${viewport.name}`
      const input =
        phase === "input" ? reviewInput(scenario.turns[step]) : undefined
      const context = checkpointContext(scenario, step, phase)
      const action = context.action
      const livePreviewUrl = `/ux-review-frame?scenario=${encodeURIComponent(scenario.id)}&step=${step}${phase === "input" ? "&phase=input" : ""}`
      let capture
      try {
        capture = JSON.parse(
          await readFile(artifact(`${id}.capture.json`), "utf8")
        )
      } catch {
        /* Older captures have no freshness evidence. */
      }
      const imageFile = [`${id}.png`, `${id}.jpg`, `${id}.svg`].includes(
        capture?.imageFile
      )
        ? capture.imageFile
        : available.has(`${id}.png`)
          ? `${id}.png`
          : `${id}.jpg`
      const captured =
        available.has(imageFile) && capture?.sourceRevision === revision
      const hasDom = available.has(`${id}.html`) && available.has(`${id}.json`)
      frames.push({
        id,
        scenarioId: scenario.id,
        scenarioTitle: scenario.title,
        scenarioDescription: `${scenario.source === "recorded" ? "Scenario brief" : "Authored UI fixture"}. ${scenario.description}`,
        description: input
          ? `${action}. Before sending: ${input.text}`
          : (scenario.turns[step]?.input ?? scenario.description),
        checkpointLabel: `${turnId} · ${phase === "input" ? "Before sending" : "Response"}`,
        phase,
        ...context,
        stepId,
        stepIndex: checkpointIndex,
        turnIndex: step,
        tags: [
          ...scenario.tags,
          scenario.source,
          phase === "input" ? action : "Response",
        ],
        ...(scenario.source === "recorded"
          ? {
              recording: {
                recordedAt: scenario.turns[step].recordedAt,
                current:
                  scenario.turns[step].backendRevision === backendRevision,
              },
            }
          : {}),
        viewport: viewport.name,
        viewportLabel: viewport.label,
        width: viewport.width,
        height: viewport.height,
        imagePath: `__ux-review-assets/${captured ? imageFile : `${id}--recapture-required.png`}`,
        thumbnailPath: `__ux-review-assets/${captured ? imageFile : `${id}--recapture-required.png`}`,
        currentSha256: captured
          ? hash(await readFile(artifact(imageFile)))
          : hash(`${revision}:${id}`),
        affected: true,
        captured,
        capturedAt: captured ? capture.capturedAt : undefined,
        captureUrl: livePreviewUrl,
        livePreviewUrl,
        previewUrl: `/ux-review-playground?scenario=${encodeURIComponent(scenario.id)}&step=${step}`,
        replayable:
          scenario.source === "recorded" || scenario.fixture === "welcome",
        ...(hasDom && captured
          ? {
              domSnapshot: {
                htmlPath: `__ux-review-assets/${id}.html`,
                elementsPath: `__ux-review-assets/${id}.json`,
                sha256: hash(await readFile(artifact(`${id}.html`))),
                limitations: [
                  "Frozen Gambit chat checkpoint. The screenshot is authoritative; external styles, fonts or pseudo-elements can differ.",
                ],
              },
            }
          : {}),
      })
    }
const manifest = {
  sourceRevision: revision,
  scenarioData,
  recordings,
  runId: `gambit-chat-${revision.slice(0, 12)}`,
  revision: `working-tree-${revision.slice(0, 12)}`,
  suite: "Gambit · conversations and workspace",
  viewports,
  frames,
  impact: { mode: "workspace" },
}
await writeFile(
  new URL("manifest.json", directory),
  JSON.stringify(manifest, null, 2)
)
await writeFile(
  new URL("coverage.json", directory),
  JSON.stringify(
    {
      handoffStatus: `${recordings.current}/${recordings.total} conversations recorded with the current backend · live UI previews and authored fixtures`,
      capabilities: coverage.map((capability) => ({
        ...capability,
        frameCount: frames.filter((frame) =>
          capability.scenarioIds.includes(frame.scenarioId)
        ).length,
      })),
      screens: scenarios.map((scenario) => ({
        route: scenario.title,
        capturedStates: frames
          .filter((frame) => frame.scenarioId === scenario.id)
          .map(
            (frame) =>
              `${frame.stepId} / ${frame.viewport} · current UI${frame.captured ? " + frozen capture" : ""}`
          ),
        missingStates: [],
        persona: scenario.source,
        source: "Gambit · 2026–27 season",
      })),
    },
    null,
    2
  )
)
console.log(
  `Prepared ${scenarios.length} scenarios and ${frames.length} viewport views (${frames.filter((frame) => frame.captured).length} captured).`
)

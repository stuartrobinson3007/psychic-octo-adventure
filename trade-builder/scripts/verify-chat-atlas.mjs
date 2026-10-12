import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import {
  reviewSourceRevision,
  reviewBackendRevision,
} from "./chat-review-sources.mjs"
function imageDimensions(bytes) {
  if (bytes.subarray(0, 4).toString() === "<svg") {
    const text = bytes.toString()
    const dimensions = text.match(
      /^<svg[^>]*width="(\d+)" height="(\d+)" viewBox="([\d. ]+)"/
    )
    const image = text.match(/href="data:image\/jpeg;base64,([A-Za-z0-9+/=]+)"/)
    assert(dimensions && image, "Invalid viewport screenshot window")
    const [x, y, width, height] = dimensions[3].split(" ").map(Number)
    const source = imageDimensions(Buffer.from(image[1], "base64"))
    const embeddedDimensions = text.match(/<image width="(\d+)" height="(\d+)"/)
    assert(embeddedDimensions, "Screenshot source dimensions missing")
    assert.equal(
      source.width,
      Number(embeddedDimensions[1]),
      "Screenshot pixels must not be resized"
    )
    assert.equal(
      source.height,
      Number(embeddedDimensions[2]),
      "Screenshot pixels must not be resized"
    )
    assert(
      x >= 0 &&
        y >= 0 &&
        x + width <= source.width &&
        y + height <= source.height,
      "Screenshot window outside captured pixels"
    )
    assert.equal(width, Number(dimensions[1]))
    assert.equal(height, Number(dimensions[2]))
    assert(!/<script\b|\son\w+=/i.test(text), "Screenshot window must be inert")
    return { width, height }
  }
  if (bytes.subarray(1, 4).toString() === "PNG")
    return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) }
  assert.equal(
    bytes.readUInt16BE(0),
    0xffd8,
    "Expected a PNG or JPEG screenshot"
  )
  let offset = 2
  while (offset + 4 <= bytes.length) {
    assert.equal(bytes[offset], 0xff, "Invalid JPEG marker")
    const marker = bytes[offset + 1]
    offset += 2
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0xff) {
      offset--
      continue
    }
    const length = bytes.readUInt16BE(offset)
    assert(
      length >= 2 && offset + length <= bytes.length,
      "Invalid JPEG segment"
    )
    if ([0xc0, 0xc1, 0xc2].includes(marker))
      return {
        width: bytes.readUInt16BE(offset + 5),
        height: bytes.readUInt16BE(offset + 3),
      }
    offset += length
  }
  throw new Error("Screenshot dimensions unavailable")
}
const directory = new URL("../.ux-review/", import.meta.url)
const artifact = (name) => new URL(encodeURIComponent(name), directory)
const manifest = JSON.parse(
  await readFile(new URL("manifest.json", directory), "utf8")
)
const coverage = JSON.parse(
  await readFile(new URL("coverage.json", directory), "utf8")
)
for (const capability of coverage.capabilities ?? []) {
  assert.deepEqual(
    capability.missingScenarios,
    [],
    `${capability.title}: missing review scenarios`
  )
  for (const id of capability.scenarioIds)
    assert.ok(
      manifest.frames.some((frame) => frame.scenarioId === id),
      `${capability.title}: no frames for ${id}`
    )
}
const revision = await reviewSourceRevision()
assert.equal(
  manifest.recordings?.backendRevision,
  await reviewBackendRevision(),
  "Rebuild the manifest for the current backend source."
)
if (process.argv.includes("--require-recordings"))
  assert.deepEqual(
    manifest.recordings.staleScenarioIds,
    [],
    "Refresh backend recordings before claiming the atlas is up to date."
  )
assert.equal(
  manifest.sourceRevision,
  revision,
  "Rebuild the manifest for the current UI source."
)
const hash = (data) => createHash("sha256").update(data).digest("hex")
assert.equal(
  manifest.scenarioData.length,
  new Set(manifest.frames.map((frame) => frame.scenarioId)).size
)
const scenarioById = new Map()
for (const scenario of manifest.scenarioData) {
  const body = await readFile(artifact(scenario.file))
  assert.equal(
    hash(body),
    scenario.sha256,
    `${scenario.id}: preview data differs from the prepared recording`
  )
  scenarioById.set(scenario.id, JSON.parse(body))
}
assert.equal(
  new Set(manifest.frames.map((frame) => frame.id)).size,
  manifest.frames.length,
  "Frame IDs must be unique."
)
for (const frame of manifest.frames) {
  const url = new URL(frame.livePreviewUrl, "http://localhost")
  assert.equal(url.searchParams.get("scenario"), frame.scenarioId)
  assert.equal(Number(url.searchParams.get("step")), frame.turnIndex)
  assert.equal(url.searchParams.get("phase") ?? "response", frame.phase)
  const scenario = scenarioById.get(frame.scenarioId)
  assert.ok(frame.stateLabel, `${frame.id}: missing observed-state label`)
  if (scenario.source === "recorded")
    assert.equal(
      frame.requestText,
      scenario.turns[frame.turnIndex].input,
      `${frame.id}: canvas request does not match its preview conversation`
    )
  if (scenario.fixture?.startsWith("ideas-"))
    assert.equal(
      frame.fixtureBasis,
      scenario.turns[frame.turnIndex].input,
      `${frame.id}: shared picker fixture data is not identified`
    )
  if (frame.recording && frame.phase === "response") {
    assert.ok(
      manifest.frames.some(
        (input) =>
          input.scenarioId === frame.scenarioId &&
          input.turnIndex === frame.turnIndex &&
          input.viewport === frame.viewport &&
          input.phase === "input" &&
          input.stepIndex === frame.stepIndex - 1 &&
          input.action
      ),
      `${frame.id}: missing user action before the response`
    )
  }
  assert.equal(
    frame.livePreviewUrl,
    frame.captureUrl,
    `${frame.id}: current UI preview missing`
  )
  if (process.argv.includes("--require-captures"))
    assert(frame.captured, `${frame.id}: current frozen capture missing`)
  if (!frame.captured) continue
  const pixelFile = frame.imagePath.split("/").at(-1)
  const [pixels, html, indexText, captureText] = await Promise.all([
    readFile(artifact(pixelFile)),
    readFile(artifact(`${frame.id}.html`)),
    readFile(artifact(`${frame.id}.json`), "utf8"),
    readFile(artifact(`${frame.id}.capture.json`), "utf8"),
  ])
  const capture = JSON.parse(captureText)
  assert.equal(
    capture.sourceRevision,
    revision,
    `${frame.id}: stale source revision`
  )
  assert.ok(capture.capturedAt, `${frame.id}: capture timestamp missing`)
  const dimensions = imageDimensions(pixels)
  assert.equal(
    dimensions.width,
    frame.width,
    `${frame.id}: incorrect viewport width`
  )
  assert.equal(
    dimensions.height,
    frame.height,
    `${frame.id}: incorrect viewport height`
  )
  assert.equal(
    hash(pixels),
    frame.currentSha256,
    `${frame.id}: screenshot hash mismatch`
  )
  assert.equal(
    hash(html),
    frame.domSnapshot?.sha256,
    `${frame.id}: frozen DOM hash mismatch`
  )
  assert.ok(
    !/<script\b/i.test(html.toString()),
    `${frame.id}: frozen DOM must not contain scripts`
  )
  const index = JSON.parse(indexText)
  assert.equal(index.frameId, frame.id)
  assert.ok(index.elements.length, `${frame.id}: empty DOM element index`)
  for (const element of index.elements)
    for (const key of ["x", "y", "width", "height"])
      assert.ok(
        Number.isFinite(element.rect[key]),
        `${frame.id}: invalid element bounds`
      )
}
console.log(
  `Verified ${manifest.frames.length} UI views across ${new Set(manifest.frames.map((frame) => frame.scenarioId)).size} scenarios; ${manifest.recordings.current}/${manifest.recordings.total} backend recordings current; ${manifest.frames.filter((frame) => frame.captured).length} current frozen screenshots.`
)

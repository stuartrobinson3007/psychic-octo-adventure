// Run this module from cua_repl, passing its browser tab, viewport capability,
// and filesystem binding. Browser operations stay on the documented CUA API.
import { reviewSheetSize } from "../src/lib/ux-review/viewports.ts"
export function atlasJPEGDimensions(bytes) {
  const data = Buffer.from(bytes)
  if (data.readUInt16BE(0) !== 0xffd8)
    throw new Error("Expected a JPEG capture")
  let offset = 2
  while (offset + 4 <= data.length) {
    if (data[offset] !== 0xff) throw new Error("Invalid JPEG marker")
    const marker = data[offset + 1]
    offset += 2
    if (marker === 0xd9 || marker === 0xda) break
    if (marker === 0xff) {
      offset--
      continue
    }
    const length = data.readUInt16BE(offset)
    if (length < 2 || offset + length > data.length)
      throw new Error("Invalid JPEG segment")
    if ([0xc0, 0xc1, 0xc2].includes(marker))
      return {
        width: data.readUInt16BE(offset + 5),
        height: data.readUInt16BE(offset + 3),
      }
    offset += length
  }
  throw new Error("JPEG dimensions unavailable")
}
export function readAtlasDOM(frameId, suppliedFrameId) {
  frameId = suppliedFrameId ?? frameId
  const ready = document.documentElement.dataset.reviewReady
  if (!ready)
    return {
      ready,
      error: document.documentElement.dataset.reviewError,
      index: { frameId, elements: [] },
      html: "",
      scrolls: [],
      width: innerWidth,
      height: innerHeight,
    }
  const elements = []
  const scrolls = []
  for (const element of document.querySelectorAll("[data-review-id]")) {
    const id = element.getAttribute("data-review-id")
    const rect = element.getBoundingClientRect()
    if (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < innerHeight &&
      rect.left < innerWidth
    )
      elements.push({
        id,
        tag: element.tagName.toLowerCase(),
        role: element.getAttribute("role"),
        text: (element.textContent || "").trim().slice(0, 500),
        accessibleName: element.getAttribute("aria-label") || "",
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      })
    if (element.scrollTop || element.scrollLeft)
      scrolls.push({ id, x: element.scrollLeft, y: element.scrollTop })
  }
  return {
    html: document.documentElement.outerHTML,
    index: { frameId, elements },
    scrolls,
    ready: document.documentElement.dataset.reviewReady,
    error: document.documentElement.dataset.reviewError,
    width: innerWidth,
    height: innerHeight,
  }
}
export function freezeAtlasHTML(capture) {
  const css =
    "*,*::before,*::after{animation:none!important;transition:none!important}" +
    capture.scrolls
      .map(
        (scroll) =>
          `[data-review-id="${scroll.id}"]{overflow:hidden!important}[data-review-id="${scroll.id}"]>*{transform:translate(${-scroll.x}px,${-scroll.y}px)!important}`
      )
      .join("")
  const html = capture.html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script\s*>/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*')/gi, "")
  return (
    "<!DOCTYPE html>" + html.replace("</head>", `<style>${css}</style></head>`)
  )
}
async function advanceAtlasPreview(tab) {
  const brand = tab.playwright.getByRole("button", {
    name: "Chat options",
    exact: true,
  })
  const target = (await brand.count()) ? brand : tab.playwright.locator("body")
  await target.press("Control+Alt+ArrowRight", { timeoutMs: 10000 })
}
export async function captureAtlasBatch({
  tab,
  viewport,
  frames,
  sourceRevision,
  fs,
  directory,
  start = 0,
  limit = 20,
  budgetMs = 40000,
  origin = "http://127.0.0.1:3018",
}) {
  const started = Date.now()
  let next = start
  let captured = 0
  const errors = []
  let dimensions
  while (
    next < frames.length &&
    next - start < limit &&
    Date.now() - started < budgetMs
  ) {
    const frame = frames[next++]
    try {
      const wanted = `${frame.width}:${frame.height}`
      if (dimensions !== wanted) {
        await viewport.set({ width: frame.width, height: frame.height })
        dimensions = wanted
      }
      const turnIndex = frame.turnIndex ?? frame.stepIndex
      const phase = frame.phase ?? "response"
      const marker = `${frame.scenarioId}:${turnIndex}:${phase}`
      const page = await tab.playwright.evaluate(() => ({
        next: document.documentElement.dataset.reviewNext,
        url: location.href,
      }))
      const current = new URL(page.url)
      if (
        current.origin === origin &&
        current.searchParams.get("scenario") === frame.scenarioId &&
        current.searchParams.get("step") === String(turnIndex) &&
        (current.searchParams.get("phase") ?? "response") === phase &&
        current.searchParams.get("sheet") !== "true"
      ) {
        /* Preserve an already loaded individual viewport. */
      } else if (page.next === marker) await advanceAtlasPreview(tab)
      else await tab.goto(origin + frame.captureUrl + "&variant=&sheet=false")
      await tab.getAXState({ emit: false })
      await tab.playwright
        .locator(`html[data-review-ready="${marker}"]`)
        .waitFor({ state: "attached", timeoutMs: 25000 })
      const dom = await tab.playwright.evaluate(readAtlasDOM, frame.id, {
        timeoutMs: 10000,
      })
      if (
        dom.ready !== marker ||
        dom.error ||
        !dom.index.elements.length ||
        dom.width !== frame.width ||
        dom.height !== frame.height
      )
        throw new Error(
          `Frame not ready: ${JSON.stringify({ ready: dom.ready, error: dom.error, width: dom.width, height: dom.height, elements: dom.index.elements.length })}`
        )
      const pixels = await tab.screenshot({ fullPage: false })
      const pixelDimensions = atlasJPEGDimensions(pixels)
      if (
        pixelDimensions.width !== frame.width ||
        pixelDimensions.height !== frame.height
      )
        throw new Error(
          `Incorrect viewport pixels: ${pixelDimensions.width}×${pixelDimensions.height}`
        )
      await fs.writeFile(`${directory}/${frame.id}.jpg`, pixels)
      await fs.writeFile(`${directory}/${frame.id}.html`, freezeAtlasHTML(dom))
      await fs.writeFile(
        `${directory}/${frame.id}.json`,
        JSON.stringify(dom.index)
      )
      // Write the freshness marker last so interrupted captures remain stale.
      await fs.writeFile(
        `${directory}/${frame.id}.capture.json`,
        JSON.stringify({
          sourceRevision,
          capturedAt: new Date().toISOString(),
          imageFile: `${frame.id}.jpg`,
        })
      )
      captured++
    } catch (error) {
      errors.push({ frameId: frame.id, message: error.message })
    }
  }
  return { next, captured, errors, elapsedMs: Date.now() - started }
}

async function waitAtlasFrame(scope, marker) {
  const started = Date.now()
  while (Date.now() - started < 25000) {
    try {
      await scope
        .locator(`html[data-review-ready="${marker}"]`)
        .waitFor({ state: "attached", timeoutMs: 3000 })
      await scope
        .locator('[data-slot="message-scroller-viewport"][data-pending-scroll]')
        .waitFor({ state: "hidden", timeoutMs: 10000 })
      return
    } catch (error) {
      const failure = await scope
        .locator("html")
        .getAttribute("data-review-error", { timeoutMs: 10000 })
      if (failure) throw new Error(failure)
      if (Date.now() - started >= 25000) throw error
    }
  }
}
// A review contact sheet hosts four real, unscaled browser viewports. Capture
// each iframe's own pixels and DOM; it saves loading the same checkpoint four times.
export async function captureAtlasSheetBatch({
  tab,
  checkpoints,
  sourceRevision,
  fs,
  directory,
  start = 0,
  limit = 10,
  budgetMs = 40000,
  origin = "http://127.0.0.1:3018",
}) {
  const started = Date.now()
  let next = start
  let captured = 0
  const errors = []
  while (
    next < checkpoints.length &&
    next - start < limit &&
    Date.now() - started < budgetMs
  ) {
    const frames = checkpoints[next++]
    const turnIndex = frames[0].turnIndex ?? frames[0].stepIndex
    const phase = frames[0].phase ?? "response"
    const marker = `${frames[0].scenarioId}:${turnIndex}:${phase}`
    try {
      const page = await tab.playwright.evaluate(
        () => ({
          next: document.documentElement.dataset.reviewNext,
          url: location.href,
        }),
        undefined,
        { timeoutMs: 10000 }
      )
      const expectedUrl = origin + frames[0].captureUrl + "&variant=&sheet=true"
      const current = new URL(page.url)
      if (
        current.origin === origin &&
        current.searchParams.get("scenario") === frames[0].scenarioId &&
        current.searchParams.get("step") === String(turnIndex) &&
        (current.searchParams.get("phase") ?? "response") === phase &&
        current.searchParams.get("sheet") === "true"
      ) {
        /* Keep an already loaded checkpoint. */
      } else if (page.next === marker) await advanceAtlasPreview(tab)
      else await tab.goto(expectedUrl)
      // Each scoped readiness observation below reads the new visible DOM.
      // Avoid a full accessibility inventory of four long conversations here.
      const captures = []
      for (const frame of frames) {
        const selector = `iframe[data-review-viewport="${frame.viewport}"]`
        const scope = tab.playwright.frameLocator(selector)
        await waitAtlasFrame(scope, marker)
        let dom = await scope
          .locator("html")
          .evaluate(readAtlasDOM, frame.id, { timeoutMs: 10000 })
        if (dom.ready !== marker) {
          await waitAtlasFrame(scope, marker)
          dom = await scope
            .locator("html")
            .evaluate(readAtlasDOM, frame.id, { timeoutMs: 10000 })
        }
        if (
          dom.ready !== marker ||
          dom.error ||
          !dom.index.elements.length ||
          dom.width !== frame.width ||
          dom.height !== frame.height
        )
          throw new Error(`Frame not ready: ${frame.id}`)
        captures.push({ frame, dom })
      }
      const clips = await tab.playwright
        .locator("iframe[data-review-viewport]")
        .evaluateAll((elements) =>
          elements.map((element) => {
            const rect = element.getBoundingClientRect()
            return {
              name: element.getAttribute("data-review-viewport"),
              x: rect.x + scrollX,
              y: rect.y + scrollY,
              width: rect.width,
              height: rect.height,
            }
          })
        )
      // Keep the browser's pixels unchanged. Each inert SVG is a viewport
      // window into the same captured contact sheet, with the JPEG embedded.
      const pixels = await tab.screenshot({ fullPage: true })
      const dimensions = atlasJPEGDimensions(pixels)
      if (
        dimensions.width !== reviewSheetSize.width ||
        dimensions.height !== reviewSheetSize.height
      )
        throw new Error(
          `Incorrect contact sheet pixels: ${dimensions.width}×${dimensions.height}`
        )
      const jpeg = Buffer.from(pixels).toString("base64")
      for (const { frame, dom } of captures) {
        const clip = clips.find((rect) => rect.name === frame.viewport)
        if (!clip || clip.width !== frame.width || clip.height !== frame.height)
          throw new Error(`Incorrect screenshot bounds: ${frame.id}`)
        const image = `<svg xmlns="http://www.w3.org/2000/svg" width="${frame.width}" height="${frame.height}" viewBox="${clip.x} ${clip.y} ${clip.width} ${clip.height}"><image width="${reviewSheetSize.width}" height="${reviewSheetSize.height}" href="data:image/jpeg;base64,${jpeg}"/></svg>`
        await fs.writeFile(`${directory}/${frame.id}.svg`, image)
        await fs.writeFile(
          `${directory}/${frame.id}.html`,
          freezeAtlasHTML(dom)
        )
        await fs.writeFile(
          `${directory}/${frame.id}.json`,
          JSON.stringify(dom.index)
        )
        await fs.writeFile(
          `${directory}/${frame.id}.capture.json`,
          JSON.stringify({
            sourceRevision,
            capturedAt: new Date().toISOString(),
            imageFile: `${frame.id}.svg`,
            sourceViewport: reviewSheetSize,
            clip,
          })
        )
        captured++
      }
    } catch (error) {
      errors.push({ frameId: frames[0].id, message: error.message })
    }
  }
  return { next, captured, errors, elapsedMs: Date.now() - started }
}

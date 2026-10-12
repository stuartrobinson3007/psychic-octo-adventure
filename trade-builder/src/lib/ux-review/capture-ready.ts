/** Avatar images preload off-DOM, so waiting for visible <img>s alone is insufficient. */
export async function waitForReviewAssets(
  root: HTMLElement,
  signal: AbortSignal
) {
  const visible = (element: Element) => {
    const rect = element.getBoundingClientRect()
    return (
      rect.width > 0 &&
      rect.height > 0 &&
      rect.bottom > 0 &&
      rect.right > 0 &&
      rect.top < window.innerHeight &&
      rect.left < window.innerWidth
    )
  }
  await document.fonts.ready
  signal.throwIfAborted()
  await new Promise<void>((resolve, reject) => {
    const settled = () =>
      !Array.from(
        root.querySelectorAll(
          '[data-team-logo-status="idle"], [data-team-logo-status="loading"]'
        )
      ).some(visible) &&
      Array.from(root.querySelectorAll("img"))
        .filter(visible)
        .every((image) => image.complete)
    const cleanup = () => {
      observer.disconnect()
      window.clearTimeout(timeout)
      root.removeEventListener("load", check, true)
      root.removeEventListener("error", check, true)
      signal.removeEventListener("abort", abort)
    }
    const check = () => {
      if (!settled()) return
      cleanup()
      resolve()
    }
    const abort = () => {
      cleanup()
      reject(signal.reason)
    }
    const observer = new MutationObserver(check)
    const timeout = window.setTimeout(() => {
      cleanup()
      reject(
        new Error("Review images did not finish loading within 20 seconds.")
      )
    }, 20_000)
    observer.observe(root, { attributes: true, childList: true, subtree: true })
    root.addEventListener("load", check, true)
    root.addEventListener("error", check, true)
    signal.addEventListener("abort", abort, { once: true })
    check()
  })
  await Promise.all(
    Array.from(root.querySelectorAll("img"))
      .filter(visible)
      .map(async (image) => {
        if (image.naturalWidth > 0) await image.decode().catch(() => undefined)
      })
  )
  // Let avatar transitions and layout commit before freezing their rendered DOM.
  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  )
  signal.throwIfAborted()
}

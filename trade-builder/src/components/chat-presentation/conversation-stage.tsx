import { useEffect, useRef, useState } from "react"

/** Freeze the production renderer's DOM, preserving real layout and scroll areas. */
function freezeDocument(document: Document) {
  const root = document.documentElement.cloneNode(true) as HTMLElement
  const elements = document.documentElement.querySelectorAll<HTMLElement>("*")
  root.querySelectorAll<HTMLElement>("*").forEach((element, index) => {
    if (elements[index].scrollTop)
      element.setAttribute(
        "data-presentation-scroll-top",
        String(elements[index].scrollTop)
      )
    if (elements[index].scrollLeft)
      element.setAttribute(
        "data-presentation-scroll-left",
        String(elements[index].scrollLeft)
      )
  })
  // React updates native input properties; serialize those into the frozen HTML.
  const inputs = document.querySelectorAll<HTMLInputElement>("input")
  root.querySelectorAll<HTMLInputElement>("input").forEach((input, index) => {
    input.setAttribute("value", inputs[index].value)
    if (input.type === "checkbox" || input.type === "radio")
      input.toggleAttribute("checked", inputs[index].checked)
  })
  root
    .querySelectorAll("script, iframe, object, embed, base")
    .forEach((node) => node.remove())
  root.querySelectorAll("*").forEach((element) => {
    for (const attribute of element.getAttributeNames()) {
      if (attribute.startsWith("on")) element.removeAttribute(attribute)
    }
    element.removeAttribute("autofocus")
    element.removeAttribute("data-pending-scroll")
    if (
      element.matches(
        "button, input, textarea, select, a, [contenteditable], [role=button]"
      )
    ) {
      element.setAttribute("inert", "")
      element.setAttribute("tabindex", "-1")
    }
    if (element.hasAttribute("contenteditable"))
      element.setAttribute("contenteditable", "false")
    if (element.tagName === "FORM") {
      element.removeAttribute("action")
      element.removeAttribute("method")
    }
  })
  const style = document.createElement("style")
  style.textContent = `
    *, *::before, *::after { animation: none !important; transition: none !important; }
    [data-slot="message-scroller-item"] { content-visibility: visible !important; }
    [data-slot="scroll-area-scrollbar"], [data-slot="message-scroller-button"], .chat-reset-fab { display: none !important; }
    .conversation-scroll { overflow-y: auto !important; scrollbar-width: thin; scrollbar-color: #a1a1aa transparent; }
    [inert] { opacity: 1; }
  `
  root.querySelector("head")?.append(style)
  return `<!doctype html>${root.outerHTML}`
}

export function ConversationStage({
  scenarioId,
  step,
  phase,
  title,
  stageIndex,
  load,
  onSettled,
  onRetry,
  onHorizontalScroll,
}: {
  scenarioId: string
  step: number
  phase: "input" | "response"
  title: string
  stageIndex: number
  load: boolean
  onSettled: (index: number) => void
  onRetry: (index: number) => void
  onHorizontalScroll: (delta: number) => void
}) {
  const host = useRef<HTMLDivElement>(null)
  const source = useRef<HTMLIFrameElement>(null)
  const frozen = useRef<HTMLIFrameElement>(null)
  const [snapshot, setSnapshot] = useState<string>()
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string>()
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!load || snapshot || error) return
    const placeSource = () => {
      const frame = source.current
      const screen = host.current
      const strip = screen?.closest<HTMLElement>(".presentation-timeline")
      if (!frame || !screen || !strip) return
      const box = screen.getBoundingClientRect()
      // Prepare offscreen stages over the visible canvas so lazy images can load.
      Object.assign(frame.style, {
        position: "fixed",
        inset: "auto",
        left: `${strip.getBoundingClientRect().left + parseFloat(getComputedStyle(strip).paddingLeft)}px`,
        top: `${box.top}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
      })
    }
    placeSource()
    const observer = new ResizeObserver(placeSource)
    if (host.current) observer.observe(host.current)
    return () => observer.disconnect()
  }, [load, snapshot, error, attempt])

  useEffect(() => {
    if (error) onSettled(stageIndex)
  }, [error, onSettled, stageIndex])

  useEffect(() => {
    if (!load || snapshot || error) return
    const checkpoint = `${scenarioId}:${step}:${phase}`
    const check = () => {
      const document = source.current?.contentDocument
      if (document?.documentElement.dataset.reviewReady === checkpoint) {
        setSnapshot(freezeDocument(document))
      } else if (document?.documentElement.dataset.reviewError) {
        setError("Couldn't load this screen.")
      }
    }
    const listener = (event: MessageEvent) => {
      if (
        event.origin === location.origin &&
        event.source === source.current?.contentWindow
      )
        check()
    }
    window.addEventListener("message", listener)
    const timeout = window.setTimeout(
      () => setError("Couldn't load this screen."),
      30_000
    )
    check()
    return () => {
      window.removeEventListener("message", listener)
      window.clearTimeout(timeout)
    }
  }, [load, snapshot, error, scenarioId, step, phase, attempt])

  useEffect(() => {
    if (!snapshot) return
    const iframe = frozen.current
    if (!iframe) return
    let cancelled = false
    let started = false
    let observer: ResizeObserver | undefined
    let removeWheel: (() => void) | undefined
    const loaded = async () => {
      if (started) return
      const document = iframe.contentDocument
      if (!document) return
      started = true
      await document.fonts.ready
      if (cancelled) return
      // Retain option-list positions so the chosen answer stays visible.
      document
        .querySelectorAll<HTMLElement>("[data-presentation-scroll-top]")
        .forEach((element) => {
          element.scrollTop = Number(
            element.getAttribute("data-presentation-scroll-top")
          )
        })
      document
        .querySelectorAll<HTMLElement>("[data-presentation-scroll-left]")
        .forEach((element) => {
          element.scrollLeft = Number(
            element.getAttribute("data-presentation-scroll-left")
          )
        })
      const viewport = document.querySelector<HTMLElement>(
        ".conversation-scroll"
      )
      const content = document.querySelector<HTMLElement>(
        '[data-slot="message-scroller-content"]'
      )
      const bottom = () => {
        if (viewport) viewport.scrollTop = viewport.scrollHeight
      }
      bottom()
      // Keep the initial position through image/font layout, then leave scrolling to the presenter.
      observer = new ResizeObserver(bottom)
      if (content) observer.observe(content)
      const release = () => observer?.disconnect()
      document.addEventListener("wheel", release, { once: true, passive: true })
      document.addEventListener("touchstart", release, {
        once: true,
        passive: true,
      })
      document.addEventListener("keydown", release, { once: true })
      const wheel = (event: WheelEvent) => {
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY) || event.shiftKey) {
          event.preventDefault()
          onHorizontalScroll(
            (event.shiftKey ? event.deltaY : event.deltaX) *
              (event.deltaMode === 1 ? 16 : 1)
          )
        }
      }
      document.addEventListener("wheel", wheel, { passive: false })
      removeWheel = () => document.removeEventListener("wheel", wheel)
      setReady(true)
      onSettled(stageIndex)
    }
    iframe.addEventListener("load", loaded)
    if (
      iframe.contentDocument?.readyState === "complete" &&
      iframe.contentDocument.URL === "about:srcdoc"
    )
      void loaded()
    return () => {
      cancelled = true
      iframe.removeEventListener("load", loaded)
      observer?.disconnect()
      removeWheel?.()
    }
  }, [snapshot, onHorizontalScroll, onSettled, stageIndex])

  return (
    <div
      className="presentation-screen"
      ref={host}
      aria-busy={!ready && !error}
    >
      {!ready && (
        <div
          className="presentation-screen-status"
          role={error ? "alert" : "status"}
        >
          <span>{error ?? "Loading screen…"}</span>
          {error && (
            <button
              onClick={() => {
                setError(undefined)
                setSnapshot(undefined)
                setReady(false)
                setAttempt((value) => value + 1)
                onRetry(stageIndex)
              }}
            >
              Try again
            </button>
          )}
        </div>
      )}
      {load && !snapshot && !error && (
        <iframe
          key={attempt}
          ref={source}
          title={`Preparing ${title}`}
          aria-hidden="true"
          tabIndex={-1}
          className="presentation-source"
          src={`/chat-presentation-frame?scenario=${encodeURIComponent(scenarioId)}&step=${step}&phase=${phase}`}
        />
      )}
      {snapshot && (
        <iframe
          ref={frozen}
          title={title}
          sandbox="allow-same-origin"
          srcDoc={snapshot}
          className={ready ? "" : "presentation-source"}
        />
      )}
    </div>
  )
}

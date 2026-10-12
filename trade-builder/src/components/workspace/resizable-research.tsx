import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react"
import type { CSSProperties, ReactNode } from "react"
import type { PanelImperativeHandle } from "react-resizable-panels"
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"

type Pane = "players" | "inspector" | "saved" | "picks"
type Widths = Record<Pane, number>
const defaults: Widths = {
  players: 360,
  inspector: 520,
  saved: 460,
  picks: 460,
}
const minimums: Widths = {
  players: 320,
  inspector: 400,
  saved: 360,
  picks: 360,
}
const widthCaps: Widths = {
  players: 480,
  inspector: 800,
  saved: 600,
  picks: 600,
}
const chatMinimum = 480

export function useResearchResize(listOpen: boolean, inspectorOpen: boolean) {
  const [element, setElement] = useState<HTMLElement | null>(null)
  const [containerWidth, setContainerWidth] = useState(0)
  const [preferred, setPreferred] = useState<Partial<Widths>>({})
  const [resizing, setResizing] = useState(false)
  const active = useRef<Pane | null>(null)
  useEffect(() => {
    if (!element) return
    const observer = new ResizeObserver(([entry]) => {
      setContainerWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])
  const mobile = containerWidth > 0 && containerWidth < 768
  const compact = containerWidth > 0 && containerWidth < 1200
  const available = Math.max(0, containerWidth - (compact ? 360 : chatMinimum))
  const widths = Object.fromEntries(
    (Object.keys(defaults) as Array<Pane>).map((pane) => [
      pane,
      mobile
        ? containerWidth
        : Math.min(
            Math.max(
              minimums[pane],
              preferred[pane] ??
                (compact ? containerWidth * 0.46 : defaults[pane])
            ),
            containerWidth ? available : defaults[pane],
            widthCaps[pane]
          ),
    ])
  ) as Widths
  // Fit both research panes while preserving space for the conversation.
  if (!compact && listOpen && inspectorOpen && containerWidth) {
    const excess = widths.players + widths.inspector - available
    if (excess > 0) {
      const listRoom = widths.players - minimums.players
      const inspectorRoom = widths.inspector - minimums.inspector
      const room = listRoom + inspectorRoom
      widths.players -= excess * (listRoom / room)
      widths.inspector -= excess * (inspectorRoom / room)
    }
  }
  const maximums: Widths = {
    players: Math.min(
      widthCaps.players,
      Math.max(
        minimums.players,
        available - (!compact && inspectorOpen ? widths.inspector : 0)
      )
    ),
    inspector: Math.min(
      widthCaps.inspector,
      Math.max(
        minimums.inspector,
        available - (!compact && listOpen ? widths.players : 0)
      )
    ),
    saved: Math.min(widthCaps.saved, Math.max(minimums.saved, available)),
    picks: Math.min(widthCaps.picks, Math.max(minimums.picks, available)),
  }
  const finish = useCallback(() => {
    active.current = null
    // Keep width transitions disabled until the final resize has painted.
    requestAnimationFrame(() => {
      if (!active.current) setResizing(false)
    })
  }, [])
  useEffect(() => {
    // The library listens on document capture; start keyboard resizing at the
    // window first, before its native arrow-key handler changes the layout.
    const keyboard = (event: KeyboardEvent) => {
      if (
        !["ArrowLeft", "ArrowRight", "Home", "End", "Enter"].includes(event.key)
      )
        return
      const target = event.target
      if (!(target instanceof HTMLElement)) return
      const pane = target.dataset.researchResizePane as Pane | undefined
      if (pane) {
        active.current = pane
        setResizing(true)
      }
    }
    // Match shadcn's expanded separator hit target, including clicks beside the
    // one-pixel divider rather than directly on its DOM element.
    const pointer = (event: PointerEvent) => {
      if (!element || element.clientWidth < 768) return
      const radius = event.pointerType === "touch" ? 12 : 6
      for (const handle of element.querySelectorAll<HTMLElement>(
        '.research-pane[data-open="true"] [data-research-resize-pane]'
      )) {
        const rect = handle.getBoundingClientRect()
        if (
          rect.width &&
          Math.abs(event.clientX - (rect.left + rect.width / 2)) <= radius &&
          event.clientY >= rect.top &&
          event.clientY <= rect.bottom
        ) {
          active.current = handle.dataset.researchResizePane as Pane
          setResizing(true)
          break
        }
      }
    }
    window.addEventListener("pointerdown", pointer, true)
    window.addEventListener("keydown", keyboard, true)
    window.addEventListener("keyup", finish)
    window.addEventListener("pointerup", finish)
    window.addEventListener("pointercancel", finish)
    window.addEventListener("blur", finish)
    return () => {
      window.removeEventListener("pointerdown", pointer, true)
      window.removeEventListener("keydown", keyboard, true)
      window.removeEventListener("keyup", finish)
      window.removeEventListener("pointerup", finish)
      window.removeEventListener("pointercancel", finish)
      window.removeEventListener("blur", finish)
    }
  }, [finish, element])
  return {
    ref: setElement,
    style: (containerWidth
      ? {
          "--player-list-width": `${widths.players}px`,
          "--player-inspector-width": `${widths.inspector}px`,
          "--saved-pane-width": `${widths.saved}px`,
          "--pick-pane-width": `${widths.picks}px`,
        }
      : undefined) as CSSProperties | undefined,
    resizing,
    value: {
      containerWidth,
      widths,
      maximums,
      mobile,
      resizing,
      active,
      start: (pane: Pane) => {
        active.current = pane
        setResizing(true)
      },
      finish,
      resize: (pane: Pane, width: number) => {
        if (active.current === pane)
          setPreferred((previous) => ({ ...previous, [pane]: width }))
      },
    },
  }
}

const ResizeContext = createContext<
  ReturnType<typeof useResearchResize>["value"] | null
>(null)
export const ResearchResizeProvider = ResizeContext.Provider

/** The transparent leading panel represents the available workspace. Keeping the
 * group inside the animated shell leaves its slide lifecycle untouched. */
export function ResizableResearch({
  pane,
  open,
  children,
}: {
  pane: Pane
  open: boolean
  children: ReactNode
}) {
  const resize = useContext(ResizeContext)
  const panelRef = useRef<PanelImperativeHandle | null>(null)
  if (!resize) throw new Error("ResizableResearch needs ResearchResizeProvider")
  const { containerWidth, widths, maximums, mobile } = resize
  const initialSize = useRef(defaults[pane] - 1)
  const handleWidth = mobile ? 0 : 1
  const contentWidth = widths[pane] - handleWidth
  useEffect(() => {
    if (
      containerWidth &&
      !resize.active.current &&
      Math.abs((panelRef.current?.getSize().inPixels ?? 0) - contentWidth) > 0.5
    ) {
      panelRef.current?.resize(contentWidth)
    }
  }, [
    containerWidth,
    contentWidth,
    open,
    mobile,
    maximums[pane],
    resize.resizing,
  ])
  // Wait for a real workspace measurement. Mounting with zero available space
  // constrains the initial layout to minimum widths, which can survive opening.
  if (!containerWidth) {
    return (
      <div className="research-resize-content flex h-full min-w-0 flex-col bg-background">
        {children}
      </div>
    )
  }
  const contentPercentage =
    (contentWidth / (containerWidth - handleWidth)) * 100
  return (
    <ResizablePanelGroup
      id={`research-resize-${pane}`}
      orientation="horizontal"
      defaultLayout={{
        [`${pane}-space`]: 100 - contentPercentage,
        [`${pane}-content`]: contentPercentage,
      }}
      className="research-resize-group pointer-events-none absolute inset-y-0 right-0"
      style={{ width: containerWidth || "100cqw" }}
      disabled={!open || mobile}
      resizeTargetMinimumSize={{ coarse: 24, fine: 12 }}
      onLayoutChange={(layout) => {
        const percentage = layout[`${pane}-content`]
        if (containerWidth) {
          resize.resize(
            pane,
            (percentage / 100) * (containerWidth - handleWidth) + handleWidth
          )
        }
      }}
      onLayoutChanged={(_layout, meta) => {
        if (meta.isUserInteraction) resize.finish()
      }}
    >
      <ResizablePanel
        id={`${pane}-space`}
        minSize={mobile ? 0 : Math.max(0, containerWidth - maximums[pane])}
        className="research-resize-space pointer-events-none"
        aria-hidden
      />
      <ResizableHandle
        withHandle
        className="research-resize-handle shrink-0 max-md:hidden"
        aria-label={`Resize ${pane === "players" ? "player list" : pane === "inspector" ? "player details and comparison" : pane === "picks" ? "draft picks" : "saved trades"}`}
        onPointerDownCapture={() => resize.start(pane)}
        data-research-resize-pane={pane}
        onDoubleClickCapture={() => resize.start(pane)}
      />
      <ResizablePanel
        id={`${pane}-content`}
        panelRef={panelRef}
        defaultSize={initialSize.current}
        minSize={mobile ? containerWidth : minimums[pane] - handleWidth}
        maxSize={
          mobile ? containerWidth || "100%" : maximums[pane] - handleWidth
        }
        groupResizeBehavior="preserve-pixel-size"
        className="research-resize-content flex h-full min-w-0 flex-col bg-background"
        onResize={(size) => {
          // Registration (including hot reload and changing constraints) can
          // reset the primitive's layout after the synchronization effect ran.
          // Check the rendered size as well, so the handle and shell agree.
          if (
            containerWidth &&
            !resize.active.current &&
            Math.abs(size.inPixels - contentWidth) > 1
          ) {
            panelRef.current?.resize(contentWidth)
          }
        }}
      >
        {children}
      </ResizablePanel>
    </ResizablePanelGroup>
  )
}

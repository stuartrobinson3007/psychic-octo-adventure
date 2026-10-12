import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuGroup,
} from "@/components/ui/dropdown-menu"
import { useEffect, useRef, useState } from "react"
import { Effect, Fiber, Schema } from "effect"
import { CatalogueResultSchema } from "@/lib/trade/roster-schemas"
import {
  useWorkspaceRequests,
  workspaceRequest,
} from "./use-workspace-requests"
import {
  Basketball01Icon,
  Bookmark02Icon,
  Refresh01Icon,
  UserGroupIcon,
  Ticket01Icon,
} from "@hugeicons/core-free-icons"
import { ChatPanel } from "./chat-panel"
import {
  WorkspaceLoading,
  WorkspaceDataError,
  ConversationConnectionError,
} from "./workspace-status"
import { Icon } from "./icons"
import { PickBrowser } from "./pick-browser"
import { PlayerBrowser } from "./player-browser"
import { SavedTrades } from "./saved-trades"
import { ResearchContext } from "./research-context"
import {
  ResearchResizeProvider,
  ResizableResearch,
  useResearchResize,
} from "./resizable-research"
import { useTradeWorkspace } from "./use-trade-workspace"
import type { WorkspacePreview } from "./use-trade-workspace"
import type { TradeRecord } from "./trade-card"
import type { ComposerDraft, ComposerHandle } from "./composer/trade-composer"
import type { Catalogue, DraftPick, Player } from "@/lib/trade/types"
import {
  getTradeCatalogue,
  refreshTradeCatalogue,
} from "@/server/trade-functions"

export function WorkspaceLayout({
  preview,
}: { preview?: WorkspacePreview } = {}) {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadVersion, setLoadVersion] = useState(0)
  const [refreshing, setRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState(false)
  const runRequest = useWorkspaceRequests(loadVersion)
  useEffect(() => {
    let active = true
    const loadingFiber = Effect.runFork(
      workspaceRequest((signal) => getTradeCatalogue({ signal })).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(CatalogueResultSchema)),
        Effect.tap((result) =>
          Effect.sync(() => setCatalogue(result.catalogue))
        ),
        Effect.timeout("60 seconds"),
        Effect.catch(() =>
          Effect.sync(() => {
            if (active) setCatalogue(null)
          })
        ),
        Effect.ensuring(
          Effect.sync(() => {
            if (active) setLoading(false)
          })
        )
      )
    )
    return () => {
      active = false
      Effect.runFork(Fiber.interrupt(loadingFiber))
    }
  }, [loadVersion])
  if (loading) return <WorkspaceLoading />
  if (!catalogue)
    return (
      <WorkspaceDataError
        onRetry={() => {
          setLoading(true)
          setLoadVersion((version) => version + 1)
        }}
      />
    )
  const refresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    setRefreshError(false)
    await runRequest((active) =>
      workspaceRequest((signal) => refreshTradeCatalogue({ signal })).pipe(
        Effect.flatMap(Schema.decodeUnknownEffect(CatalogueResultSchema)),
        Effect.tap((result) =>
          Effect.sync(() => {
            if (result.catalogue) setCatalogue(result.catalogue)
            else setRefreshError(true)
          })
        ),
        Effect.timeout("55 seconds"),
        Effect.catch(() => Effect.sync(() => setRefreshError(true))),
        Effect.ensuring(
          Effect.sync(() => {
            if (active()) setRefreshing(false)
          })
        )
      )
    ).catch(() => undefined)
  }

  return (
    <TradeWorkspace
      catalogue={catalogue}
      preview={preview}
      refreshing={refreshing}
      refreshError={refreshError}
      onRefresh={() => void refresh()}
    />
  )
}

function TradeWorkspace({
  catalogue,
  preview,
  refreshing,
  refreshError,
  onRefresh,
}: {
  refreshing: boolean
  refreshError: boolean
  onRefresh: () => void
  catalogue: Catalogue
  preview?: WorkspacePreview
}) {
  const [mode, setModeState] = useState<"players" | "picks" | "saved" | null>(
    null
  )
  const setMode = (next: "players" | "picks" | "saved" | null) => {
    if (next === "players" && matchMedia("(max-width: 1199px)").matches) {
      setInspectorOpen(false)
    }
    if (next === "picks" || next === "saved") setInspectorOpen(false)
    setModeState(next)
  }
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const researchOpen =
    mode === "saved" || mode === "picks" || mode === "players" || inspectorOpen
  const researchResize = useResearchResize(
    mode === "players",
    mode !== "saved" && mode !== "picks" && inspectorOpen
  )
  const [inspection, setInspection] = useState<{
    playerId: number
    sequence: number
  } | null>(null)
  const [pickInspection, setPickInspection] = useState<{
    pickId: number
    sequence: number
  } | null>(null)
  const [draftPickIds, setDraftPickIds] = useState<Array<number>>([])
  const [announcement, setAnnouncement] = useState("")
  const composerRef = useRef<ComposerHandle | null>(null)
  const workspace = useTradeWorkspace(catalogue, preview)
  const resetChat = () => {
    if (!workspace.resetChat()) return
    setMode(null)
    setInspectorOpen(false)
    composerRef.current?.clear()
    composerRef.current?.focus()
  }
  const closeResearch = () => {
    setMode(null)
    setInspectorOpen(false)
    composerRef.current?.focus()
  }
  const insert = (player: Player) => {
    if (matchMedia("(max-width: 767px)").matches) closeResearch()
    composerRef.current?.insertPlayer(player)
  }
  const insertPick = (pick: DraftPick) => {
    if (draftPickIds.includes(pick.id)) return
    if (matchMedia("(max-width: 767px)").matches) closeResearch()
    composerRef.current?.insertPick(pick)
    setAnnouncement(
      `${pick.year} ${pick.round === 1 ? "first" : "second"}-round pick added to message.`
    )
  }
  const inspectPick = (pick: DraftPick) => {
    setMode("picks")
    setPickInspection((previous) => ({
      pickId: pick.id,
      sequence: (previous?.sequence ?? 0) + 1,
    }))
  }
  const inspectPlayer = (player: Player) => {
    if (mode === "saved" || mode === "picks") setModeState(null)
    setInspectorOpen(true)
    setInspection((previous) => ({
      playerId: player.id,
      sequence: (previous?.sequence ?? 0) + 1,
    }))
  }
  const submit = (draft: ComposerDraft) => {
    if (!workspace.ready || workspace.busy) return
    composerRef.current?.clear()
    void workspace.submit(draft)
  }
  const view = (record: TradeRecord) => {
    if (matchMedia("(max-width: 767px)").matches) closeResearch()
    workspace.view(record)
  }
  if (workspace.loading) return <WorkspaceLoading />
  return (
    <ResearchContext value={catalogue}>
      <TooltipProvider>
        <div className="gambit-app isolate flex h-dvh flex-col text-sm leading-data text-foreground antialiased selection:bg-primary/18 max-md:text-base">
          <header className="app-header flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border px-3.5 md:px-7">
            <div className="flex shrink-0 items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="sm"
                      className="app-brand flex items-center gap-2.5 text-base leading-none font-semibold max-md:h-11"
                      aria-label="Chat options"
                    />
                  }
                >
                  <Icon
                    icon={Basketball01Icon}
                    className="size-5"
                    data-icon="inline-start"
                  />
                  <span className="leading-none">Gambit</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuGroup>
                    <DropdownMenuItem
                      disabled={workspace.busy || !workspace.ready}
                      onClick={resetChat}
                    >
                      <Icon icon={Refresh01Icon} />
                      Reset chat
                    </DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
              <Badge
                variant="secondary"
                className="hidden h-7 px-3 text-sm md:inline-flex"
              >
                Trade Machine
              </Badge>
            </div>
            <nav
              className="flex shrink-0 items-center gap-1.5"
              aria-label="Workspace views"
            >
              <Button
                variant="ghost"
                aria-expanded={mode === "players"}
                onClick={() => setMode(mode === "players" ? null : "players")}
              >
                <Icon icon={UserGroupIcon} data-icon="inline-start" />
                <span className="max-md:sr-only">Players</span>
              </Button>
              <Button
                variant="ghost"
                aria-expanded={mode === "picks"}
                onClick={() => setMode(mode === "picks" ? null : "picks")}
              >
                <Icon icon={Ticket01Icon} data-icon="inline-start" />
                <span className="max-md:sr-only">Draft picks</span>
              </Button>
              <Button
                variant="ghost"
                aria-expanded={mode === "saved"}
                onClick={() => setMode(mode === "saved" ? null : "saved")}
                className="relative"
              >
                <Icon icon={Bookmark02Icon} data-icon="inline-start" />
                <span className="max-md:sr-only">Saved trades</span>
                {workspace.saved.length > 0 && (
                  <Badge
                    variant="secondary"
                    className="max-md:absolute max-md:top-0 max-md:right-0 max-md:h-4 max-md:min-w-4 max-md:px-1 max-md:text-xs"
                  >
                    {workspace.saved.length}
                  </Badge>
                )}
              </Button>
            </nav>
          </header>
          <ResearchResizeProvider value={researchResize.value}>
            <main
              ref={researchResize.ref}
              style={researchResize.style}
              data-resizing={researchResize.resizing}
              className="workspace-content relative flex min-h-0 w-full flex-1 justify-start overflow-clip"
              data-research={researchOpen}
              data-list-open={mode === "players"}
              data-inspector-open={
                mode !== "saved" && mode !== "picks" && inspectorOpen
              }
              data-saved-open={mode === "saved"}
              data-picks-open={mode === "picks"}
            >
              <div className="chat-frame t-resize relative flex min-h-0 min-w-0 shrink-0 flex-col [&>[data-slot=alert]]:shrink-0">
                {workspace.connectionError && (
                  <ConversationConnectionError
                    onRetry={workspace.retryConnection}
                  />
                )}
                <ChatPanel
                  catalogue={catalogue}
                  entries={workspace.entries}
                  saved={workspace.saved}
                  expanded={workspace.expanded}
                  busy={workspace.busy}
                  storageError={workspace.storageError}
                  pendingClarification={workspace.pendingClarification}
                  toolProgress={workspace.toolProgress}
                  composerRef={composerRef}
                  onSubmit={submit}
                  onBrowseIdeas={workspace.browseIdeas}
                  onRefreshSearch={workspace.refreshSearch}
                  refreshingSearch={workspace.refreshingSearch}
                  onRetry={workspace.retry}
                  retryEntryId={workspace.retryEntryId}
                  retryDisabled={!workspace.ready}
                  onInspectPick={inspectPick}
                  onDraftChange={(draft) =>
                    setDraftPickIds(draft.pickIds ?? [])
                  }
                  onInspectPlayer={inspectPlayer}
                  onSave={workspace.toggleSave}
                  onExpand={workspace.toggleExpanded}
                  onCheck={(record) => {
                    void workspace.check(record)
                  }}
                />
              </div>
              <aside
                className="research-frame pointer-events-none absolute inset-y-0 right-0 w-full min-w-0"
                data-open={researchOpen}
                inert={!researchOpen}
                aria-hidden={!researchOpen}
                aria-label="Research workspace"
              >
                <div className="research-surface pointer-events-none absolute inset-0">
                  <div className="research-mode h-full">
                    <PlayerBrowser
                      catalogue={catalogue}
                      onInsert={insert}
                      listOpen={mode === "players"}
                      inspectorOpen={
                        mode !== "saved" && mode !== "picks" && inspectorOpen
                      }
                      onListOpenChange={(open) => {
                        setMode(open ? "players" : null)
                        if (!open && !inspectorOpen)
                          composerRef.current?.focus()
                      }}
                      onInspectorOpenChange={setInspectorOpen}
                      onCloseInspector={() => {
                        setInspectorOpen(false)
                        if (mode === "players") {
                          document
                            .getElementById("player-browser-search")
                            ?.focus()
                        } else {
                          composerRef.current?.focus()
                        }
                      }}
                      inspection={inspection}
                    />
                  </div>
                  <PickBrowser
                    catalogue={catalogue}
                    open={mode === "picks"}
                    onClose={closeResearch}
                    onInsert={insertPick}
                    inMessage={draftPickIds}
                    currentTrade={workspace.snapshot}
                    refreshing={refreshing}
                    refreshError={refreshError}
                    onRefresh={onRefresh}
                    inspection={pickInspection}
                  />
                  <div
                    className="research-pane saved-pane t-panel-slide absolute inset-y-0 right-0 h-full min-w-0 border-l border-border bg-background max-md:border-l-0"
                    data-open={mode === "saved"}
                    inert={mode !== "saved"}
                    aria-hidden={mode !== "saved"}
                  >
                    <ResizableResearch pane="saved" open={mode === "saved"}>
                      <SavedTrades
                        records={workspace.saved}
                        onInspectPlayer={inspectPlayer}
                        onView={view}
                        onRemove={workspace.toggleSave}
                        onClose={() => {
                          setMode(null)
                          composerRef.current?.focus()
                        }}
                      />
                    </ResizableResearch>
                  </div>
                </div>
              </aside>
            </main>
          </ResearchResizeProvider>
          <span role="status" className="sr-only">
            {announcement}
          </span>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="outline"
                  size="icon-lg"
                  className="chat-reset-fab fixed right-[max(20px,env(safe-area-inset-right))] bottom-[max(20px,env(safe-area-inset-bottom))] z-40 size-11 rounded-full shadow-[0_3px_12px_rgb(0_0_0/10%)]"
                  aria-label="Reset chat"
                  disabled={workspace.busy || !workspace.ready}
                  onClick={resetChat}
                />
              }
            >
              <Icon icon={Refresh01Icon} />
            </TooltipTrigger>
            <TooltipContent side="left">Reset chat</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </ResearchContext>
  )
}

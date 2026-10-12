import { InputGroup, InputGroupAddon } from "@/components/ui/input-group"
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldDescription,
} from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "cn"
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react"
import type { Ref } from "react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { PlainTextPlugin } from "@lexical/react/LexicalPlainTextPlugin"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $getNodeByKey,
  $isElementNode,
  $isRangeSelection,
  $setSelection,
  COMMAND_PRIORITY_HIGH,
  KEY_DOWN_COMMAND,
  PASTE_COMMAND,
} from "lexical"
import type { LexicalEditor, RangeSelection } from "lexical"
import { ArrowUp02Icon } from "@hugeicons/core-free-icons"
import { Icon } from "@/components/workspace/icons"
import {
  PlayerInspectionContext,
  useCatalogue,
} from "@/components/workspace/research-context"
import { PlayerPicker } from "./player-picker"
import { PlayerTokenNode, $isPlayerToken } from "./player-token"
import { PickTokenNode, $isPickToken } from "./pick-token"
import { pickLabel } from "@/lib/trade/picks"
import type { MessagePickReference } from "@/lib/message-pick-references"
import type {
  DraftPick,
  Player,
  ClarificationOption,
  ClarificationAnswer,
} from "@/lib/trade/types"
import type { MessagePlayerReference } from "@/lib/message-player-references"
import { clarificationReply } from "@/lib/trade-clarification"

export interface ComposerDraft {
  selection?: ClarificationOption
  selections?: Array<ClarificationOption>
  text: string
  playerIds: Array<number>
  pickIds?: Array<number>
  pickReferences?: Array<MessagePickReference>
  unresolved: number
  clarificationAnswer?: ClarificationAnswer
  cancelQuestionId?: string
  playerReferences?: Array<MessagePlayerReference>
}
export interface ComposerHandle {
  insertPlayer: (player: Player) => void
  insertPick: (pick: DraftPick) => void
  setDraft: (
    text: string,
    references?: Array<MessagePlayerReference>,
    pickReferences?: Array<MessagePickReference>
  ) => void
  clear: () => void
  focus: () => void
  submit: () => void
}

function $readDraft(): ComposerDraft {
  const ids: Array<number> = []
  const pickIds: Array<number> = []
  const pickReferences: Array<MessagePickReference> = []
  const playerReferences: Array<MessagePlayerReference> = []
  const text = $getRoot().getTextContent()
  let cursor = 0
  let unresolved = 0
  for (const paragraph of $getRoot().getChildren()) {
    if ($isElementNode(paragraph)) {
      const start = text.indexOf(paragraph.getTextContent(), cursor)
      let offset = start < 0 ? cursor : start
      for (const node of paragraph.getChildren()) {
        const length = node.getTextContent().length
        if ($isPlayerToken(node)) {
          const ref = node.getReference()
          if (ref.playerId !== null) {
            ids.push(ref.playerId)
            playerReferences.push({
              start: offset,
              end: offset + length,
              playerId: ref.playerId,
            })
          } else unresolved++
        }
        if ($isPickToken(node)) {
          const ref = node.getReference()
          pickIds.push(ref.pickId)
          pickReferences.push({
            start: offset,
            end: offset + length,
            pickId: ref.pickId,
            ownerTeamId: ref.ownerTeamId,
          })
        }
        offset += length
      }
      cursor = offset
    }
  }
  return {
    text,
    playerIds: [...new Set(ids)],
    pickIds: [...new Set(pickIds)],
    pickReferences,
    unresolved,
    playerReferences,
  }
}

function EditorBridge({
  editorRef,
  onDraftChange,
  onHash,
  onSend,
  busy,
}: {
  editorRef: React.RefObject<LexicalEditor | null>
  onDraftChange: (draft: ComposerDraft) => void
  onHash: () => void
  onSend: () => void
  busy: boolean
}) {
  const [editor] = useLexicalComposerContext()
  const callbacks = useRef({ onDraftChange, onHash, onSend, busy })
  callbacks.current = { onDraftChange, onHash, onSend, busy }
  useEffect(() => {
    editorRef.current = editor
    return () => {
      editorRef.current = null
    }
  }, [editor, editorRef])
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => callbacks.current.onDraftChange($readDraft()))
    })
  }, [editor])
  useEffect(
    () =>
      editor.registerCommand(
        KEY_DOWN_COMMAND,
        (event) => {
          if (event.isComposing || editor.isComposing()) return false
          if (event.key === "#") {
            event.preventDefault()
            callbacks.current.onHash()
            return true
          }
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault()
            if (!callbacks.current.busy) callbacks.current.onSend()
            return true
          }
          return false
        },
        COMMAND_PRIORITY_HIGH
      ),
    [editor]
  )
  // Adapted from Limesite MVP's Lexical editor: paste only plain text and keep history native.
  useEffect(
    () =>
      editor.registerCommand(
        PASTE_COMMAND,
        (event) => {
          if (!("clipboardData" in event)) return false
          const text = event.clipboardData?.getData("text/plain")
          if (text == null) return false
          event.preventDefault()
          const selection = $getSelection()
          if ($isRangeSelection(selection)) selection.insertRawText(text)
          return true
        },
        COMMAND_PRIORITY_HIGH
      ),
    [editor]
  )
  return null
}

export function TradeComposer({
  ref,
  onSubmit,
  onInspectPlayer,
  busy = false,
  attached = false,
  answer,
  answers,
  questionId,
  selectionValid = true,
  placeholder = "Describe a trade, or type # to find a player…",
  onDraftChange,
}: {
  ref?: Ref<ComposerHandle>
  onSubmit: (draft: ComposerDraft) => void
  onInspectPlayer: (player: Player) => void
  busy?: boolean
  attached?: boolean
  answer?: ClarificationOption
  answers?: Array<ClarificationOption>
  questionId?: string
  selectionValid?: boolean
  placeholder?: string
  onDraftChange?: (draft: ComposerDraft) => void
}) {
  const catalogue = useCatalogue()
  const editorRef = useRef<LexicalEditor | null>(null)
  const selectionRef = useRef<RangeSelection | null>(null)
  const [draft, setDraft] = useState<ComposerDraft>({
    text: "",
    playerIds: [],
    unresolved: 0,
  })
  const [searchOpen, setSearchOpen] = useState(false)
  const initialConfig = useMemo(
    () => ({
      namespace: "GambitComposer",
      nodes: [PlayerTokenNode, PickTokenNode],
      theme: {
        paragraph: "composer-paragraph m-0 leading-[max(1.6em,1.75rem)]",
      },
      onError: (error: Error) => {
        throw error
      },
    }),
    []
  )
  const rememberCaret = useCallback(() => {
    editorRef.current?.getEditorState().read(() => {
      const selection = $getSelection()
      if ($isRangeSelection(selection)) selectionRef.current = selection.clone()
    })
  }, [])
  const openSearch = useCallback(() => {
    rememberCaret()
    setSearchOpen(true)
  }, [rememberCaret])
  const closeSearch = useCallback(() => {
    setSearchOpen(false)
    editorRef.current?.focus()
  }, [])
  const insertToken = useCallback(
    (makeToken: () => PlayerTokenNode | PickTokenNode) => {
      const editor = editorRef.current
      if (!editor) return
      editor.update(
        () => {
          if (
            selectionRef.current &&
            $getNodeByKey(selectionRef.current.anchor.key) &&
            $getNodeByKey(selectionRef.current.focus.key)
          )
            $setSelection(selectionRef.current.clone())
          let selection = $getSelection()
          if (!$isRangeSelection(selection)) {
            $getRoot().selectEnd()
            selection = $getSelection()
          }
          if ($isRangeSelection(selection))
            selection.insertNodes([makeToken(), $createTextNode(" ")])
        },
        { discrete: true }
      )
      selectionRef.current = null
      setSearchOpen(false)
      editor.focus()
    },
    []
  )
  const insertPlayer = useCallback(
    (player: Player) =>
      insertToken(
        () =>
          new PlayerTokenNode({
            label: player.name,
            playerId: player.id,
            candidates: [player.id],
          })
      ),
    [insertToken]
  )
  const insertPick = useCallback(
    (pick: DraftPick) => {
      const current = editorRef.current?.getEditorState().read($readDraft)
      if (current?.pickIds?.includes(pick.id)) return
      insertToken(
        () =>
          new PickTokenNode({
            label: pickLabel(pick, catalogue),
            pickId: pick.id,
            ownerTeamId: pick.currentTeamId,
          })
      )
    },
    [insertToken, catalogue]
  )
  const setText = useCallback(
    (
      text: string,
      references: Array<MessagePlayerReference> = [],
      pickReferences: Array<MessagePickReference> = []
    ) => {
      const editor = editorRef.current
      if (!editor) return
      editor.update(
        () => {
          const paragraph = $createParagraphNode()
          let cursor = 0
          // Only explicit UI selections create badges. Typed names remain text.
          for (const reference of [...references, ...pickReferences].sort(
            (a, b) => a.start - b.start
          )) {
            const player =
              "playerId" in reference
                ? catalogue.players.find(
                    (candidate) => candidate.id === reference.playerId
                  )
                : undefined
            const pick =
              "pickId" in reference
                ? catalogue.draftPicks?.find(
                    (candidate) => candidate.id === reference.pickId
                  )
                : undefined
            if (
              (!player && !pick) ||
              !Number.isInteger(reference.start) ||
              !Number.isInteger(reference.end) ||
              reference.start < cursor ||
              reference.end <= reference.start ||
              reference.end > text.length
            )
              continue
            if (reference.start > cursor)
              paragraph.append(
                $createTextNode(text.slice(cursor, reference.start))
              )
            paragraph.append(
              player
                ? new PlayerTokenNode({
                    label: text.slice(reference.start, reference.end),
                    playerId: player.id,
                    candidates: [player.id],
                  })
                : new PickTokenNode({
                    label: text.slice(reference.start, reference.end),
                    pickId: pick!.id,
                    ownerTeamId:
                      "ownerTeamId" in reference
                        ? reference.ownerTeamId
                        : pick!.currentTeamId,
                  })
            )
            cursor = reference.end
          }
          if (cursor < text.length || !paragraph.getChildrenSize())
            paragraph.append($createTextNode(text.slice(cursor)))
          $getRoot().clear().append(paragraph)
          $getRoot().selectEnd()
        },
        { discrete: true }
      )
      selectionRef.current = null
      editor.focus()
    },
    [catalogue.players, catalogue.draftPicks]
  )
  const send = useCallback(() => {
    const editor = editorRef.current
    if (!editor || busy || !selectionValid) return
    const next = editor.getEditorState().read($readDraft)
    const choices = answers ?? (answer ? [answer] : [])
    const reply = clarificationReply(next, choices, questionId)
    if (reply.text.trim() && !reply.unresolved)
      onSubmit({ ...reply, selections: choices.length ? choices : undefined })
  }, [answer, answers, questionId, selectionValid, busy, onSubmit])
  useImperativeHandle(
    ref,
    () => ({
      insertPlayer,
      insertPick,
      setDraft: setText,
      clear: () => setText(""),
      focus: () => editorRef.current?.focus(),
      submit: send,
    }),
    [insertPlayer, insertPick, setText, send]
  )
  return (
    <PlayerInspectionContext value={onInspectPlayer}>
      <LexicalComposer initialConfig={initialConfig}>
        <FieldGroup>
          <Field>
            <FieldLabel className="sr-only" htmlFor="trade-message">
              Trade message
            </FieldLabel>
            <InputGroup
              className={cn(
                "composer-shell relative",
                attached &&
                  "rounded-none border-0 shadow-none has-[[data-slot=input-group-control]:focus-visible]:ring-0"
              )}
              onBlur={rememberCaret}
            >
              <div className="composer-editor-wrap relative w-full">
                <ScrollArea
                  className="max-h-48"
                  viewportClassName="max-h-48 overscroll-contain"
                >
                  <PlainTextPlugin
                    contentEditable={
                      <ContentEditable
                        id="trade-message"
                        data-slot="input-group-control"
                        className="composer-editor min-h-18 px-[18px] pt-4 pb-3 text-sm leading-[max(1.6em,1.75rem)] [overflow-wrap:anywhere] whitespace-pre-wrap caret-primary outline-none! focus-visible:-outline-offset-1 max-md:min-h-19 max-md:p-3.5"
                        aria-label="Trade message"
                        aria-placeholder={placeholder}
                        placeholder={
                          <div className="composer-placeholder pointer-events-none absolute top-4 right-[18px] left-[18px] text-sm leading-[max(1.6em,1.75rem)] text-muted-foreground max-md:inset-x-3.5 max-md:top-3.5">
                            {placeholder}
                          </div>
                        }
                        spellCheck={false}
                      />
                    }
                    placeholder={null}
                    ErrorBoundary={LexicalErrorBoundary}
                  />
                </ScrollArea>
              </div>
              <InputGroupAddon align="block-end" className="justify-between">
                <div className="flex items-center gap-1">
                  <PlayerPicker
                    open={searchOpen}
                    onOpen={openSearch}
                    onClose={closeSearch}
                    onSelect={insertPlayer}
                    onSelectPick={insertPick}
                    selectedPickIds={draft.pickIds ?? []}
                  />
                </div>
                <Button
                  type="button"
                  size="icon"
                  aria-label="Send message"
                  onClick={send}
                  disabled={
                    busy ||
                    (!draft.text.trim() && !(answers?.length || answer)) ||
                    !selectionValid ||
                    draft.unresolved > 0
                  }
                >
                  {busy ? (
                    <Spinner data-icon="inline-start" />
                  ) : (
                    <Icon icon={ArrowUp02Icon} data-icon="inline-start" />
                  )}
                </Button>
              </InputGroupAddon>
              <EditorBridge
                editorRef={editorRef}
                onDraftChange={(next) => {
                  setDraft(next)
                  onDraftChange?.(next)
                }}
                onHash={openSearch}
                onSend={send}
                busy={busy}
              />
              <HistoryPlugin />
            </InputGroup>
            {draft.unresolved > 0 && (
              <FieldDescription role="status">
                Choose a player for each amber reference to send.
              </FieldDescription>
            )}
          </Field>
        </FieldGroup>
      </LexicalComposer>
    </PlayerInspectionContext>
  )
}

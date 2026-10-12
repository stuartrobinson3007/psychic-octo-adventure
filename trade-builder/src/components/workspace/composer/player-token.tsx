import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useContext, useEffect, useRef, useState } from "react"
import { DecoratorNode, $getNodeByKey } from "lexical"
import type {
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { HashtagIcon, CircleQuestionMarkIcon } from "@hugeicons/core-free-icons"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
  PopoverTitle,
} from "@/components/ui/popover"
import { Icon } from "@/components/workspace/icons"
import { PlayerAvatar } from "@/components/workspace/player-avatar"
import { TeamMark } from "@/components/workspace/team-mark"
import {
  PlayerInspectionContext,
  useCatalogue,
} from "@/components/workspace/research-context"
import type { Player } from "@/lib/trade/types"
import type { ReactElement } from "react"

export interface PlayerReference {
  label: string
  candidates: Array<number>
  playerId: number | null
}
type SerializedPlayerToken = Spread<
  { reference: PlayerReference; type: "player-token"; version: 1 },
  SerializedLexicalNode
>

export class PlayerTokenNode extends DecoratorNode<ReactElement> {
  __reference: PlayerReference
  static getType() {
    return "player-token"
  }
  static clone(node: PlayerTokenNode) {
    return new PlayerTokenNode(node.__reference, node.__key)
  }
  constructor(reference: PlayerReference, key?: NodeKey) {
    super(key)
    this.__reference = reference
  }
  static importJSON(serialized: SerializedPlayerToken) {
    return new PlayerTokenNode(serialized.reference)
  }
  exportJSON(): SerializedPlayerToken {
    return {
      ...super.exportJSON(),
      reference: this.__reference,
      type: "player-token",
      version: 1,
    }
  }
  createDOM() {
    const span = document.createElement("span")
    span.className = "player-token-host"
    return span
  }
  updateDOM() {
    return false
  }
  isInline() {
    return true
  }
  getTextContent() {
    return this.__reference.label
  }
  getReference() {
    return this.getLatest().__reference
  }
  resolve(player: Player) {
    this.getWritable().__reference = {
      label: player.name,
      playerId: player.id,
      candidates: [player.id],
    }
  }
  decorate() {
    return (
      <EditablePlayerToken reference={this.__reference} nodeKey={this.__key} />
    )
  }
}

export function $isPlayerToken(
  node: LexicalNode | null | undefined
): node is PlayerTokenNode {
  return node instanceof PlayerTokenNode
}

function EditablePlayerToken({
  reference,
  nodeKey,
}: {
  reference: PlayerReference
  nodeKey: NodeKey
}) {
  const catalogue = useCatalogue()
  const onInspectPlayer = useContext(PlayerInspectionContext)
  const [editor] = useLexicalComposerContext()
  const [open, setOpen] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const player = catalogue.players.find(
    (item) => item.id === reference.playerId
  )
  const team = catalogue.teams.find((item) => item.id === player?.teamId)
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )
  const cancelClose = () => {
    if (timer.current) clearTimeout(timer.current)
  }
  const closeLater = () => {
    cancelClose()
    timer.current = setTimeout(() => setOpen(false), 200)
  }
  const choose = (choice: Player) => {
    editor.update(() => {
      const node = $getNodeByKey(nodeKey)
      if ($isPlayerToken(node)) node.resolve(choice)
    })
    setOpen(false)
    editor.focus()
  }
  if (player)
    return (
      <Tooltip>
        <TooltipTrigger
          render={
            <Badge
              variant="player"
              className="mx-0.5"
              render={<Button variant="ghost" size="xs" />}
              contentEditable={false}
              aria-label={`View ${player.name} details`}
              data-player-id={player.id}
              onClick={() => onInspectPlayer?.(player)}
              onKeyDown={(event) => {
                // Activating a reference must not submit the surrounding composer.
                if (event.key === "Enter" || event.key === " ")
                  event.stopPropagation()
              }}
            />
          }
        >
          {team && <TeamMark team={team} size="compact" />}
          <span>{player.name}</span>
        </TooltipTrigger>
        <TooltipContent>
          {player.name} ·{" "}
          {player.signingStatus === "free-agent"
            ? "Free agent"
            : (team?.name ?? "Free agent")}
        </TooltipContent>
      </Tooltip>
    )
  return (
    <Popover
      open={open}
      onOpenChange={(next, details) =>
        setOpen(details.reason === "trigger-press" ? true : next)
      }
    >
      <PopoverTrigger
        render={
          <Badge
            variant="warning"
            className="mx-0.5"
            render={<button type="button" />}
            contentEditable={false}
            aria-label={`Resolve player ${reference.label}`}
            onMouseEnter={() => {
              cancelClose()
              setOpen(true)
            }}
            onMouseLeave={closeLater}
          />
        }
      >
        <Icon icon={HashtagIcon} data-icon="inline-start" />
        <Icon icon={CircleQuestionMarkIcon} data-icon="inline-start" />
        <span>{reference.label}</span>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="start"
        className="w-80 gap-0 p-0"
        onMouseEnter={cancelClose}
        onMouseLeave={closeLater}
      >
        <PopoverTitle className="px-3 py-2">Which player?</PopoverTitle>
        <Command tabIndex={0} aria-label="Choose a player">
          <CommandList>
            <CommandGroup>
              {reference.candidates
                .map((id) => catalogue.players.find((item) => item.id === id))
                .filter((item): item is Player => Boolean(item))
                .map((choice) => (
                  <CommandItem
                    key={choice.id}
                    value={String(choice.id)}
                    onSelect={() => choose(choice)}
                  >
                    <PlayerAvatar player={choice} />
                    <div className="min-w-0 flex-1 text-left">
                      <div>{choice.name}</div>
                      <div className="text-muted-foreground">
                        {
                          catalogue.teams.find(
                            (item) => item.id === choice.teamId
                          )?.abbreviation
                        }{" "}
                        · {choice.position}
                      </div>
                    </div>
                  </CommandItem>
                ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

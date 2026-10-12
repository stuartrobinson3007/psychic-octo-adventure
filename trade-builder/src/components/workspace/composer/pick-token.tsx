import { DecoratorNode } from "lexical"
import type {
  LexicalNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
} from "lexical"
import type { ReactElement } from "react"
import { Badge } from "@/components/ui/badge"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useCatalogue } from "../research-context"
import { pickDetails } from "@/lib/trade/picks"

type PickReference = { label: string; pickId: number; ownerTeamId?: number }
type SerializedPickToken = Spread<
  { reference: PickReference; type: "pick-token"; version: 1 },
  SerializedLexicalNode
>

export class PickTokenNode extends DecoratorNode<ReactElement> {
  __reference: PickReference
  static getType() {
    return "pick-token"
  }
  static clone(node: PickTokenNode) {
    return new PickTokenNode(node.__reference, node.__key)
  }
  constructor(reference: PickReference, key?: NodeKey) {
    super(key)
    this.__reference = reference
  }
  static importJSON(serialized: SerializedPickToken) {
    return new PickTokenNode(serialized.reference)
  }
  exportJSON(): SerializedPickToken {
    return {
      ...super.exportJSON(),
      reference: this.__reference,
      type: "pick-token",
      version: 1,
    }
  }
  createDOM() {
    const span = document.createElement("span")
    span.className = "pick-token-host"
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
  decorate() {
    return <EditablePickToken reference={this.__reference} />
  }
}
export function $isPickToken(
  node: LexicalNode | null | undefined
): node is PickTokenNode {
  return node instanceof PickTokenNode
}

function EditablePickToken({ reference }: { reference: PickReference }) {
  const catalogue = useCatalogue()
  const pick = catalogue.draftPicks?.find(
    (item) => item.id === reference.pickId
  )
  const owner = catalogue.teams.find((team) => team.id === pick?.currentTeamId)
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            variant="player"
            className="mx-0.5 h-auto min-h-6 max-w-full align-baseline [overflow-wrap:anywhere] whitespace-normal"
            contentEditable={false}
            tabIndex={0}
            aria-label={`Pick reference: ${reference.label}`}
          />
        }
      >
        {reference.label}
      </TooltipTrigger>
      <TooltipContent>
        {pick
          ? `Owned by ${owner?.abbreviation ?? pick.currentTeamId} · ${pickDetails(pick)}`
          : "This pick is no longer in the catalogue."}
      </TooltipContent>
    </Tooltip>
  )
}

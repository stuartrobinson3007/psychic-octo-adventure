import { createContext, useContext } from "react"
import type { Catalogue, Player } from "@/lib/trade/types"

export const ResearchContext = createContext<Catalogue | null>(null)
export const PlayerInspectionContext = createContext<
  ((player: Player) => void) | null
>(null)
export function useCatalogue() {
  const catalogue = useContext(ResearchContext)
  if (!catalogue) throw new Error("Player references require a catalogue")
  return catalogue
}

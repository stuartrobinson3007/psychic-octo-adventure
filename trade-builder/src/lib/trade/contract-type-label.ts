import type { ScenarioSigning } from "./types"

const contractTypeLabels: Record<string, string> = {
  standard: "Standard",
  "two-way": "Two-way",
  minimum: "Minimum",
  rookie: "Rookie",
  "stretch-and-waive": "Stretch and waive",
  max: "Max",
  "designated-max": "Designated max",
}

export function contractTypeLabel(value: string): string {
  const label = contractTypeLabels[value]
  if (label) return label

  const words = value.trim().replace(/[-_]+/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/** Funding terms describe the selected offer, independently of its price classification. */
export function signingContractLabel(signing: ScenarioSigning): string {
  return signing.fundingLabel ?? contractTypeLabel(signing.contractType)
}

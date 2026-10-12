export function birdRightsLabel(value: string): string {
  const words = value.trim().replace(/_/g, " ")
  return words.charAt(0).toUpperCase() + words.slice(1)
}

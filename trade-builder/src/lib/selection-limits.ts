export interface SelectionLimits {
  min: number
  max: number
}
export function selectionCountValid(count: number, limits: SelectionLimits) {
  return count >= limits.min && count <= limits.max
}

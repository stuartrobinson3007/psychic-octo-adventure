const scenarioCacheLimit = 3

/** Most recently selected first; reselecting a cached scenario refreshes its age. */
export function rememberPresentationScenario(
  recent: readonly string[],
  id: string
): readonly string[] {
  if (recent[0] === id) return recent
  return [id, ...recent.filter((cached) => cached !== id)].slice(
    0,
    scenarioCacheLimit
  )
}

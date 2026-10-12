// Explicit connections, not inferred user actions between unrelated screenshots.
export function journeyModel(frames) {
  const groups = new Map()
  for (const frame of frames) {
    const key = `${frame.scenarioId}/${frame.stepId}`
    if (!groups.has(key))
      groups.set(key, {
        key,
        title: frame.scenarioTitle,
        step: frame.stepId,
        scenario: frame.scenarioId,
        phase: frame.phase,
        action: frame.action,
        frames: [],
        edges: [],
      })
    groups.get(key).frames.push(frame)
  }
  const connect = (from, to, label) => {
    if (groups.has(from) && groups.has(to)) groups.get(from).edges.push({ to, label })
  }
  const rows = new Map()
  for (const group of groups.values()) {
    if (group.journey) continue
    if (!rows.has(group.scenario)) rows.set(group.scenario, rows.size)
    group.journey = group.title
    group.row = rows.get(group.scenario)
    group.column = Math.min(...group.frames.map(frame => frame.stepIndex))
  }
  for (const scenario of rows.keys()) {
    const checkpoints = [...groups.values()]
      .filter(group => group.scenario === scenario)
      .sort((a, b) => a.column - b.column)
    for (let index = 1; index < checkpoints.length; index++)
      connect(
        checkpoints[index - 1].key,
        checkpoints[index].key,
        checkpoints[index - 1].phase === 'input'
          ? 'Send message'
          : checkpoints[index].action || 'Next captured checkpoint'
      )
  }
  return [...groups.values()]
}

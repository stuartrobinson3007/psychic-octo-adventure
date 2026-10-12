/** Use the viewer's local calendar day, including across timezone boundaries. */
export function messageTimestamp(
  createdAt: string | undefined,
  now = new Date()
): string | undefined {
  if (!createdAt) return undefined
  const sent = new Date(createdAt)
  if (!Number.isFinite(sent.getTime())) return undefined
  const time = sent.toLocaleTimeString("en-AU", {
    hour: "numeric",
    minute: "2-digit",
  })
  if (
    sent.getFullYear() === now.getFullYear() &&
    sent.getMonth() === now.getMonth() &&
    sent.getDate() === now.getDate()
  )
    return time
  const date = sent.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    ...(sent.getFullYear() !== now.getFullYear()
      ? { year: "numeric" as const }
      : {}),
  })
  return `${date} · ${time}`
}

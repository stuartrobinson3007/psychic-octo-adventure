export function presentTradeAllowance(text: string): {
  kind: "exception" | "note" | "plain"
  text: string
} {
  for (const [prefix, kind] of [
    ["Expanded TPE: ", "exception"],
    ["Note: ", "note"],
  ] as const) {
    if (text.startsWith(prefix)) {
      const body = text.slice(prefix.length)
      if (body.trim()) return { kind, text: body }
    }
  }
  return { kind: "plain", text }
}

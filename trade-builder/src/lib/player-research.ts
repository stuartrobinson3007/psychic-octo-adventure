import type { Player, Team } from "@/lib/trade/types"

export function money(value: number, precise = false) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: precise ? "standard" : "compact",
    maximumFractionDigits: precise ? 0 : 1,
  }).format(value)
}

export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
}

export function editDistance(a: string, b: string) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let previous = row[0]
    row[0] = i
    for (let j = 1; j <= b.length; j++) {
      const saved = row[j]
      row[j] = Math.min(
        row[j] + 1,
        row[j - 1] + 1,
        previous + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      previous = saved
    }
  }
  return row[b.length]
}

export function searchPlayers(players: Array<Player>, query: string) {
  const key = normalizeName(query)
  if (!key) return players
  return players
    .map((player) => {
      const name = normalizeName(player.name)
      const score =
        name === key
          ? 0
          : name.includes(key)
            ? 1
            : key.length >= 5
              ? editDistance(name, key) + 2
              : 99
      return { player, score }
    })
    .filter(({ score }) => score <= Math.max(2, key.length >= 7 ? 4 : 2))
    .sort((a, b) => a.score - b.score || b.player.salary - a.player.salary)
    .map(({ player }) => player)
}

export interface NameMatch {
  start: number
  end: number
  text: string
  candidates: Array<Player>
}

export function findPlayerName(
  text: string,
  players: Array<Player>
): NameMatch | null {
  const words = Array.from(text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}.'’-]*/gu))
  const exact = new Map<string, Array<Player>>()
  const surnames = new Map<string, Array<Player>>()
  for (const player of players) {
    const key = normalizeName(player.name)
    exact.set(key, [...(exact.get(key) ?? []), player])
    const parts = player.name.replace(/\s+(Jr\.?|II|III|IV)$/i, "").split(/\s+/)
    const surname = normalizeName(parts[parts.length - 1])
    surnames.set(surname, [...(surnames.get(surname) ?? []), player])
  }
  // Longest windows win, so a full name is never consumed as a surname first.
  for (let i = 0; i < words.length; i++) {
    for (let count = Math.min(4, words.length - i); count >= 1; count--) {
      const start = words[i].index
      const last = words[i + count - 1]
      const end = last.index + last[0].length
      const raw = text.slice(start, end)
      const key = normalizeName(raw)
      let candidates = exact.get(key)
      if (!candidates && count === 1 && key.length >= 5) {
        candidates = surnames.get(key)
        if (candidates?.length)
          candidates = players.filter(
            (player) =>
              candidates!.includes(player) ||
              normalizeName(player.name.split(/\s+/)[0]) === key
          )
      }
      if (!candidates && key.length >= 9 && count <= 3) {
        const distances = players
          // Do not consume "of", "to" or "no" beside an already exact name
          // as though those words were a typo in the player's name.
          .filter((player) => !key.includes(normalizeName(player.name)))
          .map((player) => ({
            player,
            distance: editDistance(normalizeName(player.name), key),
          }))
          .filter(({ distance }) => distance <= (key.length >= 13 ? 2 : 1))
        const best = Math.min(...distances.map((item) => item.distance))
        candidates = distances
          .filter((item) => item.distance === best)
          .map((item) => item.player)
      }
      if (candidates?.length) return { start, end, text: raw, candidates }
    }
  }
  return null
}

const logoIds: Record<string, number> = {
  ATL: 1610612737,
  BOS: 1610612738,
  BKN: 1610612751,
  BRK: 1610612751,
  CHA: 1610612766,
  CHI: 1610612741,
  CLE: 1610612739,
  DAL: 1610612742,
  DEN: 1610612743,
  DET: 1610612765,
  GSW: 1610612744,
  GS: 1610612744,
  HOU: 1610612745,
  IND: 1610612754,
  LAC: 1610612746,
  LAL: 1610612747,
  MEM: 1610612763,
  MIA: 1610612748,
  MIL: 1610612749,
  MIN: 1610612750,
  NOP: 1610612740,
  NO: 1610612740,
  NYK: 1610612752,
  NY: 1610612752,
  OKC: 1610612760,
  ORL: 1610612753,
  PHI: 1610612755,
  PHX: 1610612756,
  POR: 1610612757,
  SAC: 1610612758,
  SAS: 1610612759,
  SA: 1610612759,
  TOR: 1610612761,
  UTA: 1610612762,
  UTAH: 1610612762,
  WAS: 1610612764,
}

export function teamLogo(team: Team) {
  const id = logoIds[team.abbreviation.toUpperCase()]
  return (
    team.logoUrl ??
    (id ? `https://cdn.nba.com/logos/nba/${id}/primary/L/logo.svg` : undefined)
  )
}

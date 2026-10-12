import photoUrls from "./player-photo-urls.json"
import namedPhotoUrls from "./named-player-photo-urls.json"

/** Local demo portraits, keyed by Basketball GM catalogue ID (not NBA ID). */
export const PLAYER_PHOTO_URLS: Readonly<Record<string, string>> = photoUrls
const NAMED_PLAYER_PHOTO_URLS: Readonly<Record<string, string>> = namedPhotoUrls

export const PLAYER_PHOTO_FALLBACK_URL = "/player-headshots/fallback.svg"

export function getPlayerPhotoUrl(playerId: number | string): string {
  const key = String(playerId)
  return Object.hasOwn(PLAYER_PHOTO_URLS, key)
    ? PLAYER_PHOTO_URLS[key]
    : PLAYER_PHOTO_FALLBACK_URL
}

/** College portraits are taller; keep faces visible when cropped into avatars. */
export function getPlayerPhoto(playerId: number | string) {
  return photoDetails(getPlayerPhotoUrl(playerId))
}

/** Portrait-only identities never become available trade-roster players. */
export function getNamedPlayerPhoto(name: string) {
  const key = name.trim().toLowerCase()
  return photoDetails(
    Object.hasOwn(NAMED_PLAYER_PHOTO_URLS, key)
      ? NAMED_PLAYER_PHOTO_URLS[key]
      : PLAYER_PHOTO_FALLBACK_URL
  )
}

function photoDetails(src: string) {
  return {
    src,
    hasPhoto: src !== PLAYER_PHOTO_FALLBACK_URL,
    objectPosition: /\.(jpg|webp)$/.test(src) ? "center top" : "center",
  }
}

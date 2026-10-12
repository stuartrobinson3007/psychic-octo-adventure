const encoder = new TextEncoder()
export const SESSION_COOKIE = "__Host-gambit-session"
export const ACCESS_DAYS = 30

export interface AccessSecrets {
  GAMBIT_PASSWORD: string
  GAMBIT_SESSION_SECRET: string
}
export interface BrowserSession {
  browserId: string
  expiresAt: number
}

async function signingKey(secrets: AccessSecrets) {
  // Including the password makes password rotation invalidate existing access.
  const bytes = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(
      `${secrets.GAMBIT_SESSION_SECRET}:${secrets.GAMBIT_PASSWORD}`
    )
  )
  return crypto.subtle.importKey(
    "raw",
    bytes,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  )
}
const hex = (bytes: ArrayBuffer) =>
  [...new Uint8Array(bytes)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")

export async function passwordMatches(
  password: string,
  secrets: AccessSecrets
) {
  if (!password || password.length > 256) return false
  const key = await signingKey(secrets)
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(secrets.GAMBIT_PASSWORD)
  )
  return crypto.subtle.verify("HMAC", key, signature, encoder.encode(password))
}

export async function createSessionToken(
  browserId: string,
  secrets: AccessSecrets,
  now = Date.now()
) {
  const payload = `${browserId}.${now + ACCESS_DAYS * 86_400_000}`
  const signature = await crypto.subtle.sign(
    "HMAC",
    await signingKey(secrets),
    encoder.encode(payload)
  )
  return `${payload}.${hex(signature)}`
}

/** A valid expired token can retain browser identity when the password is entered again. */
export async function readSessionToken(
  token: string,
  secrets: AccessSecrets
): Promise<BrowserSession | null> {
  if (token.length > 200) return null
  const parts = token.split(".")
  if (parts.length !== 3) return null
  const [browserId, expiration, signature] = parts
  if (
    !/^[0-9a-f-]{36}$/.test(browserId) ||
    !/^\d{13}$/.test(expiration) ||
    !/^[0-9a-f]{64}$/.test(signature)
  )
    return null
  const bytes = Uint8Array.from(signature.match(/../g) ?? [], (byte) =>
    parseInt(byte, 16)
  )
  const valid = await crypto.subtle.verify(
    "HMAC",
    await signingKey(secrets),
    bytes,
    encoder.encode(`${browserId}.${expiration}`)
  )
  return valid ? { browserId, expiresAt: Number(expiration) } : null
}

export function sessionCookie(token: string) {
  // Keep the signed identity for a year; access itself expires after 30 days.
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`
}
export function requestSessionToken(request: Request) {
  return (
    request.headers
      .get("Cookie")
      ?.split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
      ?.slice(SESSION_COOKIE.length + 1) ?? ""
  )
}

export const sameOrigin = (request: Request) =>
  request.headers.get("Origin") === new URL(request.url).origin

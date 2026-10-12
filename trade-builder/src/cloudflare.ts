import { DurableObject } from "cloudflare:workers"
import handler from "@tanstack/react-start/server-entry"
import { conversationContext } from "./server/conversation-context.ts"
import { SqlConversationStore } from "./server/conversation-sql.ts"
import { accessPage } from "./server/access-page.ts"
import {
  createSessionToken,
  passwordMatches,
  readSessionToken,
  requestSessionToken,
  sameOrigin,
  sessionCookie,
} from "./server/access-session.ts"
import type { AccessSecrets } from "./server/access-session.ts"

interface Env extends AccessSecrets {
  ASSETS: Fetcher
  WORKSPACES: DurableObjectNamespace<BrowserWorkspace>
  GUARD: DurableObjectNamespace<UsageGuard>
  OPENAI_API_KEY: string
  GAMBIT_INTERPRETATION_MODEL: string
  GAMBIT_EXECUTION_MODEL: string
}

function guard(env: Env) {
  return env.GUARD.get(env.GUARD.idFromName("shared-demo-limits"))
}

/** Every browser has its own durable database, including when conversation IDs collide. */
export class BrowserWorkspace extends DurableObject<Env> {
  private store: SqlConversationStore
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    const sql = ctx.storage.sql
    this.store = new SqlConversationStore({
      transaction: (operation) => ctx.storage.transactionSync(operation),
      exec: (query) => sql.exec(query),
      prepare: (query) => ({
        get: (...values) => sql.exec(query, ...values).toArray()[0],
        run: (...values) => ({
          changes: sql.exec(query, ...values).rowsWritten,
        }),
      }),
      close: () => {},
    })
    // Retire alarms created by earlier versions of the workspace.
    this.ctx.waitUntil(this.ctx.storage.deleteAlarm())
  }
  async fetch(request: Request) {
    const session = await readSessionToken(
      requestSessionToken(request),
      this.env
    )
    if (
      !session ||
      session.expiresAt <= Date.now() ||
      this.env.WORKSPACES.idFromName(session.browserId).toString() !==
        this.ctx.id.toString()
    )
      return new Response("Please enter the shared password.", { status: 401 })
    return conversationContext.run(
      {
        namespace: this.ctx.id.toString(),
        store: this.store,
        authorizeChat: () => guard(this.env).chat(session.browserId),
      },
      () => handler.fetch(request)
    )
  }
}

/** One durable coordinator makes limits atomic across browsers and Worker instances. */
export class UsageGuard extends DurableObject<Env> {
  private sweptAt = 0
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env)
    ctx.storage.sql.exec(
      "CREATE TABLE IF NOT EXISTS usage (bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires INTEGER NOT NULL)"
    )
  }
  private reserve(
    limits: Array<{ name: string; limit: number; windowMs: number }>,
    now = Date.now()
  ) {
    const sql = this.ctx.storage.sql
    if (now - this.sweptAt > 60_000) {
      sql.exec("DELETE FROM usage WHERE expires < ?", now)
      this.sweptAt = now
    }
    const buckets = limits.map((rule) => ({
      ...rule,
      bucket: `${rule.name}:${Math.floor(now / rule.windowMs)}`,
      expires: (Math.floor(now / rule.windowMs) + 1) * rule.windowMs,
    }))
    for (const rule of buckets) {
      const row = sql
        .exec<{ count: number }>(
          "SELECT count FROM usage WHERE bucket = ?",
          rule.bucket
        )
        .toArray()
        .at(0)
      if (row && row.count >= rule.limit) return rule.name
    }
    for (const rule of buckets)
      sql.exec(
        "INSERT INTO usage (bucket, count, expires) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1",
        rule.bucket,
        rule.expires
      )
    return null
  }
  allow(name: string, limit: number, windowMs: number) {
    return this.reserve([{ name, limit, windowMs }]) === null
  }
  chat(browserId: string) {
    const blocked = this.reserve([
      { name: `chat-minute:${browserId}`, limit: 3, windowMs: 60_000 },
      { name: `chat-day:${browserId}`, limit: 100, windowMs: 86_400_000 },
      { name: "chat-global-day", limit: 300, windowMs: 86_400_000 },
    ])
    if (!blocked) return null
    if (blocked.startsWith("chat-minute:"))
      return "Please wait a minute before sending another message."
    if (blocked.startsWith("chat-day:"))
      return "You’ve reached today’s chat limit. Please try again tomorrow."
    return "Gambit has reached today’s shared chat limit. Please try again tomorrow."
  }
}

const unauthorized = () =>
  Response.json(
    { error: "Please enter the shared password." },
    {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    }
  )

async function boundedRequest(request: Request, limit: number) {
  if (!request.body) return request
  const reader = request.body.getReader()
  const chunks: Array<Uint8Array> = []
  let size = 0
  let part = await reader.read()
  while (!part.done) {
    size += part.value.byteLength
    if (size > limit) {
      await reader.cancel()
      return null
    }
    chunks.push(part.value)
    part = await reader.read()
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.length
  }
  return new Request(request, { body: bytes })
}

export default {
  async fetch(originalRequest: Request, env: Env): Promise<Response> {
    const url = new URL(originalRequest.url)
    const pathname = url.pathname
    if (/^\/(?:ux-review|__ux-review-assets)(?:\/|-|$)/.test(pathname))
      return new Response("Not found", { status: 404 })
    const isAsset =
      /^\/(?:assets|player-headshots)\//.test(pathname) ||
      ["/favicon.svg", "/robots.txt", "/manifest.json"].includes(pathname)
    if (
      ["GET", "HEAD"].includes(originalRequest.method) &&
      ["/favicon.svg", "/robots.txt"].includes(pathname)
    )
      return env.ASSETS.fetch(originalRequest)
    if (!env.GAMBIT_PASSWORD || !env.GAMBIT_SESSION_SECRET)
      return new Response("Access is not configured.", { status: 503 })
    if (
      !["GET", "HEAD"].includes(originalRequest.method) &&
      !sameOrigin(originalRequest)
    )
      return new Response("This request must come from Gambit.", {
        status: 403,
      })

    const token = requestSessionToken(originalRequest)
    const session = await readSessionToken(token, env)
    const authenticated = session && session.expiresAt > Date.now()
    if (pathname === "/access/login") {
      if (originalRequest.method === "GET")
        return authenticated
          ? Response.redirect(`${url.origin}/`, 303)
          : accessPage()
      if (originalRequest.method !== "POST")
        return new Response("Method not allowed", { status: 405 })
      const ip = originalRequest.headers.get("CF-Connecting-IP") ?? "local"
      if (!(await guard(env).allow(`login:${ip}`, 10, 15 * 60_000)))
        return accessPage(
          "Too many attempts. Please try again in 15 minutes.",
          429
        )
      const request = await boundedRequest(originalRequest, 2048)
      if (!request) return accessPage("Please enter a valid password.", 400)
      let password: string | File | null
      try {
        password = (await request.formData()).get("password")
      } catch {
        return accessPage("Please enter a valid password.", 400)
      }
      if (
        typeof password !== "string" ||
        !(await passwordMatches(password, env))
      )
        return accessPage("That password doesn’t match. Please try again.", 401)
      const browserId = session?.browserId ?? crypto.randomUUID()
      return new Response(null, {
        status: 303,
        headers: {
          Location: "/",
          "Set-Cookie": sessionCookie(await createSessionToken(browserId, env)),
          "Cache-Control": "no-store",
        },
      })
    }
    if (!authenticated) {
      if (
        originalRequest.method === "GET" &&
        !pathname.startsWith("/api/") &&
        !pathname.startsWith("/_serverFn/")
      )
        return Response.redirect(`${url.origin}/access/login`, 303)
      return unauthorized()
    }
    if (isAsset && ["GET", "HEAD"].includes(originalRequest.method))
      return env.ASSETS.fetch(originalRequest)
    if (!(await guard(env).allow(`requests:${session.browserId}`, 120, 60_000)))
      return new Response("Please wait a minute and try again.", {
        status: 429,
        headers: { "Retry-After": "60" },
      })
    const request = await boundedRequest(originalRequest, 512 * 1024)
    if (!request) return new Response("Request too large", { status: 413 })
    const response = await env.WORKSPACES.get(
      env.WORKSPACES.idFromName(session.browserId)
    ).fetch(request)
    const secured = new Response(response.body, response)
    secured.headers.set("Cache-Control", "private, no-store")
    secured.headers.set("X-Content-Type-Options", "nosniff")
    secured.headers.set("Referrer-Policy", "same-origin")
    secured.headers.set("X-Frame-Options", "DENY")
    secured.headers.set("X-Robots-Tag", "noindex, nofollow")
    return secured
  },
}

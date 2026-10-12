import assert from "node:assert/strict"
import { readdirSync } from "node:fs"
import { resolve } from "node:path"
import { Miniflare, convertV4MiniflareOptions } from "miniflare"
import { sendStreamingTradeMessage } from "../src/lib/trade-chat-stream.ts"

let modelRequests = 0
const question = "Which player would you like to trade?"
const mf = new Miniflare(
  convertV4MiniflareOptions({
    workers: [
      {
        name: "gambit-adk-integration",
        modules: [
          {
            type: "ESModule",
            path: resolve("dist-cloudflare/server/index.js"),
          },
          ...readdirSync("dist-cloudflare/server/assets")
            .filter((name) => name.endsWith(".js"))
            .map((name) => ({
              type: "ESModule",
              path: resolve("dist-cloudflare/server/assets", name),
            })),
        ],
        modulesRoot: resolve("dist-cloudflare/server"),
        compatibilityDate: "2026-10-08",
        compatibilityFlags: ["nodejs_compat"],
        bindings: {
          GAMBIT_PASSWORD: "local-integration-password",
          GAMBIT_SESSION_SECRET: "local-integration-signing-secret",
          OPENAI_API_KEY: "local-integration-key",
          GAMBIT_EXECUTION_MODEL: "local-integration-model",
        },
        durableObjects: {
          GUARD: { className: "UsageGuard", useSQLite: true },
          WORKSPACES: { className: "BrowserWorkspace", useSQLite: true },
        },
        outboundService: async (request) => {
          const url = new URL(request.url)
          if (url.hostname === "bball-gm.com") {
            assert.equal(request.method, "GET")
            return Response.json(
              url.pathname === "/api/salary-cap"
                ? {
                    season: "2026-27",
                    salaryCap: 1,
                    luxuryTaxLine: 2,
                    firstApron: 3,
                    secondApron: 4,
                  }
                : []
            )
          }
          assert.equal(
            url.hostname,
            "api.openai.com",
            "Unexpected outbound request"
          )
          assert.equal(url.pathname, "/v1/responses")
          modelRequests++
          return Response.json({
            id: `response-${modelRequests}`,
            object: "response",
            status: "completed",
            created_at: 1,
            model: "local-integration-model",
            output: [
              {
                type: "function_call",
                id: "fc-question",
                call_id: "call-question",
                name: "ask_question",
                arguments: JSON.stringify({
                  question,
                  purpose: "player_identity",
                  playerIds: [],
                  teamIds: [],
                  allTeams: false,
                  selectionLimits: null,
                  choices: [],
                  references: [],
                  context: "Resolve the player's identity.",
                  supersedesQuestionReferences: [],
                  answeredQuestionReferences: [],
                }),
              },
            ],
          })
        },
      },
    ],
  })
)

try {
  const origin = "https://gambit.local"
  const login = await mf.dispatchFetch(`${origin}/access/login`, {
    method: "POST",
    headers: { Origin: origin },
    body: new URLSearchParams({ password: "local-integration-password" }),
    redirect: "manual",
  })
  assert.equal(login.status, 303)
  const cookie = login.headers.get("set-cookie")?.split(";")[0]
  assert.ok(cookie)
  const input = {
    sessionId: crypto.randomUUID(),
    requestId: crypto.randomUUID(),
    message: "Trade a player.",
  }
  const transport = {
    api: `${origin}/api/trade-chat`,
    fetch: (url, init) =>
      mf.dispatchFetch(String(url), {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          Cookie: cookie,
          Origin: origin,
        },
      }),
  }
  const progress = []
  const result = await sendStreamingTradeMessage(
    input,
    (calls) => progress.push(calls),
    transport
  )
  assert.equal(result.status, "needs_clarification")
  assert.equal(result.message, question)
  assert.equal(result.conversationVersion, 1)
  assert.equal(modelRequests, 1)
  assert.ok(
    progress.some((calls) => calls.some((call) => call.state === "running"))
  )
  const replay = await sendStreamingTradeMessage(input, () => {}, transport)
  assert.deepEqual(replay, result)
  assert.equal(modelRequests, 1)

  const secondLogin = await mf.dispatchFetch(`${origin}/access/login`, {
    method: "POST",
    headers: { Origin: origin },
    body: new URLSearchParams({ password: "local-integration-password" }),
    redirect: "manual",
  })
  assert.equal(secondLogin.status, 303)
  const secondCookie = secondLogin.headers.get("set-cookie")?.split(";")[0]
  assert.ok(secondCookie)
  const secondTransport = {
    api: `${origin}/api/trade-chat`,
    fetch: (url, init) =>
      mf.dispatchFetch(String(url), {
        ...init,
        headers: {
          ...Object.fromEntries(new Headers(init?.headers)),
          Cookie: secondCookie,
          Origin: origin,
        },
      }),
  }
  const [firstFollowUp, secondVisitor] = await Promise.all([
    sendStreamingTradeMessage(
      {
        ...input,
        requestId: crypto.randomUUID(),
        message: "Trade another player.",
      },
      () => {},
      transport
    ),
    // Colliding conversation and request IDs still belong to different browsers.
    sendStreamingTradeMessage(input, () => {}, secondTransport),
  ])
  assert.equal(firstFollowUp.conversationVersion, 2)
  assert.equal(secondVisitor.conversationVersion, 1)
  assert.equal(secondVisitor.status, "needs_clarification")
  assert.equal(modelRequests, 3)
  assert.deepEqual(
    await sendStreamingTradeMessage(input, () => {}, transport),
    result
  )
  assert.deepEqual(
    await sendStreamingTradeMessage(input, () => {}, secondTransport),
    secondVisitor
  )
  assert.equal(modelRequests, 3)
  console.log(
    "Passed authenticated Worker chat through ADK/OpenAI, streamed progress, durable commit, replay and concurrent browser isolation. All external responses were injected locally."
  )
} finally {
  await mf.dispose()
}

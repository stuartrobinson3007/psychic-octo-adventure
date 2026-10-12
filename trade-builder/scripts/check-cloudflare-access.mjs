// Run against a local Cloudflare preview or the deployed demo. Credentials stay in ignored local storage.
import assert from "node:assert/strict"
import { readFile, readdir } from "node:fs/promises"
import { runWithStartContext } from "@tanstack/start-storage-context"
// Use the installed framework's transport to exercise its actual serialization protocol.
const { serverFnFetcher } = await import(
  new URL(
    "serverFnFetcher.js",
    import.meta.resolve("@tanstack/start-client-core/client-rpc")
  )
)

const base = process.argv[2] ?? "http://localhost:3020"
const password = JSON.parse(
  await readFile(".gambit/deployment-secrets.json", "utf8")
).GAMBIT_PASSWORD
const asset = (await readdir("dist-cloudflare/server/assets")).find((name) =>
  name.startsWith("__23tanstack-start-server-fn-resolver-")
)
const registry = await readFile(
  `dist-cloudflare/server/assets/${asset}`,
  "utf8"
)
const functionId = (name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = registry.match(
    new RegExp(
      '"([a-f0-9]{64})": \\{\\s*functionName: "' +
        escaped +
        '_createServerFn_handler"'
    )
  )
  assert.ok(match, `Missing server function ${name}`)
  return match[1]
}
const localTestIp = "198.51.100." + Math.floor(Math.random() * 250 + 1)
const check = async (path, options = {}, status) => {
  if (base.startsWith("http://localhost:")) {
    options.headers = new Headers(options.headers)
    options.headers.set("CF-Connecting-IP", localTestIp)
  }
  const response = await fetch(base + path, { redirect: "manual", ...options })
  assert.equal(
    response.status,
    status,
    `${path}: ${await response.clone().text()}`
  )
  return response
}
await check("/", {}, 303)
await check("/manifest.json", {}, 303)
await check(
  "/api/trade-chat",
  {
    method: "POST",
    headers: { Origin: base, "content-type": "application/json" },
    body: "{}",
  },
  401
)
await check("/_serverFn/" + functionId("getTradeConversation"), {}, 401)
await check(
  "/access/login",
  {
    method: "POST",
    headers: { Origin: "https://untrusted.example" },
    body: new URLSearchParams({ password }),
  },
  403
)
await check(
  "/access/login",
  {
    method: "POST",
    headers: { Origin: base },
    body: new URLSearchParams({ password: "wrong" }),
  },
  401
)
await check("/ux-review", {}, 404)

async function login() {
  const response = await check(
    "/access/login",
    {
      method: "POST",
      headers: { Origin: base },
      body: new URLSearchParams({ password }),
    },
    303
  )
  const cookie = response.headers.get("set-cookie")
  assert.ok(cookie?.includes("HttpOnly") && cookie.includes("Secure"))
  return cookie.split(";")[0]
}
const first = await login(),
  second = await login()
assert.notEqual(first, second)
const rpc = (name, data, cookie, method = "GET") =>
  runWithStartContext({ startOptions: {} }, () =>
    serverFnFetcher(
      base + "/_serverFn/" + functionId(name),
      [{ data, method, headers: { Cookie: cookie, Origin: base } }],
      fetch
    )
  ).then((reply) => {
    if (reply.error) throw reply.error
    return reply.result
  })
const id = crypto.randomUUID()
const initial = await rpc("getTradeConversation", { sessionId: id }, first)
assert.equal(initial.messages.length, 0)
await rpc(
  "importTradeConversation",
  {
    sessionId: id,
    messages: [
      {
        id: "import-user",
        role: "user",
        text: "Private deployment smoke check",
      },
    ],
    focus: null,
  },
  first,
  "POST"
)
const restored = await rpc("getTradeConversation", { sessionId: id }, first)
assert.equal(restored.messages[0].text, "Private deployment smoke check")
const isolated = await rpc("getTradeConversation", { sessionId: id }, second)
assert.equal(isolated.messages.length, 0)
const tampered = first.slice(0, -1) + (first.endsWith("0") ? "1" : "0")
await check(
  "/api/trade-chat",
  {
    method: "POST",
    headers: {
      Cookie: tampered,
      Origin: base,
      "content-type": "application/json",
    },
    body: "{}",
  },
  401
)
await check("/", { headers: { Cookie: first } }, 200)
await check(
  "/api/trade-chat",
  {
    method: "POST",
    headers: {
      Cookie: first,
      Origin: base,
      "content-type": "application/json",
    },
    body: "{}",
  },
  400
)
console.log(
  "Passed: password gate, server-function protection, cross-origin rejection, separate browser sessions, forged-cookie rejection, cloud persistence, and identical conversation-ID isolation."
)
